import type { RevenueCatCustomerDeletion } from './revenuecatCustomer.ts';

export interface DeletionJob {
  user_id: string;
  storage_deleted: boolean;
  auth_deleted: boolean;
  revenuecat_requested: boolean;
  revenuecat_deleted: boolean;
  completed_at: string | null;
  attempts?: number;
  created_at?: string;
  revenuecat_requested_at?: string | null;
}
export interface DeletionSteps {
  removeStorage: () => Promise<void>;
  removeAuth: () => Promise<void>;
  requestRevenueCat: () => Promise<RevenueCatCustomerDeletion>;
  confirmRevenueCat: () => Promise<{ deleted: boolean }>;
  checkpoint: (step: 'storage_deleted' | 'auth_deleted' | 'revenuecat_requested' | 'revenuecat_deleted') => Promise<void>;
  complete: () => Promise<void>;
  defer: (code: string, retryAfterSeconds?: number) => Promise<void>;
}

/** A durable saga: Auth/data first, RevenueCat last; every successful step is resumable. */
export async function runAccountDeletion(job: DeletionJob, steps: DeletionSteps): Promise<'completed' | 'pending'> {
  if (job.completed_at) return 'completed';
  let stage = 'storage';
  try {
    if (!job.storage_deleted) {
      await steps.removeStorage();
      await steps.checkpoint('storage_deleted');
    }
    stage = 'auth';
    if (!job.auth_deleted) {
      await steps.removeAuth();
      await steps.checkpoint('auth_deleted');
    }
    stage = 'revenuecat';
    // Existing v1 subscriber reads are bounded to 10s. Let pre-journal requests drain
    // before erasure; all new webhook/sync requests now reject this deleting ID.
    if (job.created_at && Date.now() - Date.parse(job.created_at) < 60_000) {
      await steps.defer('revenuecat_drain_pending', 60);
      return 'pending';
    }
    if (!job.revenuecat_deleted) {
      if (!job.revenuecat_requested) {
        const result = await steps.requestRevenueCat();
        if (!result.ok) {
          await steps.defer(result.configurationError ?? 'revenuecat_request_failed', result.retryAfterSeconds);
          return 'pending';
        }
        if (result.outcome === 'already_deleted') {
          await steps.checkpoint('revenuecat_deleted');
        } else {
          await steps.checkpoint('revenuecat_requested');
          await steps.defer('revenuecat_confirmation_pending');
          return 'pending';
        }
      } else {
        const confirmed = await steps.confirmRevenueCat();
        if (!confirmed.deleted) {
          // An interrupted provider job or an old device can recreate a profile.
          // Reissue erasure after five minutes, with the same alias safety check.
          if (!job.revenuecat_requested_at || Date.now() - Date.parse(job.revenuecat_requested_at) >= 300_000) {
            const retry = await steps.requestRevenueCat();
            if (!retry.ok) {
              await steps.defer(retry.configurationError ?? 'revenuecat_request_failed', retry.retryAfterSeconds);
              return 'pending';
            }
            if (retry.outcome === 'already_deleted') {
              await steps.checkpoint('revenuecat_deleted');
              await steps.complete();
              return 'completed';
            }
            await steps.checkpoint('revenuecat_requested');
          }
          await steps.defer('revenuecat_confirmation_pending');
          return 'pending';
        }
        await steps.checkpoint('revenuecat_deleted');
      }
    }
    stage = 'completion';
    await steps.complete();
    return 'completed';
  } catch {
    // Never expose provider errors/tokens or silently drop a partially completed request.
    await steps.defer(stage + '_cleanup_failed');
    return 'pending';
  }
}
