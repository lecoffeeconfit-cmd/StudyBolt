# App Store release checklist

## Ready in the repository

- iOS bundle ID is `com.lecoffeeconfit.studybolt`; App Store Connect app ID `6811507333` is configured in `eas.json`.
- Version is `1.0.0`; the production EAS profile uses remote build numbering and auto-increments.
- A 1024 × 1024 iOS app icon exists; the app supports iPhone and iPad.
- Account creation is optional for the local Biology sample, and the app has an in-app account deletion flow.
- Subscription checkout is gated until HTTPS Privacy Policy and Terms links are configured. The purchase screen shows store price/period, restore, legal links, and subscription management.
- The account-deletion confirmation now tells Premium subscribers to cancel store billing before proceeding. The delete-account function now removes private slide-image objects before deleting the auth account; deploy this updated function before release.
- The app declares `ITSAppUsesNonExemptEncryption=false`; confirm the export-compliance answer for the final binary.

## Must resolve before App Review

### 1. User-generated content moderation — release blocker

StudyBolt lets learners publish study sets and course/class information through sharing and Discover. In the current UI and backend, no content-report action or user-blocking control was found, and public content is not held for moderation before publication. Apple’s current Guideline 1.2 requires a method to filter objectionable posts, report offensive content with timely responses, block abusive users, and published contact information. Implement those controls and staff the response process, or disable public/community sharing and discovery in the submitted build until they exist. A general support form by itself does not provide the required in-context report and block controls.

### 2. Publish legal/support pages and set production URLs

1. Finalize the existing [privacy and terms pages](https://github.com/lecoffeeconfit-cmd/studybolt-legal) or the local drafts with the actual business/contact details, provider disclosures, model-training disclosure, and age policy.
2. Confirm those pages are live at stable HTTPS URLs, and host the support page with real contact information.
3. Set EAS production variables `EXPO_PUBLIC_PRIVACY_POLICY_URL` and `EXPO_PUBLIC_TERMS_OF_SERVICE_URL` to the published URLs. Set the same privacy URL in the Supabase secret `STUDYBOLT_PRIVACY_POLICY_URL` as required by the cloud AI and document-processing functions.
4. Enter the Privacy Policy URL in App Store Connect App Privacy. Enter the Support URL and actual support contact details on the product page.
5. Check the app’s Legal screen and Premium screen in the release build to confirm the links open and checkout no longer shows the legal publication gate.

### 3. Complete privacy disclosures

Use [`privacy-label-worksheet.md`](privacy-label-worksheet.md), inspect each production SDK’s privacy manifest and settings, and submit App Privacy answers in App Store Connect. Confirm OpenAI, Supabase, RevenueCat, Sentry, and sign-in provider flows against the deployed environment; do not mark data as unlinked or not collected solely because it is not stored in a local table.

### 4. Configure and exercise Premium products

- Create the App Store subscription group and at least one auto-renewing product with localized display name/description, duration, price, and review screenshot.
- Configure the matching RevenueCat entitlement and offering, iOS public SDK key in the EAS production environment, webhook signing secret, entitlement identifier, and deployed status-sync/webhook functions.
- Complete required App Store tax/banking agreements and subscription metadata.
- Confirm the production UI displays the real store price and period, and exercise sandbox purchase, restore, cancellation, expiration, and account deletion behavior.

### 5. Fill App Store Connect fields

Copy the prepared name, subtitle, promotional text, description, and keywords from [`submission-draft.md`](submission-draft.md). Then supply the actual privacy/support/marketing URLs, copyright holder, age-rating responses, review contact, review credentials, and distribution availability. Upload at least one current device screenshot; use more screenshots to show the core experience. App previews are optional.

### 6. Review notes and release binary

- Provide a non-expiring demo account for cloud-gated features, or confirm which features can be reviewed through the guest Biology sample.
- Add concise setup steps, subscription test details, external services, and real device/OS versions to App Review Information.
- Confirm the deployed Edge Functions and database migrations match this build. The latest code includes a delete-account function change; deploy it.
- Build with the production EAS profile, confirm the remote build number and processed binary, and attach that build to version 1.0.0 in App Store Connect.
- Select manual release after approval if you want a final review gate; otherwise select the intended automatic release option.

## Apple references

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — especially 1.2 (user-generated content), 3.1.2 (subscriptions), and 5.1.1 (privacy/account deletion).
- [Complete review information](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/) — app purpose, audience, test devices, external services, and demo access.
- [App Store Connect platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) — metadata limits, support URL, screenshots, and review notes.
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) — data categories and third-party SDK disclosures.
- [Account deletion requirements](https://developer.apple.com/support/offering-account-deletion-in-your-app/) — in-app deletion and subscription notice.
