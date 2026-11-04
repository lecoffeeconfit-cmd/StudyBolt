# StudyBolt — App Store submission draft

Updated 2 November 2026 from the current app and repository configuration. This is a copy-ready draft, not a submitted App Store Connect record.

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

Explore a sample Biology Study Pack without uploading a file. Creating a pack from your own material and using signed-in cloud features requires an internet connection. AI help is available on supported devices, with cloud AI requiring sign-in and an internet connection.

Public sharing, shared-pack links, Discover, and community classes are unavailable in the initial release.

AI-generated material can contain errors. Check it against your course materials before relying on it.

**Keywords** (89 characters; comma-separated)

flashcards,lecture,quiz,notes,exam,revision,planner,class,recall,test prep,homework,audio

**What’s New**

For the first App Store release, leave this blank if App Store Connect identifies this as version 1.0.0. For a later version, enter actual changes rather than reusing launch copy.

## Fields that need owner-provided details

The public [Privacy Policy](https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy) and [Terms](https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice) now name the individual operator, contact email, California location, and 13+ audience. The legal repository contains no bracketed placeholders. The operator still needs to confirm the policy’s provider-retention, model-training, and deletion-timing statements against production settings and approve the final text.

- **Privacy Policy URL:** `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy`.
- **Terms of Use URL:** `https://lecoffeeconfit-cmd.github.io/studybolt-legal/termsofservice`.
- **Support URL and contact:** the published Privacy Policy has a direct Contact section and email link at `https://lecoffeeconfit-cmd.github.io/studybolt-legal/privacypolicy#contact`. Confirm that URL is suitable for the App Store Support URL, or publish [`support-page-draft.md`](support-page-draft.md) as a dedicated support page.
- **Copyright:** enter the actual rights holder and year; do not assume the bundle identifier names the rights holder.
- **Age rating / audience:** the published Terms state 13+ and not directed to under-13s. Complete the current App Store Connect questionnaire against the submitted features. Do not select Kids unless the app is specifically designed for children and meets that category’s rules.
- **Review contact:** enter a person’s name, monitored email, and phone number in international format.
- **Review login:** public sharing, Discover, and classes are disabled in the initial release. Provide a non-expiring reviewer account only if review of cloud or Premium features requires sign-in. Do not put credentials in this repository.
- **Store subscription setup:** the product IDs, subscription group, entitlement, and RevenueCat offering exist. Both App Store products still show **Missing Metadata**; prices, localizations, annual trial, and sandbox purchase/restore behavior are not ready.
- **Review device/OS list:** fill in only after the release build has been exercised on the listed devices and OS versions.

## App Review notes draft

StudyBolt turns a learner’s PDF, PowerPoint, or notes file into an offline-ready Study Pack with notes, flashcards, quizzes, and audio review. It also includes planning, focus sessions, progress insights, and widgets. Public sharing, shared-pack links, Discover, and community classes are disabled in this initial release.

To explore without creating an account, choose the guest/sample path and open the Biology demo. This exercises local study tools without requiring a document upload. File processing and cloud AI require sign-in, internet access, and the configured production services. Before upload, the app explains the AI processing and asks the learner to agree. On-device AI is device-dependent; StudyCast narration uses device text-to-speech voices and does not require microphone access.

Premium checkout remains disabled by the legal approval flag. Even after the operator approves the policies, the App Store products need their missing metadata before Premium can be purchased. If checkout remains gated in the review build, reviewers can explore the Biology sample and should not expect to purchase Premium.

**Before pasting these notes:** confirm the release build’s cloud services and legal gate, add reviewer access if needed, and provide the actual device/OS test information.

## Screenshots

No App Store screenshots are present in the repository. Capture actual screens from the release candidate; do not use mockups that imply features or content absent from the binary. Suggested sequence:

1. Home / Study Focus — “Know what to study next”
2. Study Pack notes — “Turn lectures into clear notes”
3. Flashcards and quiz — “Practice with active recall”
4. Planner — “Build a plan around your deadline”
5. StudyCast — “Review with audio, anywhere”

Upload at least one screenshot for the supported iPhone display class in App Store Connect, and add iPad screenshots for the iPad experience as required by the selected listing/device configuration. App previews are optional.
