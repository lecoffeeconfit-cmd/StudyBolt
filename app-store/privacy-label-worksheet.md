# App Privacy questionnaire worksheet

This is a code-based first pass for App Store Connect’s App Privacy section. Apple requires the developer to include data collection by integrated third-party SDKs as well as first-party collection. Confirm every answer against the exact production build, configured services, SDK privacy manifests, and current vendor settings before publishing.

## Data types to evaluate and likely disclose

| App Store data type | Why it applies | Likely linked to identity? | Likely purpose |
|---|---|---|---|
| Name | Account display name may be saved in auth profile. | Yes | App functionality |
| Email Address | Email sign-in, account recovery, account management. | Yes | App functionality |
| User ID | Supabase account UUID; also used as RevenueCat customer ID. | Yes | App functionality |
| Other User Content | Uploaded study files/text, generated packs, AI questions/context, and content the user chooses to share. | Yes for account/cloud/share flows | App functionality |
| Customer Support | In-app support category, subject, and message. | Yes | App functionality |
| Product Interaction / Other Usage Data | Account-linked study activity summaries include event type, time, duration, quiz answer/correct counts, and screen. Detailed study content and answers are not included in the admin activity summary. | Yes | App functionality; review whether used for analytics |
| Purchase History | RevenueCat synchronizes subscription status/entitlement against the signed-in account. Apple handles payment details. | Yes | App functionality |
| Crash Data / Other Diagnostic Data | Sentry is initialized for crash/diagnostic reporting. Confirm its production configuration and fields. | Confirm with Sentry configuration; no explicit `setUser` call was found in app source. | App functionality / analytics, according to actual Sentry use |

## Not indicated by the app source reviewed

- No advertising SDK or advertising use was found.
- The iOS privacy manifest sets `NSPrivacyTracking` to `false`; no App Tracking Transparency prompt or IDFA call was found.
- The app does not request microphone access for StudyCast; narration uses device text-to-speech.
- Apple/Google store payment credentials are not received by StudyBolt; purchases use the store through RevenueCat.
- Study packs and detailed learning progress are stored locally. Account-linked cloud activity records contain summarized event counts/durations rather than study text or detailed quiz answers.

## Confirm before publishing

1. Review the privacy manifests for all packaged SDKs, especially Sentry, Supabase, RevenueCat, Expo, and Google/Apple sign-in dependencies.
2. Confirm the Sentry DSN and whether default events include device identifiers, user identity, request data, or breadcrumbs. Set the label’s linked-to-user and purpose answers accordingly.
3. Confirm the exact fields and retention in the deployed Supabase, OpenAI, and RevenueCat projects. Cloud document processing sends uploaded source material to OpenAI; the app code requests non-stored responses and deletes temporary provider files, while private slide-derived visual assets are kept in StudyBolt storage for the visual-review feature.
4. Confirm whether users under 13 are permitted, and set the age rating and privacy policy accordingly.
5. Publish the responses in App Store Connect and update them whenever collection or SDK behavior changes.

Apple’s App Privacy details page requires disclosure of relevant third-party partner practices and defines the data categories used above: [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).
