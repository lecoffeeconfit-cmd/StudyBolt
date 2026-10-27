import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchRevenueCatEntitlement } from '../_shared/revenuecat.ts';

const MAX_BODY_BYTES = 64 * 1024;
const SIGNATURE_TOLERANCE_SECONDS = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TRANSFER_USER_IDS = 20;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  const revenueCatApiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  const entitlementId = Deno.env.get('REVENUECAT_PREMIUM_ENTITLEMENT')?.trim();
  if (!secret || !revenueCatApiKey || !entitlementId) return json({ error: 'Subscription webhook is not configured.' }, 503);

  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedBody(request, MAX_BODY_BYTES);
  } catch {
    return json({ error: 'Webhook payload is too large.' }, 413);
  }

  const signatureHeader = request.headers.get('X-RevenueCat-Webhook-Signature');
  if (!signatureHeader || !await verifySignature(rawBody, signatureHeader, secret)) {
    return json({ error: 'Webhook signature is invalid.' }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
    if (!isRecord(parsed) || !isRecord(parsed.event)) return json({ error: 'Invalid webhook payload.' }, 400);
    payload = parsed;
  } catch {
    return json({ error: 'Invalid webhook payload.' }, 400);
  }

  const event = payload.event as Record<string, unknown>;
  const eventId = typeof event.id === 'string' ? event.id.trim() : '';
  const eventType = typeof event.type === 'string' ? event.type.trim().toUpperCase() : '';
  const eventTimestamp = finiteInteger(event.event_timestamp_ms);
  if (!eventId || eventId.length > 180 || !eventType || eventType.length > 80 || !eventTimestamp || eventTimestamp <= 0) {
    return json({ error: 'Webhook event is missing required fields.' }, 400);
  }

  // Only durable Supabase user IDs can own access. Transfer events include
  // both sides so the previous account is revoked as well as the recipient.
  const transferredFrom = eventType === 'TRANSFER' && Array.isArray(event.transferred_from) ? event.transferred_from : [];
  const transferredTo = eventType === 'TRANSFER' && Array.isArray(event.transferred_to) ? event.transferred_to : [];
  const userIds = [...new Set([event.app_user_id, ...transferredFrom, ...transferredTo]
    .filter((value): value is string => typeof value === 'string' && UUID_PATTERN.test(value)))];
  if (!userIds.length) return json({ status: 'ignored', reason: 'unlinked_user' });
  if (userIds.length > MAX_TRANSFER_USER_IDS) return json({ error: 'Transfer contains too many account IDs.' }, 413);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Subscription service is not configured.' }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // A signed event wakes the integration; the RevenueCat subscriber record
    // is the current source of truth for refunds, grace periods and transfers.
    const snapshots = await Promise.all(userIds.map(async (userId) => ({
      userId,
      state: await fetchRevenueCatEntitlement(userId, entitlementId, revenueCatApiKey),
    })));
    const results = await Promise.all(snapshots.map(async ({ userId, state }) => {
      const { data, error } = await admin.rpc('apply_studybolt_subscription_event', {
        p_event_id: eventId,
        p_user_id: userId,
        p_event_type: eventType,
        p_event_timestamp_ms: eventTimestamp,
        p_is_premium: state.active,
        p_expires_at: state.expiresAt,
      });
      return { data, error };
    }));
    if (results.some((result) => result.error)) return json({ error: 'Could not update subscription access.' }, 500);
    return json({ status: 'processed', accounts: results.length });
  } catch {
    // A non-2xx response asks RevenueCat to retry. Do not acknowledge a failed
    // source-of-truth lookup or partial database update.
    return json({ error: 'Could not confirm current subscription status.' }, 502);
  }
});

async function verifySignature(body: Uint8Array, header: string, secret: string): Promise<boolean> {
  const fields = new Map<string, string>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator > 0) fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const timestamp = fields.get('t');
  const expected = fields.get('v1');
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || !expected || !/^[0-9a-f]{64}$/i.test(expected)) return false;
  const timestampSeconds = Number(timestamp);
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, signed));
  const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(actual.toLowerCase(), expected.toLowerCase());
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function readBoundedBody(request: Request, limit: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error('payload_too_large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function finiteInteger(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
