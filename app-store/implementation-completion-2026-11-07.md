# StudyBolt implementation completion — 7 November 2026

**Status: the approved production patch is applied and verified. Not yet ready for the consolidated testing phase.** The existing installed TestFlight build is preserved. No iOS build, Apple submission, real purchase, or account deletion was initiated.

## 1. Issues found and fixed locally

| Confirmed issue | Smallest fix |
| --- | --- |
| One device-wide library was shown across accounts. | Separate account/guest persistence keys; serialize migration/writes; remount private screens on identity changes. Existing legacy data is moved once after Auth hydration, rather than copied into every account. |
| Old AI answers and generation work could survive an account switch. | Clear Tutor cache with an epoch guard against late results; invalidate old generation work; stop old screens/playback; clear the old widget snapshot and cancel study reminders on a switch. |
| A failed/corrupt library read could become an empty autosaved library. | Preserve the saved bytes and show a retry state instead of overwriting them. |
| Account cleanup would remove every account's new scoped library. | Pass the deleted account ID into the existing local-key filter; preserve other scoped libraries/queues. RevenueCat deletion behavior was not changed. |
| RevenueCat Test Store products share the Premium entitlement with real store products. | The shared server helper now verifies the subscription store before granting access. Simulated Test Store access is rejected; Apple sandbox/TestFlight receipts remain supported. |
| Public sharing was disabled only in the production client. | Prepared restrictive RLS and RPC permission migration; owners retain private reads/writes and revoke access. No rows are deleted. |
| Document processor failed current Deno type checking. | Copy hash input into an ordinary byte buffer before Web Crypto hashing. |
| Audio's required `expo-asset` peer was not a direct dependency; dependency advisories included high/critical findings. | Declare the peer; apply Expo 57/security patches; align Expo modules, remove duplicate native UI dependency, and reconcile the local CocoaPods lockfile. |

Legacy migration limitation: the old library contains no owner identity. It is assigned once to the session present on the first upgraded launch (or the guest scope when signed out). Earlier ownership cannot be reconstructed automatically. New account boundaries are isolated; test the upgrade using a known owner account. Study packs remain device-local by the existing architecture; server backups do not back up those libraries.

## 2. Files changed in this pass

- Account isolation: `App.tsx`, `src/StudyBoltContext.tsx`, `src/services/persistence.ts`, new `src/services/accountStorage.ts`, `src/services/aiRouter.ts`.
- Deletion integration only: `src/services/accountDeletionClient.ts`, `src/services/accountDeletionLocal.ts`.
- Backend: `supabase/functions/_shared/revenuecat.ts`, `supabase/functions/studybolt-process-document/index.ts`.
- Migration: `supabase/migrations/20261107000000_studybolt_private_release.sql`.
- Dependencies: `package.json`, `package-lock.json`, `ios/Podfile.lock`.
- Validation: new `tests/accountStorage.test.mjs`, `tests/aiRouterIsolation.test.mjs`, `tests/revenuecatEntitlement.test.mjs`, `scripts/test-production-access-db.mjs`.
- Evidence/report: this document and `app-store/legal-config-verification.jpg`.

Other Home/design/statistics/release-audit edits already present or arriving concurrently in the worktree were preserved and are not claimed as changes from this pass.

## 3. Database migrations

**Applied in production:** `20261107000000_studybolt_private_release.sql`, after a fresh private backup. Migration and ledger insert completed in one transaction. Backup archive TOC and payload decoding were verified without restoring over production. No shared snapshots existed before or after.

The live ledger now includes `20261107000000` after the prior 11 migrations through `20261027000000`. All 20 public application tables had RLS enabled; application indexes were valid and constraints validated at inspection. Public-schema CREATE is unavailable to `anon` and `authenticated`. The only storage bucket is private `studybolt-visuals`, with a 5 MB image limit and owner-prefix read policy.

The migration revokes public/community reader RPC access and prevents making active public/link snapshots through direct REST or the upsert RPC. Live grants were checked after deployment; the protected reader/join RPCs are unavailable to `anon` and `authenticated`, while private owner writes and revocation remain available. It changes only StudyBolt sharing objects. The separate deletion migration `20261029000000` remains that task's responsibility; the release policy has no dependency on it.

The verified pre-change backup is `/data/coolify/backups/studybolt-production/readiness-20261108T003642Z`. It contains the database dump, service settings, and pre-change function files with root-only permissions. This was not a full restore rehearsal.

## 4. Backend functions

**Deployed:** the document processor's Web Crypto type fix and the shared RevenueCat entitlement-store guard. The processor now rejects Test Store/unknown-store entitlements server-side while retaining Apple production and sandbox behavior. Existing subscription products, prices, trial terms, credentials, and other function entrypoints were preserved.

The deployed webhook/sync entrypoints differed from the guarded deletion versions during inspection; they were not overwritten independently of the deletion rollout. The deletion task has changed local/DB state since that inspection, but current worker source, schedule, and deployed behavior still need reconciliation before testing.

Only `supabase-edge-functions-mrbwmu6upfr6zofvlfy9tqws` was recreated; it is running healthy. Other services were unchanged. Live SHA-256 values: processor `e46e94850d36a461c4640d2fe55f14b6b57cc760bde9bc481a0f80657802fb71`; shared RevenueCat helper `aa709248eb13c2b5610813dd054ee121f2f5f4a60e80dd6f64fcb21d06233753`.

An obsolete processor backup directory was found inside the publicly routed functions volume. Its source lacks Auth and quota checks. The live endpoint was not confirmed: a safe no-file request was blocked by the approval service before execution. The owner asked to leave it in place for now, so this remains an unresolved release security blocker. No file was moved or deleted.

The Edge service loads both `.env` and `.env.functions`. The latter had an empty `OPENAI_API_KEY` overriding the already valid key. The same existing key was carried into the override; Coolify's saved value and the running value matched. No key was rotated or changed.

## 5. Environment configuration

| Setting | Saved configuration | Running/installed state |
| --- | --- | --- |
| EAS production `EXPO_PUBLIC_LEGAL_DOCUMENTS_APPROVED` | Set to `true` after explicit owner approval; verified by readback. | Takes effect in a replacement binary, not the installed TestFlight app. |
| Coolify `STUDYBOLT_PRIVACY_POLICY_URL` | `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy` | Running Edge environment matches; URL returns 200. |
| Coolify `STUDYBOLT_TERMS_OF_SERVICE_URL` | `https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice` | Running Edge environment matches; URL returns 200. |

Both corrected published URLs return 200. No new legal flag was invented. No credentials, subscription prices, trial terms, production backend URLs, signing settings or other apps' configuration were changed.

EAS production already points Auth and processing to `https://studybolt-api.duckdns.org`; the iOS RevenueCat key is an Apple SDK key. Bundle ID remains `com.lecoffeeconfit.studybolt`; App Store Connect ID remains `6811507333`.

## 6. Verified services and remaining work

**Verified:** HTTPS/TLS certificate valid through 11 December 2026; keyed Auth and REST return 200; Apple/Google/email Auth enabled; email confirmation required; private database ports are not host-published; both pooler ports accept connections; configured AI model read access returns 200. Anonymous processor/Tutor/sync/deletion requests return 401. AI user/concurrency/global spend controls exist (10 free/250 Premium interactions, $5 configured global daily budget). No paid AI generation was performed.

RevenueCat has the active `default` offering, monthly/annual Apple products, and `premium` entitlement. Its active webhook targets production, HMAC is enabled, and production+sandbox events are enabled. At last inspection both Apple products displayed **Missing Metadata** in RevenueCat; App Store Connect verification remains pending. Test Store package mappings were preserved.

App Store Connect access is now confirmed. The App Privacy page still shows the old `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy.html` URL, while the verified published URL is `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy`. Apple's data-collection questionnaire is open and unanswered. No Apple metadata was saved or published; complete the disclosure from the actual app/SDK collection practices and correct the policy URL before submission.

| Remaining item | Why it remains / exact next action |
| --- | --- |
| Obsolete processor backup route | A legacy backup source in the public functions volume has no Auth/quota checks. The live route was not probed because the approval service blocked the no-file request. Owner chose to leave it for now; reconsider isolating it outside the routed volume and refreshing only StudyBolt's Edge container before public release. |
| Account-deletion rollout | Separate task is in progress. A post-deployment read showed the deletion journal present and worker-enabled flag true; the worker source is also now in the shared local worktree. Its current deployed source, schedule, retries, and authenticated behavior have not been re-verified in this pass. Reconcile with that task and complete its Apple token-revocation decision before deletion testing. No account was deleted. |
| Apple metadata | In App Store Connect → StudyBolt → App Privacy, correct the Privacy Policy URL to the verified published URL and complete the data-collection disclosure accurately. Then inspect Subscriptions → StudyBolt Premium for missing fields, localizations and review information; verify the intended current annual trial. Do not alter prices/trial terms or create replacement products. |
| Replacement build number | EAS remote build number was 16 while local app/widget projects use 22 at inspection. Verify the highest uploaded Apple build and choose a greater matching app/widget number before starting the required replacement build. No number or signing credential was changed here. |
| Backup recovery and off-site copy | Daily 02:30 UTC database and storage backups are enabled, retaining 14 copies/days locally. Latest verified pair: 7 November, approximately 02:30 UTC. Both gzip archives fully decode. `save_s3=false` for both jobs; no off-site destination or restore rehearsal was verified. Supply an approved destination and run a disposable restore drill before public release. |
| Management transport | The accessible Coolify dashboard uses public HTTP. Configure an owner-controlled HTTPS management hostname or private management access; do not expose or move credentials in chat. The app's API HTTPS is already valid. |
| Dependency warnings | Expo Doctor: 19/21 pass; remaining warnings are the existing tracked-native-project/config-sync arrangement and Sentry 8.29 versus Expo's recommended 7.x. Sentry's declared peers support this Expo/React Native setup and native dependency resolution succeeds. Six moderate tooling advisories remain; automatic fixes propose disruptive SDK/Sentry downgrades, which were not applied. Review them before the replacement build. |

Backup evidence comes from Coolify's actual `scheduled_database_backups`/`scheduled_volume_backups` records and recent successful executions, not just the older manual `.dump` archive. Database backups are under `/data/coolify/backups/databases/root-team-0/studybolt-supabase-supabase-db-mrbwmu6upfr6zofvlfy9tqws/`; storage backups are under `/data/coolify/backups/volumes/root-team-0/msc7jhsqaeuistbanewo5bgp/`. [Supabase explains that database dumps do not include stored object bytes](https://supabase.com/docs/guides/platform/backups).

**Testing dependencies, not claimed fixed:** a 7 November incident briefly took MinIO's drive offline and produced pooler timeouts. Both recovered; current storage readiness returns 200 and pooler ports accept connections. The 4-vCPU host showed high CPU pressure. No certificate error was established. Observe resource/latency and storage behavior during the structured test; investigate Contabo capacity if it recurs. No WordWiz or other application resource was changed.

Sentry diagnostics are configured in source with PII/request sanitization; successful reporting, source maps and actionable alert delivery still require the native testing phase. Coolify currently reports no enabled notification channel.

## 7. iOS build requirement and validation

**A replacement iOS build is required** for the account-isolation/cache changes, updated native dependencies and approved client legal setting. The existing TestFlight build cannot receive these changes by editing EAS settings. No new EAS/native build or submission was started.

- JavaScript automated suite: **148 passed**.
- Edge Function tests: **13 passed**; Deno type checks pass, including the repaired processor.
- Disposable PostgreSQL: **25 access-control checks + 32 existing deletion checks passed**; all 13 local migrations replay successfully there.
- TypeScript passes; scoped diff whitespace checks pass.
- Local iOS JavaScript/Hermes bundle export succeeds. This is compilation validation, not a signed iOS binary.
- Local CocoaPods resolution succeeds: 103 dependencies / 104 pods. App design, RevenueCat products and native signing configuration were preserved.

## 8. One consolidated testing phase — only after the prerequisites above

Use disposable StudyBolt users, synthetic documents, and Apple's sandbox. Real purchases and real account erasure remain prohibited without separate approval.

- [ ] Isolate the legacy processor backup route, then confirm its anonymous request is denied. Confirm migration/hash/URLs and reconcile the separate deletion rollout's worker schedule and health before touching workflows.
- [ ] Verify the approved replacement binary's version/build, backend, Apple SDK key, legal links, and enabled monitoring on the iPhone.
- [ ] Sign in with Apple/email and optional Google; verify confirmation/reset callbacks, cold-launch persistence, expired-token refresh, foreground/background and logout.
- [ ] With two accounts, verify separate libraries, Tutor answers, pending generation, widgets, reminders, subscription state and no data exposure after switching. Upgrade with a known legacy-library owner; verify storage-read failure preserves data.
- [ ] Import valid/image-heavy/no-image/corrupt PowerPoint, PDF and notes; verify 20 MB limits, private visuals, retries/timeouts, free monthly PowerPoint allowance, and persisted results after reopening.
- [ ] Verify generated notes, flashcards, quizzes, audio and source references; failures remain retryable and do not display fabricated success.
- [ ] Exercise Tutor text/visual requests and interruptions; confirm 401s without Auth, quota/rate/global-budget behavior, accounting after provider failure, and cross-user denial.
- [ ] Apple sandbox only: monthly/annual purchase, actual displayed prices, intended trial, restore/reinstall, cancellation, expiry, refund and grace period. Verify HMAC webhook retries/idempotency and server-owned Premium. Test Store simulation must not unlock production backend access.
- [ ] After separate deletion approval: disposable free/subscribed/Apple users; confirm billing warning, token revocation, queued retries/restarts, data/visual removal, no account resurrection from webhooks, and unaffected unrelated users/apps.
- [ ] Verify anonymous/cross-user REST/RPC/Storage access is denied; public/link sharing stays unavailable while private/revoke access works.
- [ ] Restore database **and object bytes** into a disposable target, inspect retention/off-site copy, verify Sentry crash/source-map delivery and health alerts, and observe VPS/storage/pooler latency during the test run.

[RevenueCat's documentation confirms that Test Store purchases trigger entitlements](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store); [entitlements are shared across apps within a project](https://www.revenuecat.com/docs/getting-started/entitlements). The server guard addresses that project-wide isolation boundary without changing products.
