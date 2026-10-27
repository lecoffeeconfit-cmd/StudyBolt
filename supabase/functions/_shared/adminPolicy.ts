export type AdminUserAction = 'reset_ai_quota' | 'grant_complimentary' | 'revoke_complimentary';
export const ADMIN_USER_ACTIONS = new Set<string>(['reset_ai_quota', 'grant_complimentary', 'revoke_complimentary']);
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function effectiveStudyBoltPlan(metadata: Record<string, unknown> | undefined, now = Date.now()): 'free' | 'premium' {
  if (metadata?.studybolt_subscription_tier === 'premium') {
    const subscriptionExpiry = typeof metadata.studybolt_subscription_expires_at === 'string'
      ? Date.parse(metadata.studybolt_subscription_expires_at)
      : NaN;
    if (Number.isFinite(subscriptionExpiry) && subscriptionExpiry > now) return 'premium';
  }
  const expiresAt = typeof metadata?.studybolt_complimentary_until === 'string' ? Date.parse(metadata.studybolt_complimentary_until) : NaN;
  return Number.isFinite(expiresAt) && expiresAt > now ? 'premium' : 'free';
}

export function accountActionError(actorId: string, targetId: string, targetIsAdmin: boolean): string | null {
  if (actorId === targetId) return 'Manage your own account from Account & security.';
  if (targetIsAdmin) return 'Admin accounts cannot be changed from this console.';
  return null;
}

export function complimentaryExpiry(current: unknown, now = Date.now()): string {
  const currentTime = typeof current === 'string' ? Date.parse(current) : NaN;
  return new Date(Math.max(now, Number.isFinite(currentTime) ? currentTime : 0) + 30 * 86400000).toISOString();
}
