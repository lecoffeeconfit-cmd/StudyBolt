# StudyBolt account deletion audit and repair

29 October 2026 • `com.lecoffeeconfit.studybolt`

**Status: implemented locally; not deployed and not production ready. No production account, purchase, uploaded file, or customer record was deleted during this audit. Native sandbox end-to-end deletion and purchase restoration remain untested.**

## Findings

- The feature already exists at **Settings → Manage account → Delete my account** and already had a confirmation modal. The repaired modal checks current Apple subscription information, explains billing continues, links to Apple subscription settings, and always permits deletion with active or unknown subscription status.
- RevenueCat is initialized with the signed-in Supabase UUID. Checkout and Restore purchases require sign-in. Restore already uses the supported, user-initiated `Purchases.restorePurchases()` call, followed by server entitlement verification. A store SDK response alone never grants the server's Premium access.
- The currently deployed deletion function has only the Supabase client import, no RevenueCat references and no fetch call. It removes Storage objects and Auth, **but does not delete a RevenueCat customer**. Its inspected SHA-256 is `5279c7750c7e010c620261cd64e6137b90af7ae03e7f2373223b860e531cee48`. The newer helper existed only in the local worktree.
- The previous local RevenueCat helper treated HTTP 200 as erased, although the supported v2 DELETE queues asynchronous work. Its order also erased RevenueCat before Supabase, leaving a partial-deletion risk if Supabase failed. The updated journal tracks each successful step and confirms customer absence separately.
- Webhooks previously fetched a v1 subscriber before checking the Auth user. A missing customer can be created by a v1 lookup; inserting the subscription event for a deleted user also failed its Auth FK. The repaired webhook and manual sync reject missing/deleting users before that lookup. The database locks the Auth row before recording events and ignores absent/deleting users, including a race after the initial check.
- The subscription-event function previously scoped outcome updates by event ID alone. They now also match user ID, so a transfer event cannot change another participant's event outcome.
- Uploaded visual bytes live in private `studybolt-visuals`; normal paths begin with the user UUID. Cleanup now also includes legacy paths whose Storage owner is the deleted user. SQL identifies paths; Storage `remove()` erases bytes and metadata. SQL does not delete hosted object metadata directly.
- `studybolt_admin_audit` has no Auth FK and its details can contain email. A reviewed Auth trigger now removes actor/target audit rows during deletion rather than leaving those personal records orphaned.
- The schema explicitly warns that Auth is shared with WordWiz. A safety check refuses erasure if unknown product FK rows, non-StudyBolt app metadata, or another bucket's owned files are present. It runs both when accepting the request and immediately before Auth deletion. It does not assume that erasing WordWiz data is authorized.
- Local cleanup previously did not cover all caches, pending writes, notifications and media playback. The updated path stops pending material-generation results from writing back, drains persisted state/activity writes, removes StudyBolt's local keys and private cache, cancels app notifications, clears local Auth tokens, resets widgets/state, and returns to sign-in. Other apps' storage and the student's original external files are preserved. A local cleanup failure is reported after sign-out.
- The SDK identity queue now reads RevenueCat's actual cached App User ID before every operation, serializes identity changes with purchases/restores, checks the final identity, and pauses purchase operations for an uncertain deletion. A definitive refusal with no accepted job releases the hold so missing backend setup does not disable existing restores. Stale subscription results cannot update the newly signed-in account.

## Live read-only observations

The RevenueCat dashboard and anonymous server aggregates were inspected; no live customer identifiers or secret values were displayed.

| Check | Observation on 29 October |
| --- | --- |
| REST v2 project ID | `proj4ff86a20`; the dashboard route uses `4ff86a20`, which is not the v2 ID |
| Backend API key | Existing **StudyBolt Account Deletion**, v2, Customers **Read & write**; all other permission groups shown as No access. The key was not revealed or changed. |
| Installed server configuration | Dedicated deletion API key, v2 project ID, retry-worker secret and worker-enabled flag are absent from the running StudyBolt Edge Function environment. |
| Migration | `public.studybolt_account_deletions` is absent in production. The new migration has not been applied. |
| Restore ownership policy | **Transfer to new App User ID**; separate sandbox behavior is off. Sandbox purchase access is **Anybody**. No setting was changed. |
| Webhook | RevenueCat shows Webhooks as Active. Prior setup records a successful signed test; no new production event was sent. |
| Product Auth links | All 17 public FKs to Auth use cascade deletion and match the inspected StudyBolt table inventory. No additional product FK appeared in this inventory. This does not prove no other app uses the shared identity service. |
| Dangling audit actors/targets | 0 missing actors; 0 missing targets at query time |
| Uploaded visuals | 0 Storage objects in `studybolt-visuals`; 0 missing UUID-prefix or owner Auth references |
| Other app metadata | No unexpected app-metadata key among registered StudyBolt accounts at query time |
| Apple identities | 0 Apple identities joined to registered StudyBolt accounts at query time; Apple sign-in still exists in source and must be handled before use |

The 29 October observations above are the original baseline. The read-only production preflight below records the newer 7 November state and supersedes the earlier deployment-configuration and migration observations.

## Production preflight — 7 November 2026

No production data or service was changed during this preflight. No account, purchase, uploaded file, or customer record was deleted.

- **Correct target:** Coolify identifies the `studybolt-supabase` resource as project `studybolt`, routed through `studybolt-api.duckdns.org`. Its PostgreSQL service is `supabase-db-mrbwmu6upfr6zofvlfy9tqws`, database `postgres`. A separate `bookez` Supabase stack was excluded.
- **Migration copy:** `/tmp/20261029000000_studybolt_account_deletion.sql` on the VPS has the same SHA-256 as the repository migration.
- **Database state and prerequisites:** the migration ledger ends at `20261027000000`; the deletion journal and its functions are absent. `auth.users`, `storage.objects`, `studybolt_subscription_events`, `studybolt_admin_audit`, `service_role`, and the audit table's `admin_user_id`/`target_user_id` columns are present. The production inventory has the same 17 public Auth foreign keys as the migration's StudyBolt allowlist. The required Storage columns exist. No conflicting migration trigger exists; the current Storage triggers are `protect_objects_delete` and `update_objects_updated_at`.
- **Current database backup:** the latest discovered database dump is `pre-migrations-20261027T051603Z.dump`, dated 27 October. Its archive table-of-contents and all compressed payload blocks decode successfully. It is not a current backup, and no isolated restore test was performed. Newer Coolify volume archives are Storage volume backups, not database dumps. A fresh database backup and verification are required immediately before the migration.
- **Function environment:** the running Edge Functions container has `SUPABASE_URL`, the service-role key, RevenueCat v2 project/key, and a worker secret of at least 32 characters. Secret values were not displayed. `STUDYBOLT_DELETION_WORKER_ENABLED=false` and `VERIFY_JWT=false`.
- **Mounted source:** `delete-account/index.ts` and its four deletion helpers match the repository. `process-account-deletions/index.ts` is missing from the production functions volume. The mounted RevenueCat webhook and subscription-sync entrypoints differ from the current guarded repository versions and must be updated before accepting deletion requests.
- **Worker schedule and service:** no matching root cron entry or systemd timer was found. The Edge Functions service is currently healthy. Only that service needs recreation after its function volume and environment are ready; the database, Auth, Storage, gateway, and other services must not be restarted.

### Proposed production change set

After explicit approval, create a fresh custom-format PostgreSQL dump, decode-check it, and test a restore in an isolated disposable database before applying the migration. Apply the migration with `ON_ERROR_STOP` inside one transaction and insert its `20261029000000` migration-ledger row in that same transaction. Verify the private journal, RLS/ACLs, seven migration functions, two new triggers, and the subscription-event function before continuing.

Then add the missing `process-account-deletions` entrypoint and update only the mounted `revenuecat-webhook` and `studybolt-sync-subscription` entrypoints to their reviewed repository versions. Preserve copies of the current mounted webhook/sync sources for rollback. Configure a root-owned systemd timer to call `https://studybolt-api.duckdns.org/functions/v1/process-account-deletions` once per minute. Store its bearer credential in a root-only protected file and keep it out of command-line arguments and logs. First recreate only the StudyBolt Edge Functions service with the deletion flag still false. Verify service health and safe checks: unsupported methods and missing/incorrect authorization are rejected. Run the authenticated worker once through its systemd service only after confirming the journal is empty; enable the timer and confirm a successful empty-queue run while intake is still disabled. Then set `STUDYBOLT_DELETION_WORKER_ENABLED=true` and recreate that same Edge Functions service to load the flag. Confirm health and leave the timer active. Do not submit a real customer deletion as a test.

### Rollback plan

- If the SQL transaction errors, `ON_ERROR_STOP` aborts the transaction, so neither the schema changes nor its migration-ledger row should remain.
- Before enabling deletion requests, disable the timer and keep the worker flag false if the new service or safe checks fail. Restore the saved webhook/sync files, remove the added worker entrypoint, and recreate only the Edge Functions service.
- If the migration itself must be reversed before any deletion request is accepted, remove its two triggers and new objects, and restore the prior `apply_studybolt_subscription_event` definition captured before the change. Do not drop the journal after it contains an accepted request.
- Once any deletion request has been accepted, do not roll back by deleting the journal, recreating Auth users, or restoring RevenueCat profiles. Set the worker flag false to stop new requests, leave the scheduler running to finish accepted jobs, and resolve the backlog. A partial erasure is not reversible.

No separate StudyBolt staging backend was found, so this rollout would be a production-only change without a hosted staging rehearsal. The local PostgreSQL fixture does not reproduce the full hosted Auth/Storage services. The owner must explicitly approve proceeding with that limitation after reviewing the fresh backup and rollback plan.

## Data inventory and removal

| Data | Removal mechanism |
| --- | --- |
| Auth user, identities, sessions/refresh credentials | Supabase Admin hard deletion; live Auth service behavior requires sandbox verification |
| `shared_study_packs` | Owner FK cascade, including published sanitized snapshots/share links |
| `classes`, `class_memberships` | Creator/member FK cascade; deleting an owned class also removes its memberships, including other members' links to that class |
| `ai_usage`, `ai_tutor_rate_limits`, `ai_usage_periods`, `ai_usage_reservations`, `ai_usage_events` | User FK cascade |
| `studybolt_visual_documents`, `studybolt_visuals` | Owner FK cascade |
| `studybolt_admins`, `studybolt_accounts`, `studybolt_activity`, `studybolt_feedback` | User FK cascade |
| `studybolt_subscription_events`, `studybolt_subscription_sync_throttle` | User FK cascade |
| `studybolt_powerpoint_import_periods`, `studybolt_powerpoint_import_requests` | User FK, then period/request cascade |
| `studybolt_admin_audit` | New trigger erases records whose actor or target is the removed user |
| Private visual images | Storage API removes exact bucket paths matching UUID prefix or Storage owner, in batches of 100 with stable pagination |
| RevenueCat profile/aliases | Backend v2 customer erasure only; a profile linked to another identified account is refused for manual separation |
| Local account data | `@studybolt/` keys, exact Supabase session keys, app-private cached imports/audio, app notifications, playback, widgets and in-memory study state |
| Aggregate AI budget/configuration | Retained configuration/aggregate data; it has no per-user Auth link |

No documented legal obligation requiring personal audit records to be retained was found. The proposed operational deletion journal contains a UUID, SHA-256 hash of the previously authenticated token, progress flags/timestamps, attempt/lease information, and sanitized error codes; it never stores the token, email, receipt, or study content. Completed jobs are purged by the worker after **30 days**. Unfinished jobs remain until resolved so erasure is not silently abandoned. The owner must approve this retention period and the pending-job escalation process in the privacy notice.

Existing infrastructure backups, hosting/security logs, external document-processor temporary files and upstream AI-provider retention are not purged by this implementation. Their retention/access arrangements still need verification and documentation. Deleting live rows does not establish backup or third-party log erasure. Sentry source currently removes user identity/request details and disables default PII, but provider-side retention was not audited.

## Request and retry behavior

1. The app records an account-specific purchase hold and detaches its SDK identity before requesting deletion.
2. The endpoint requires a bounded explicit confirmation body and verifies the Bearer token against Supabase Auth. A body-supplied target user ID is ignored. It validates the RevenueCat project using a bounded v2 customer-list read and checks aliases before accepting any destructive work.
3. A service-only RPC checks cross-app impact and records the UUID plus token hash in a private journal. A second request for the same authenticated user updates the same job.
4. A five-minute lease permits one worker at a time. Confirmed requests remove uploaded bytes and then hard-delete Auth, cascading database records. New Storage writes for the deleting user are rejected.
5. RevenueCat erasure waits at least 60 seconds from acceptance to drain earlier subscriber lookups, which have a ten-second client timeout. Later webhook/sync requests are blocked by the journal or missing Auth user. HTTP 200 from DELETE means pending; a validated-project v2 customer GET must subsequently return 404 before completion is recorded. A profile still present after five minutes receives another alias-checked erasure request.
6. Failed steps retain progress. The worker backs off from one minute up to one hour and respects longer provider Retry-After values. Direct retries cannot bypass that schedule. Missing or linked-account configuration errors remain pending for operational review after acceptance.
7. The endpoint returns 202 only after a durable request exists. The app then signs out and erases local data while remaining server cleanup continues. If a response was lost after Auth deletion, only the exact token previously verified for that journal can acknowledge/resume it; no new target account can be selected. An unrecognized 2xx response does not erase local state.
8. Completed journals expire after 30 days. Even afterward, a missing Auth user causes subscription webhooks to be acknowledged without lookup or record creation.

Erasing RevenueCat is **not Apple subscription cancellation**. Renewal, cancellation, refunds and App Store billing remain controlled by Apple. Old devices that continue contacting RevenueCat independently can create new provider profiles; the app/server safeguards and retry window need native multi-device sandbox testing. The implementation does not promise that a third-party record can never reappear.

## Required migration and rollout review

`supabase/migrations/20261029000000_studybolt_account_deletion.sql` is additive: it creates a private journal, service-only safety/listing/claim functions, an upload guard and an Auth cleanup trigger, and replaces the subscription-event function. Applying it does not itself delete existing accounts or images. Future Auth deletions will erase related audit rows. New uploads for confirmed deleting users will be refused. Review the live shared-Auth consumers, default grants, table inventory, Storage schema and trigger ordering before deployment. The local PostgreSQL fixture replays all 12 real migrations, but does not reproduce the full hosted Auth/Storage service implementation.

Rollout order, first in an isolated environment:

1. Review the migration and retention decisions. Apply the migration before deploying webhook or sync guards; otherwise those guards deliberately fail closed when the journal is absent.
2. Install the existing RevenueCat v2 key as `REVENUECAT_DELETION_API_KEY` and full project ID as `REVENUECAT_PROJECT_ID` in the encrypted backend environment. The key needs `customer_information:customers:read` for project/alias validation and `customer_information:customers:read_write` for deletion. Broader project permissions are unnecessary. Do not put the secret in EAS, Expo, public config, logs or the app bundle.
3. Deploy `process-account-deletions`, `revenuecat-webhook`, `studybolt-sync-subscription`, and `delete-account` with their shared modules. The worker has gateway JWT verification disabled and instead requires its own random **32-character minimum** `STUDYBOLT_DELETION_WORKER_SECRET`. Ordinary app JWTs must be rejected.
4. Configure a trusted server scheduler to POST `/functions/v1/process-account-deletions` once per minute with `Authorization: Bearer <worker-secret>`. Keep that credential in the scheduler's encrypted configuration. No customer ID is sent. Verify scheduler execution, lease behavior, pending-job monitoring and completed-job retention purges. Each run handles at most two due jobs and stops starting new jobs after 30 seconds. Monitor backlog growth and tune capacity after load testing.
5. Alert an operator when pending jobs are older than 24 hours or show persistent configuration/shared-profile errors. Resolve those requests rather than deleting the journal. Only then set backend `STUDYBOLT_DELETION_WORKER_ENABLED=true`; the delete endpoint refuses new destructive work until this flag and worker secret exist.
6. Ship the matching app confirmation/client only after the new endpoint is installed and tested. The new client must not ship against the legacy endpoint, whose response lacks the required completion status. Old clients without `{confirmation:"DELETE_ACCOUNT"}` receive 400 and must upgrade; do not silently interpret an empty request as explicit confirmation.
7. Complete the sandbox matrix below, review the resulting evidence, then separately review production deployment. No migration, scheduler, live setting, or deployment was applied during this task.

Pausing the enabled flag stops accepting new requests but must not stop the worker from finishing already-confirmed requests. A partial erasure is not reversible and must not be “rolled back” by recreating an Auth user or restoring a deleted subscription profile. Existing store subscriptions are not cancelled by this workflow.

## Purchase restoration and remaining blockers

- **Ownership setting:** Live RevenueCat still transfers a receipt to a new identified App User ID. SDK UUID checks prevent stale identity mistakes but do not prevent a receipt transfer explicitly allowed by that server policy. The candidate policy is **Keep with original App User ID**, since StudyBolt requires sign-in before checkout. First enable and validate that behavior in an isolated sandbox; test existing identified users, old anonymous receipts, shared devices, Family Sharing if offered, and account recovery. Do not claim unrelated-account isolation while the live transfer policy remains unchanged.
- **Restoring after erasure:** Test that the rightful App Store purchaser can restore using Apple's sandbox account through the existing button after deleting/recreating a StudyBolt account, while a different App Store purchaser cannot claim the purchase. RevenueCat customer erasure plus Keep with original behavior must be verified together; no silent transfer, manual entitlement grant or client-only Premium override is implemented.
- **Apple sign-in revocation:** Source supports Apple OAuth but no persistent provider refresh-token management or Apple token-revocation path was found. Build and test the authorized Apple revocation/re-authorization flow with server-held Apple credentials before declaring the Apple sign-in deletion case compliant. Do not place Apple private keys or provider refresh tokens in public/mobile configuration. The current live aggregate of zero Apple-linked registered StudyBolt users does not remove this requirement.
- **Environment:** The running backend lacks the deletion key/project and worker configuration. A separate Supabase/RevenueCat sandbox and fresh native build were not provided/identified. Local preview must not be redirected to production for destructive tests. A v2 key now exists in RevenueCat, so creation is not required; installation is still required.
- **Shared identity:** The guard deliberately blocks a future shared WordWiz case. A product decision and reviewed implementation are still needed for preserving that login versus erasing the complete shared account. No WordWiz data was deleted.

## Verification performed

- TypeScript application check passed.
- All four changed Edge Function entry points passed Deno type checking.
- Automated Node suite passed **92/92** tests, including new request/authentication, queued erasure, provider failures/backoff, storage pagination, repeated requests, deleted-user guards, SDK identity serialization, deletion acknowledgements and public-secret rejection cases.
- Disposable PostgreSQL integration passed **32 checks**, replaying all **12** real migrations. This exercised active-subscription metadata, idempotent jobs, exclusive leases, provider backoff, audit/cascade removal, upload fences, cross-app/metadata/storage safety, late webhook events, private journal permissions and stale-JWT isolation from another user's private packs.
- Expo iOS/Android/web exports passed. Bundling does not replace a native build or device test.

| Requested scenario | Automated evidence | Native/hosted sandbox status |
| --- | --- | --- |
| No subscription | Same billing-independent deletion sequence | Not run |
| Active Apple subscription | Active metadata does not block request; no cancellation API is called | Not run; verify warning and Apple management link |
| RevenueCat failure | Bounded retry, durable pending state, queued versus completed distinction | Not run against real RevenueCat |
| Supabase cleanup failure | Later destructive stages stop; checkpointed work resumes | Hosted Auth/Storage failure injection not run |
| Repeated requests | Journal upsert, leases, original-token recovery, explicit completed acknowledgement | Not run over a real dropped connection |
| Deleted-account events | Guard tests and actual SQL returns ignored without inserting FK events | No real signed RevenueCat retry after deletion |
| Sign-out/local cleanup | Acknowledgement/key-namespace tests, SDK detach, write-drain/reset implementation | Native cache/notification/widget test not run |
| Valid purchase restore | Correct UUID and serialized restore-action contract tested | Real Apple sandbox receipt not tested |
| Unrelated account/data | PostgreSQL stale-JWT private-pack access denied; other uploads/data preserved; shared aliases refused | Live RLS/Storage URL and two-purchaser receipt isolation not run |

Use **disposable sandbox accounts only** for every unrun scenario. Capture the before/after Auth row, each data table and Storage paths, v2 customer state, worker job checkpoints, signed webhook responses and app signed-out state. Verify store subscription status remains active after erasure unless the sandbox tester separately cancels it. Never use an actual production customer for these checks.

To repeat local database verification without adding a production dependency:

```sh
npm install --prefix /private/tmp/studybolt-deletion-test-runtime @electric-sql/pglite
node scripts/test-account-deletion-db.mjs /private/tmp/studybolt-deletion-test-runtime/node_modules/@electric-sql/pglite/dist/index.js
npm test
npm run typecheck
```

The SQL fixture is explicitly disposable and must never be applied to a hosted project. Unit providers are mocked; PGlite is an isolated PostgreSQL database. Neither is an end-to-end App Store or Supabase Auth/Storage test.

## Files changed for this repair

| Area | Files |
| --- | --- |
| Account confirmation and restore safeguards | `src/screens/AccountScreen.tsx`, `src/screens/PremiumScreen.tsx`, `src/services/subscriptions.ts`, new `src/services/revenuecatIdentity.ts` |
| Auth and local removal | `src/AuthContext.tsx`, `src/StudyBoltContext.tsx`, `src/services/auth.ts`, `src/services/persistence.ts`, `src/services/adminActivity.ts`, new `src/services/accountDeletionClient.ts`, new `src/services/accountDeletionLocal.ts` |
| Backend | `supabase/functions/delete-account/index.ts`, `supabase/functions/_shared/revenuecatCustomer.ts`, new `_shared/accountDeletion.ts`, new `_shared/accountDeletionStore.ts`, new `_shared/accountDeletionHandler.ts`, new `process-account-deletions/index.ts`, `revenuecat-webhook/index.ts`, `studybolt-sync-subscription/index.ts`, `supabase/config.toml` |
| Database/test fixture | New `supabase/migrations/20261029000000_studybolt_account_deletion.sql`, `supabase/tests/account-deletion-fixture.sql`, `scripts/test-account-deletion-db.mjs` |
| Automated tests/build guard | New `tests/accountDeletion.test.mjs`, `tests/accountDeletionHandler.test.mjs`, `tests/revenuecatIdentity.test.mjs`; updated `tests/revenuecatCustomer.test.mjs`, `tests/backendEnvironment.test.mjs`, `scripts/validate-eas-environment.mjs` |
| Configuration/docs | `.env.example`, `README.md`, `app-store/release-checklist.md`, `app-store/revenuecat-setup-status.md`, `app-store/backend-readiness-review.md`, this report |

The worktree already contained unrelated Home, icon, legal/release and other changes before this request. Those were preserved and are not claimed as part of this repair. Nothing was committed, pushed or deployed.

## Primary references

- [Apple: offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple: revoking Sign in with Apple tokens](https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple)
- [RevenueCat v2 customer API: asynchronous deletion, customer reads and aliases](https://www.revenuecat.com/docs/api-v2/customer)
- [RevenueCat: customer deletion does not cancel store subscriptions](https://www.revenuecat.com/docs/dashboard-and-metrics/customer-profile)
- [RevenueCat: user-initiated restoring](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
- [RevenueCat: restore ownership policies](https://www.revenuecat.com/docs/projects/restore-behavior)
- [RevenueCat: App User IDs and aliases](https://www.revenuecat.com/docs/customers/identifying-customers)
- [Supabase: user deletion, Storage ownership and JWT lifetime](https://supabase.com/docs/guides/auth/managing-user-data)
