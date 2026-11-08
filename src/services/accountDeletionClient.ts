export type AccountDeletionResult = { error?: string; message?: string; deletionPending?: boolean; sessionCleanupFailed?: boolean };

/** Only explicit completed/accepted server acknowledgements can clear a local session. */
export async function submitAccountDeletion(
  send: () => Promise<Response>,
  clearSession: () => Promise<void>,
  rejected: () => Promise<void>,
): Promise<AccountDeletionResult> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { response = await send(); break; } catch { /* Retry with the same authenticated request. */ }
  }
  if (!response) return { error: 'Deletion could not be confirmed. Retry deletion to check the recorded request. Purchases stay paused until this is resolved.' };
  let payload: { error?: string; deleted?: boolean; accepted?: boolean; status?: string };
  try { payload = await response.json(); } catch { return { error: 'Deletion returned an unreadable response. Please retry to confirm its status.' }; }
  if (!response.ok) {
    if (payload.accepted === false || [400, 401, 403, 409].includes(response.status)) await rejected();
    return { error: payload.error ?? 'Account deletion could not be confirmed. Please retry.' };
  }
  const completed = payload.deleted === true && payload.status === 'completed';
  const pending = payload.accepted === true && payload.status === 'pending';
  if (!completed && !pending) return { error: 'The server did not confirm deletion. Your local data has not been cleared. Please retry.' };
  let sessionCleanupFailed = false;
  try { await clearSession(); } catch { sessionCleanupFailed = true; }
  return {
    deletionPending: pending,
    sessionCleanupFailed,
    message: pending ? 'Deletion is recorded and remaining cleanup is queued. Apple billing is not cancelled.' : 'Account data was deleted. Apple billing is not cancelled.',
  };
}

export function studyBoltLocalAccountKeys(keys: readonly string[], userId?: string, legacyOwner?: string | null): string[] {
  return keys.filter((key) => {
    if (!key.startsWith('@studybolt/')) return false;
    if (!userId) return true;
    if (key === '@studybolt/state/legacy-owner' || key === '@studybolt/state/v1') {
      return legacyOwner === `@studybolt/state/v2/account/${encodeURIComponent(userId)}`;
    }
    if (key.startsWith('@studybolt/state/v2/')) return key === `@studybolt/state/v2/account/${encodeURIComponent(userId)}`;
    if (key.startsWith('@studybolt/admin-activity/')) return key === `@studybolt/admin-activity/${userId}`;
    if (key.startsWith('@studybolt/deleting-account/')) return key === `@studybolt/deleting-account/${userId}`;
    return true;
  });
}
