import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { runAccountDeletion, type DeletionJob } from './accountDeletion.ts';
import { confirmRevenueCatCustomerDeleted, deleteRevenueCatCustomer } from './revenuecatCustomer.ts';

/** A missing/deleting Auth user must never trigger a RevenueCat v1 lookup that can recreate them. */
export async function studyBoltSubscriptionAccountExists(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data: deletion, error } = await admin.from('studybolt_account_deletions').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) throw new Error('account_deletion_status_unavailable');
  if (deletion) return false;
  const { data, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError && userError.status !== 404) throw new Error('account_lookup_failed');
  return Boolean(data?.user && !userError);
}

export async function processAccountDeletion(admin: SupabaseClient, userId: string, projectId: string, key: string): Promise<'completed' | 'pending'> {
  const lease = crypto.randomUUID();
  const { data: jobs, error } = await admin.rpc('claim_studybolt_account_deletion', { p_user_id: userId, p_lease: lease });
  if (error) throw new Error('deletion_claim_failed');
  const job = jobs?.[0] as DeletionJob | undefined;
  if (!job) {
    const { data, error: lookupError } = await admin.from('studybolt_account_deletions').select('completed_at').eq('user_id', userId).single();
    if (lookupError) throw new Error('deletion_status_failed');
    return data.completed_at ? 'completed' : 'pending';
  }
  const update = async (values: Record<string, unknown>) => {
    const { data, error: updateError } = await admin.from('studybolt_account_deletions').update(values)
      .eq('user_id', userId).eq('lease_token', lease).select('user_id').single();
    if (updateError || !data) throw new Error('deletion_checkpoint_failed');
  };
  return runAccountDeletion(job, {
    removeStorage: () => removeUserVisuals(admin, userId),
    removeAuth: async () => {
      const { error: authError } = await admin.auth.admin.deleteUser(userId, false);
      if (authError && authError.status !== 404 && authError.code !== 'user_not_found') throw new Error('auth_delete_failed');
    },
    requestRevenueCat: () => deleteRevenueCatCustomer(userId, projectId, key),
    confirmRevenueCat: () => confirmRevenueCatCustomerDeleted(userId, projectId, key),
    checkpoint: (step) => update({ [step]: true, ...(step === 'revenuecat_requested' ? { revenuecat_requested_at: new Date().toISOString() } : {}) }),
    complete: () => update({ completed_at: new Date().toISOString(), lease_token: null, lease_until: null, last_error: null }),
    defer: (code, retryAfterSeconds = 0) => update({
      last_error: code, lease_token: null, lease_until: null,
      next_attempt_at: new Date(Date.now() + 1000 * Math.max(retryAfterSeconds, Math.min(3600, 60 * 2 ** Math.min(6, (job.attempts ?? 1) - 1)))).toISOString(),
    }),
  });
}

/** Storage APIs remove object bytes as well as metadata; never DELETE storage.objects with SQL. */
export async function removeUserVisuals(admin: SupabaseClient, userId: string): Promise<void> {
  const bucket = admin.storage.from('studybolt-visuals');
  let cursor = '';
  while (true) {
    const { data, error } = await admin.rpc('list_studybolt_erasure_objects', { p_user_id: userId, p_after_name: cursor });
    if (error) throw error;
    const files = (data ?? []).map((entry: { name: string }) => entry.name);
    if (!files.length) break;
    cursor = files[files.length - 1];
    for (let i = 0; i < files.length; i += 100) {
      const { error: removalError } = await bucket.remove(files.slice(i, i + 100));
      if (removalError) throw removalError;
    }
    if (files.length < 1000) break;
  }
}
