# StudyBolt — App Store submission draft

Prepared 26 October 2026 from the current app and repository configuration. This is a copy-ready draft, not a submitted App Store Connect record.

## App record

| Field | Prepared value |
|---|---|
| App name | StudyBolt |
| Bundle ID | `com.lecoffeeconfit.studybolt` |
| App Store Connect app ID | `6811507333` |
| Version | `1.0.0` |
| Primary category | Education |
| Secondary category | Productivity |
| Supported devices | iPhone and iPad |
| Download price | Free is the recommended fit for the current free tier plus optional Premium in-app subscription; choose the actual price tier in App Store Connect. |
| Encryption declaration | `app.json` currently sets `ITSAppUsesNonExemptEncryption` to `false`; confirm this answer against the final binary and Apple’s export-compliance questions. |

The Expo app icon and a 1024 × 1024 iOS App Store icon are present. The EAS submit profile already points to the App Store Connect app ID. EAS uses a remote iOS build number and auto-increments production builds. The checked-in app config says build 15 while the current generated iOS `Info.plist` says 16; use the next EAS production build and confirm its processed build number in App Store Connect before attaching it to this version.

## English (U.S.) product page

**Subtitle** (30 characters max)

Turn Lectures Into Study Packs

**Promotional text** (170 characters max)

Turn lecture PDFs, slides, and notes into clear notes, flashcards, quizzes, audio review, and a plan for what to study next.

**Description**

Turn lecture PDFs, PowerPoint slides, and notes into a focused Study Pack you can keep using after class.

StudyBolt organizes course material into clear notes, active-recall flashcards, practice quizzes, and audio review. A study plan and progress insights help you decide what to review next.

• Build a Study Pack from PDFs, PowerPoint files, and notes
• Review material in simplified or detailed notes
• Practice with flashcards, quizzes, and cumulative exam review
• Listen with StudyCast using voices available on your device
• Make a study schedule, set reminders, and run focus sessions
• Track progress by course and topic
• Keep Study Packs on your device for offline review
• Share selected generated study content or explore public study sets

Explore a sample Biology Study Pack without uploading a file. Creating a pack from your own material and using signed-in cloud features requires an internet connection. AI help is available on supported devices, with cloud AI requiring sign-in and an internet connection.

AI-generated material can contain errors. Check it against your course materials before relying on it.

**Keywords** (89 characters; comma-separated)

flashcards,lecture,quiz,notes,exam,revision,planner,class,recall,test prep,homework,audio

**What’s New**

For the first App Store release, leave this blank if App Store Connect identifies this as version 1.0.0. For a later version, enter actual changes rather than reusing launch copy.

## Fields that need owner-provided details

These cannot be truthfully completed from the app repository alone. I found a separate [StudyBolt legal-pages repository](https://github.com/lecoffeeconfit-cmd/studybolt-legal). Its HTML privacy and terms pages are a useful starting point, but they still contain bracketed placeholders for the AI model-training disclosure, production provider list, operator name, age eligibility, and contact details. I did not confirm a live hosted URL for those files.

- **Privacy Policy URL:** finalize the existing policy page or this draft, then publish it at a stable HTTPS URL.
- **Terms of Use URL:** finalize the existing terms page or this draft and publish it, or select Apple’s standard EULA and use that choice consistently in the app.
- **Support URL and contact:** publish [`support-page-draft.md`](support-page-draft.md) with a real support email and any required legal business contact details. Apple requires a support page with actual contact information.
- **Copyright:** enter the actual rights holder and year; do not assume the bundle identifier names the rights holder.
- **Age rating / audience:** answer the current App Store Connect questionnaire based on intended ages and the live user-generated-content features. Do not select Kids unless the app is specifically designed for children and meets that category’s rules.
- **Review contact:** enter a person’s name, monitored email, and phone number in international format.
- **Review login:** provide a non-expiring reviewer account if review of cloud, community, or Premium features requires sign-in. Do not put credentials in this repository.
- **Store subscription setup:** create the actual product IDs, subscription group, duration, price, localization, and RevenueCat offering; use the same product/entitlement identifiers as the deployed webhook configuration.
- **Review device/OS list:** fill in only after the release build has been exercised on the listed devices and OS versions.

## App Review notes draft

StudyBolt turns a learner’s PDF, PowerPoint, or notes file into an offline-ready Study Pack with notes, flashcards, quizzes, and audio review. It also includes planning, focus sessions, progress insights, widgets, study-set sharing, public Discover/class pages, and optional Premium subscriptions.

To explore without creating an account, choose the guest/sample path and open the Biology demo. This exercises local study tools without requiring a document upload. To review account-based features, use the non-expiring reviewer credentials supplied in the App Review Information section. File processing, cloud AI, public Discover, class membership, and purchases need a working internet connection and the configured production services. On-device AI is device-dependent; StudyCast narration uses the device’s text-to-speech voices and does not require microphone access.

Premium products are auto-renewing store subscriptions. The app displays the store-provided price and subscription period, provides Restore Purchases and subscription management, and requires published Privacy Policy and Terms links before checkout. Test purchases use the App Store sandbox.

**Before pasting these notes:** add the reviewer account details, confirm which cloud features are live in the submitted build, and provide accurate device/OS test information. The public sharing and Discover features also need the moderation controls listed in [`release-checklist.md`](release-checklist.md) before submission.

## Screenshots

No App Store screenshots are present in the repository. Capture actual screens from the release candidate; do not use mockups that imply features or content absent from the binary. Suggested sequence:

1. Home / Study Focus — “Know what to study next”
2. Study Pack notes — “Turn lectures into clear notes”
3. Flashcards and quiz — “Practice with active recall”
4. Planner — “Build a plan around your deadline”
5. StudyCast — “Review with audio, anywhere”

Upload at least one screenshot for the supported iPhone display class in App Store Connect, and add iPad screenshots for the iPad experience as required by the selected listing/device configuration. App previews are optional.
