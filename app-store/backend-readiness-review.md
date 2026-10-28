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
| RevenueCat customer deletion | **Implemented in source; waiting for key setup and staging test** | Account deletion now calls the RevenueCat API v2 delete endpoint before Supabase Auth deletion, with bounded transient retries and an idempotent 404 path. It fails closed if the scoped server key or project ID is missing. No key was created and no customer was deleted. |

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
3. In RevenueCat, create a REST API v2 secret key limited to `customer_information:customers:read_write`. Store it only in the server secret configuration as `REVENUECAT_CUSTOMER_DELETE_API_KEY`, alongside `REVENUECAT_PROJECT_ID`. Keep the staging key/project separate from production.
4. After the owner approves completed legal text, set the client and server legal approval flags in their respective environments. Do not enable either flag before that approval.
5. Back up and verify production restore points before any production data or service change. Then deploy only after staging tests pass and the owner approves production deployment.

## Validation performed

- Backend-specific tests: 12 passing checks, including staging URL fail-closed behavior, profile-marker mismatch rejection, and RevenueCat deletion success, 404, retry, rate-limit, network, and permission cases. `npm test` also passed all 39 tests in the current worktree, including 27 local home-study/dashboard tests that are not part of this backend review branch.
- `npm run typecheck`: currently fails on the separate uncommitted UI file `src/components/HomeLearningCards.tsx` (`StyleSheet.absoluteFillObject` is not available in this project's React Native typings). No diagnostics point to the backend files in this review.
- `eas.json` and `app.json`: valid JSON.
- Pooler health and port readiness checks: passed at the time of inspection.
- Published Privacy Policy and Terms URLs: HTTP 200; live content matched the reviewed GitHub source byte-for-byte.
- Not run: live account-deletion flow, native Apple/Google sandbox sign-in and purchase, document processing, study-material generation, AI Tutor, database access-control tests on a staging backend, or Expo Doctor. No staging backend was available, no RevenueCat deletion key was configured, and Expo Doctor is not installed in the workspace.
