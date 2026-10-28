export type RevenueCatEntitlementState = {
  active: boolean;
  expiresAt: string | null;
};

export async function fetchRevenueCatEntitlement(
  appUserId: string,
  entitlementId: string,
  apiKey: string,
): Promise<RevenueCatEntitlementState> {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return { active: false, expiresAt: null };
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed with ${response.status}`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isRecord(payload.subscriber) || !isRecord(payload.subscriber.entitlements)) {
    throw new Error('RevenueCat subscriber response is invalid');
  }
  const entitlement = payload.subscriber.entitlements[entitlementId];
  if (!isRecord(entitlement)) return { active: false, expiresAt: null };

  const expiration = parseDate(entitlement.expires_date);
  const graceExpiration = parseDate(entitlement.grace_period_expires_date);
  const latest = Math.max(expiration ?? 0, graceExpiration ?? 0);
  return {
    active: latest > Date.now(),
    expiresAt: latest > 0 ? new Date(latest).toISOString() : null,
  };
}

function parseDate(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
