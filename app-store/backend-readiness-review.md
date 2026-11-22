# StudyBolt backend readiness review

**Review date:** 28 October 2026

**Branch:** `codex/backend-production-readiness`

**Production changes:** None. This review used read-only VPS checks and local code changes only.

## Status

| Issue | Status | Evidence and remaining work |
| --- | --- | --- |
| Legal approval gate | **Waiting for owner review** | Both published pages are reachable and match their public GitHub source. They still contain unresolved operator, provider, model-training, retention, age, and jurisdiction placeholders. Both legal approval flags remain false. |
| Supavisor pooler restarts | **Current issue not reproduced; cause unverified** | The StudyBolt pooler is healthy, has zero restarts since its current start, and both PostgreSQL ports accept readiness checks from the database container. Recent logs had no errors. No configuration change is justified by the observed state. |
| TestFlight staging isolation | **Build-time guard implemented; staging setup and verification remain** | The staging profiles use EAS `preview`, production uses `production`, and the EAS pre-install check rejects a profile-marker mismatch, missing backend values, non-HTTPS URLs, or the known production hosts. No separate StudyBolt staging stack was found, and the EAS preview values could not be inspected from this workspace. |
| Production migrations and processor code | **Reconciled in the review branch; deployment parity verified** | Production records migration `20261027000000`, which was absent from the base Git commit but exists in this worktree. Four deployed RevenueCat/document-processing function files match their current worktree hashes; those files differ from the base commit. See “Deployment comparison.” |
| RevenueCat customer deletion | **Implemented in source; waiting for key setup and staging test** | Superseded by the 29 October [account-deletion audit](account-deletion-audit.md): durable Supabase-first cleanup, asynchronous RevenueCat confirmation, worker retries, deleted-user webhook guards, and shared WordWiz Auth protection are implemented locally. The migration, scheduler, backend key, Apple token revocation, restore policy, and native sandbox tests remain release blockers. No production customer was deleted. |

## Legal review findings

The published [Privacy Policy](https://github.com/lecoffeeconfit-cmd/studybolt-legal/blob/main/privacypolicy.html) and [Terms of Service](https://github.com/lecoffeeconfit-cmd/studybolt-legal/blob/main/termsofservice.html) each return HTTP 200. Their live HTML is byte-identical to the public source files.

The Privacy Policy still contains placeholders for:

- Whether uploaded content and AI inputs or outputs are used for training or evaluation.
- The actual providers and the information each receives. The repository shows Supabase Auth/database/storage, OpenAI cloud processing, RevenueCat subscription identity/status, Sentry diagnostics, and Apple or Google sign-in and store billing where used.
- Sale and advertising-related sharing, including targeted ads and advertising identifiers.
- Retention periods for account records, uploads, provider files, support messages, diagnostics, visual assets, and backups.
- The precise deletion path, completion timing, local-device behavior, hosting regions, transfer safeguards, minimum age, legal controller, legal bases, and privacy contact details.

The Terms still have placeholders for the operator and contact, age and guardian rules, governing jurisdiction, liability provisions, dispute terms, and confirmation that the live subscription/trial setup matches the checkout. Account deletion does not cancel App Store or Google Play billing; the app already tells Premium subscribers to manage that billing in the store.

Repository behavior found during review: OpenAI Responses requests set `store: false`; temporary provider files are deleted after processing with a one-hour fallback expiry; selected slide visuals are kept in private Supabase Storage; study packs are stored locally; the RevenueCat app user ID is the signed-in Supabase UUID. These details need the owner's review against actual provider dashboard settings and retention behavior before policy approval. This is an operational comparison, not legal approval.

## Deployment comparison

- The starting Git commit was `549333c` (`master`, matching `origin/master`). The deployed Edge Functions are bind-mounted source files and expose no Git commit label, so a deployment commit SHA could not be verified. Source hashes were compared instead.
- The production database migration registry contains the base repository's ten migrations plus `20261027000000`. That migration exists in this worktree as `supabase/migrations/20261027000000_studybolt_free_powerpoint_imports.sql` and is not present in the base commit.
- The deployed `studybolt-process-document`, `_shared/revenuecat`, `studybolt-sync-subscription`, and `revenuecat-webhook` sources match the current worktree byte-for-byte. Their current worktree files differ from the base commit. The deployed `delete-account` source matched the base commit before the new, not-yet-deployed RevenueCat cleanup was added.
- The Supabase volume also contains the default `main` and `hello` functions and a dated processor backup directory. The backup was left untouched.
- No production database write, function deployment, service restart, secret change, or billing change was performed. No backup was created because no production modification was made.

## Pooler observations

The Coolify resource labeled `studybolt-supabase` runs Supavisor 2.7.4. At inspection it was healthy with zero restarts since its current start. Aggregated log review found zero errors and four warnings over the previous 72 hours. PostgreSQL readiness handshakes through ports 5432 and 6543 both succeeded from the StudyBolt database container. The pooler is attached to the StudyBolt Supabase network; its only mounted file is the pooler configuration, with no separate certificate file mount. The other Supavisor container with a restart count belongs to the unrelated `bookez` project.

These observations do not explain a prior repeated-restart incident. Keep the pooler issue open until it recurs or historical Coolify events identify the cause; do not change its configuration based on the current healthy state.

## Staging and release steps

1. Provision a separate StudyBolt staging Supabase stack and document processor in Coolify, with separate Auth, database, Storage, functions, and server secrets. Use only synthetic test accounts and documents.
2. Add distinct EAS `preview` values for the staging Supabase URL/anon key, processor URL, public RevenueCat SDK key, and legal URLs. Keep production values only in EAS `production`; do not define `EXPO_PUBLIC_APP_ENV` in either EAS dashboard environment because those values override the profile marker. Verify both environments in the EAS dashboard before building; this workspace has no EAS CLI session.
3. In RevenueCat, create a REST API v2 secret key with `customer_information:customers:read` for project/alias validation and `customer_information:customers:read_write` for deletion. Store it only in the server secret configuration as `REVENUECAT_DELETION_API_KEY`, alongside `REVENUECAT_PROJECT_ID`. Keep the staging key/project separate from production.
4. After the owner approves completed legal text, set the client and server legal approval flags in their respective environments. Do not enable either flag before that approval.
5. Back up and verify production restore points before any production data or service change. Then deploy only after staging tests pass and the owner approves production deployment.

## Validation performed

- Backend-specific tests: 12 passing checks, including staging URL fail-closed behavior, profile-marker mismatch rejection, and RevenueCat deletion success, 404, retry, rate-limit, network, and permission cases. `npm test` also passed all 39 tests in the current worktree, including 27 local home-study/dashboard tests that are not part of this backend review branch.
- `npm run typecheck`: currently fails on the separate uncommitted UI file `src/components/HomeLearningCards.tsx` (`StyleSheet.absoluteFillObject` is not available in this project's React Native typings). No diagnostics point to the backend files in this review.
- `eas.json` and `app.json`: valid JSON.
- Pooler health and port readiness checks: passed at the time of inspection.
- Published Privacy Policy and Terms URLs: HTTP 200; live content matched the reviewed GitHub source byte-for-byte.
- Not run: live account-deletion flow, native Apple/Google sandbox sign-in and purchase, document processing, study-material generation, AI Tutor, database access-control tests on a staging backend, or Expo Doctor. No staging backend was available, no RevenueCat deletion key was configured, and Expo Doctor is not installed in the workspace.

## Guest access and AI registration gate — 22 November 2026

This addendum records the StudyBolt-only guest access change. The October review above remains a snapshot of that review date.

### Audit findings and implementation

- Guest mode uses the device library and does not require an Auth account. The app continues to open into guest use; it does not require immediate registration. Guests can browse, organize courses, create manual packs and flashcards, and use non-AI study tools.
- The prior document-import client created a second Supabase client and called `signInAnonymously` to obtain a document-processing token. That path is removed. Guest document imports now show the registration prompt before processing. The app also blocks retries of queued AI study-pack materials until the guest registers.
- `runStudyBoltAI` now gates before cache lookup or on-device inference, and the StudyCast, Coach, Exam Tutor, visual analysis, and document-import actions route guests to the existing sign-up choices. Existing Apple, Google, and email Auth flows remain in use.
- Both AI Edge Function paths verify the bearer token with Supabase Auth and reject `user.is_anonymous` with HTTP 403 and `account_required` before reading AI configuration, reserving usage, or calling an AI provider. Missing or invalid credentials continue to fail with HTTP 401. The document-processing guard covers upload/extraction and follow-up material-generation requests.
- On account hydration, StudyBolt merges non-demo guest packs and guest-created courses into the permanent account library before sync starts. Pack fields and manual flashcards are copied; the original guest library remains on the device. Demo-only courses are excluded.
- Registered-user plan selection still uses verified Supabase `app_metadata` through `effectiveStudyBoltPlan`, which is where the StudyBolt-scoped RevenueCat entitlement is applied. The existing atomic reservation/reconciliation ledger remains the usage authority. Guests are rejected before that ledger is touched.
- The audit found no other AI provider entry point in the current app or Edge Function set. Deterministic exam-building and saved study tools remain available to guests. Existing RevenueCat identity and subscription sync paths are unchanged.

### Shared production Auth scope

StudyBolt no longer calls anonymous sign-in to process a guest document. The shared production Auth anonymous-user setting is currently restored to `false`; this implementation does not require enabling it. A prior, separately authorized operation briefly toggled the shared setting to `true`, then restored it to `false` when this product decision arrived. No anonymous test user was created and no WordWiz-specific setting or data was changed. Because the Auth project is shared, future changes to its configuration must be reviewed as cross-app changes.

No production database migration, Edge Function deployment, app build, RevenueCat configuration change, or secret change is part of this implementation. The new backend guard is code-only and uses the existing verified JWT user record.

### Validation and remaining release work

- `npm test`: 222 passing tests. Added checks cover the client gate before cached/on-device/cloud AI, the backend `is_anonymous` response and Edge Function guard ordering, RevenueCat free/premium plan selection, and guest library conversion. Existing RevenueCat and auth-callback tests also pass.
- `npm run typecheck`: passed after these changes.
- Added `supabase/tests/ai_cloud_ledger.sql` to exercise in-flight monthly quota reservations, reconciliation, and the premium quota path in an isolated database. It has not been run because this workspace has no isolated staging database or database test runner configured.
- No live anonymous JWT, direct production Edge Function, registered-account, Apple/Google/email provider, concurrent database quota, or paid-user request was sent. Those require a separate StudyBolt staging Auth/database/function stack and sandbox provider/store credentials. Production was not used for smoke tests.
- Before release, deploy the updated `studybolt-ai-tutor`, `studybolt-process-document`, and `_shared/registeredAccount.ts` / `_shared/documentUsage.ts` Edge Function sources to StudyBolt staging, run the SQL fixture there, and verify guest 403, missing-token 401, registered free/premium quota behavior, conversion, and provider sign-in. Then ship a new Expo build and obtain approval before any production Edge Function deployment. No schema migration is currently required.
- Do not enable anonymous sign-ins on the shared production Auth project for this feature. Local guest access does not depend on it.
