# App Store release checklist

**Readiness update:** 7 November 2026. This worktree has build-ready code changes, but StudyBolt is not ready for App Store submission yet. App Store Connect is signed out here; RevenueCat and the public legal repository were reviewed read-only.

## Ready in the repository

- iOS bundle ID is `com.lecoffeeconfit.studybolt`; App Store Connect app ID `6811507333` is configured in `eas.json`.
- Version is `1.0.0`; the production EAS profile uses remote build numbering and auto-increments.
- A 1024 × 1024 iOS app icon exists; the app supports iPhone and iPad.
- Account creation is optional for the local Biology sample, and the app has an in-app account deletion flow.
- Subscription checkout is gated until HTTPS Privacy Policy and Terms links are configured. The purchase screen shows store price/period, restore, legal links, and subscription management.
- The updated account-deletion confirmation checks Apple subscription status, links to Apple subscription settings, and allows immediate confirmation while billing is active. Deletion is journaled and retried; Supabase cleanup precedes asynchronously confirmed RevenueCat erasure. Review and complete [the deletion rollout and sandbox verification](account-deletion-audit.md) before release. The deletion journal is not deployed and native end-to-end deletion remains unverified.
- The app declares `ITSAppUsesNonExemptEncryption=false`; confirm the export-compliance answer for the final binary.
- Before a cloud document upload, the app explains that the selected file and class name go to StudyBolt’s server and AI provider, requires an explicit per-upload acknowledgment, and links to the published Privacy Policy.

## Must resolve before App Review

### 1. User-generated content moderation — disabled for v1; verify the release build

The production app marker disables link/public sharing, shared-pack links, Discover, and community classes; the share sheet only allows a pack to remain private. Keep `EXPO_PUBLIC_APP_ENV=production` in the release build and confirm these surfaces stay unavailable in the final binary. The production database still contains community RPCs, so verify the release client does not expose a path into them. If sharing or community returns in a later release, add in-context reporting and blocking, content filtering, a staffed moderation response process, and published contact details first. Apple Guideline 1.2 requires those controls for apps with user-generated content; a general support form alone is insufficient. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### 2. Publish legal/support pages and set production URLs

1. The public [Privacy Policy](https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy) and [Terms](https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice) now identify the operator, contact, California location, and 13+ audience and contain no bracketed placeholders. The Privacy Policy still describes AI provider retention/training and deletion timing generally. The operator must verify those statements against production provider settings and the deployed deletion workflow, then approve both documents.
2. A separate support page is not published. The Privacy Policy has a contact section and email link at `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy#contact`; use that as the App Store Support URL only if the operator confirms it is adequate, or publish the prepared [`support-page-draft.md`](support-page-draft.md) to a stable HTTPS URL.
3. Confirm production EAS variables `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_OF_SERVICE_URL`, and the matching Supabase `STUDYBOLT_PRIVACY_POLICY_URL` secret. Keep both client and server legal approval flags false until the operator reviews and explicitly approves the final text.
4. Enter the Privacy Policy URL in App Store Connect App Privacy. Set the Support URL and monitored contact details on the product page.
5. In the release build, verify the Legal screen links and the expected checkout gate. Enable checkout only after legal approval and store metadata are complete.

The published pages no longer contain template placeholders. Legal accuracy and operator approval remain outstanding; the app and backend deliberately keep paid checkout, cloud processing, and subscription status sync gated until approval.

### 3. Complete privacy disclosures

Use [`privacy-label-worksheet.md`](privacy-label-worksheet.md), inspect each production SDK’s privacy manifest and settings, and submit App Privacy answers in App Store Connect. Confirm OpenAI, Supabase, RevenueCat, Sentry, and sign-in provider flows against the deployed environment; do not mark data as unlinked or not collected solely because it is not stored in a local table.

### 4. Configure and exercise Premium products — blocked by store metadata and sandbox coverage

See [`revenuecat-setup-status.md`](revenuecat-setup-status.md) for installed keys, verified server checks, and the remaining store/policy steps.

- App Store product IDs exist and are attached to RevenueCat’s active `default` offering, but both currently show **Missing Metadata**. Set the intended prices, localizations, subscription descriptions, and annual 7-day trial in App Store Connect.
- Create and activate the matching Google Play products/base plans and annual trial. The RevenueCat mappings exist; Google Play credentials and store-side setup remain unverified.
- RevenueCat’s `premium` entitlement and active `default` offering contain monthly and annual packages. Confirm EAS SDK keys, server webhook settings, and release environments without exposing secrets.
- Complete required App Store tax/banking agreements and subscription metadata.
- The RevenueCat restore policy is still **Transfer to new App User ID**, which can move an existing receipt to another identified account. Test the intended ownership behavior with sandbox accounts before changing this setting or enabling purchases.
- Confirm the production UI displays the real store price and period, and exercise sandbox purchase, restore, cancellation, expiration, refunds, and account deletion.
- Production preflight on 7 November confirmed the RevenueCat v2 key, project ID, and 32+ character worker secret are installed in the Edge Functions environment; the worker flag remains false. The deletion table is absent, the worker entrypoint is not mounted, the current webhook/sync files lack the new deletion guards, and no root cron/systemd schedule was found. The latest database dump is dated 27 October; create and verify a current backup before any database or service change. See the [deletion audit](account-deletion-audit.md) for the exact production change set and rollback plan. Keep all secrets on the server.

### 5. Fill App Store Connect fields

The submission draft now matches the release build, with public sharing and Discover removed from the listing. The remaining fields need App Store Connect access: confirm the privacy/support/marketing URLs, copyright holder, age-rating questionnaire, review contact, review access, and distribution availability. Capture and upload current device screenshots from the release candidate.

### 6. Review notes and release binary

- Provide a non-expiring demo account for cloud-gated features, or confirm which features can be reviewed through the guest Biology sample.
- Add concise setup steps, subscription test details, external services, and real device/OS versions to App Review Information.
- Review the account-deletion migration’s triggers and shared-Auth safeguards before deployment. No separate StudyBolt staging backend was identified; create and validate an isolated staging stack before applying the migration, worker, webhook/sync guards, or deletion endpoint to the shared production Auth project.
- Build with the production EAS profile, confirm the remote build number and processed binary, and attach that build to version 1.0.0 in App Store Connect.
- Select manual release after approval if you want a final review gate; otherwise select the intended automatic release option.

### 7. Access and native verification

- App Store Connect opened signed out during this readiness pass. Sign in in the handed-off Chrome tab before changing listing metadata or attaching a build.
- EAS CLI is not installed in this workspace and EAS cloud environments cannot be verified from the repository. Confirm the production profile’s backend values before building; never build from the local production `.env` as a substitute for verifying EAS.
- Native simulator services were unavailable during this pass. Exercise the release build on supported iPhone and iPad devices before submission; document the actual device and OS versions in review notes.
- Apple sign-in token revocation is not implemented in the account-deletion flow. Complete and sandbox-test revocation before offering Apple sign-in in a release that also supports account deletion.

## Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — especially 1.2 (user-generated content), 3.1.2 (subscriptions), and 5.1.1 (privacy/account deletion).
- [Complete review information](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/) — app purpose, audience, test devices, external services, and demo access.
- [App Store Connect platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) — metadata limits, support URL, screenshots, and review notes.
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) — data categories and third-party SDK disclosures.
- [Account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/) — in-app deletion and subscription notice.
