# StudyBolt launch and loading experience

Implemented 7 November 2026. Frontend and native launch presentation only. Native release behavior and real-device performance require a future approved TestFlight build; no binary was built or uploaded by this task.

## Rounded-artwork refinement

The launch now crops the flat PNG to the artwork's actual rounded square, removing the surrounding rectangular background. `src/config/launchArtwork.json` defines one shared crop (80, 68, 1094, 1070) and corner radius for React and the native launch resources. The image keeps its original proportions and original pixels; the official icon file is unchanged.

Motion now includes a 3-point whole-artwork float, a slow traveling highlight along the existing energy trail, softly moving blue/gold arcs, two small star accents, and blue/gold light washes. The wordmark has a restrained two-color accent. These remain decorative and stop with reduced motion/backgrounding. Readiness still immediately starts the existing short exit; there is no extra startup wait.

The native storyboard uses a cropped UIKit image and tiny light/dark SVG corner covers. It deliberately avoids runtime attributes, which [Apple disallows in launch storyboards](https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen). The generated native PNG remains byte-for-byte identical to the original asset. A third image set, `StudyBoltLaunchCorners.imageset`, supplies the small vector covers. Native rendering of these resources still requires the future approved device build.

The revised component was previewed at a measured 390-pixel phone width with no horizontal overflow or console errors. Triggering readiness removed the launch overlay. The configuration tests also verify the shared crop resources, light/dark covers, resolved storyboard dimensions, and absence of unsupported runtime attributes.

## What students see

The approved StudyBolt artwork is centered on a spacious background matching the system's light or dark appearance. The golden bolt, open book, blue/gold trails, and day/night composition remain intact inside the rounded display crop. A whole-image settle and float, softly moving blue/gold light, and highlights over the bolt and existing trail bring the artwork to life. The wordmark and a short opening message sit underneath.

The image is a flattened asset. The implementation does not claim to animate independent book pages, the sun, moon, or bolt. The highlights are explicitly traced overlays over the intact image. `assets/icon.png` and the official App Store icon have not been edited. The native launch resource is byte-for-byte identical to the approved image.

![Local browser launch preview](/Users/howieday/StudyBolt/docs/launch-preview.jpg)

## Startup and native handoff

1. The iOS storyboard displays the approved logo at 192 points, centered on a named light/dark background.
2. The existing React Native factory presents that same static storyboard as its loading view until React content mounts. Both the installed React Native 0.86 surface-hosting class and legacy root-view path are handled.
3. A single React overlay is present from the first App render, before icon-font loading. Auth still mounts after the font load settles, as before.
4. After sign-in restoration, the existing account-scoped provider loads the saved library. A new optional presentation callback reports hydration success **or the existing storage-error screen**. Thus the overlay cannot cover that retry screen indefinitely.
5. Actual readiness interrupts the effects. There is no minimum display time. The exit is at most a 180 ms visual fade when motion is allowed, and immediate with reduced motion. The overlay never captures touch input and unmounts after exiting.

The root's launch state is not keyed to routes, tabs, accounts, or foreground events. Ordinary navigation and account changes retain the existing compact loading paths and do not replay the cold-launch overlay. Account remounting, deep-link routing, Auth operations, persistence reads/writes, and recovery navigation retain their existing logic.

The iOS resource writer is registered as a local Expo config plugin so a future prebuild preserves the setup. No dependency, native module, Expo signing setting, backend URL, environment variable, or production service was added or changed by this task. The Android React experience uses the same components; Android's native platform splash remains the existing platform icon behavior and needs its own device check.

## Reusable loading states

`StudyBoltLoading` accepts a variant, colors, status message, optional detail, optional **confirmed** progress (0–1), compact layout, and an optional existing cancel callback. Invalid or omitted progress stays indeterminate. No product call site supplies an invented percentage.

| Variant | Implemented presentation and actual state connection |
| --- | --- |
| `initialLaunch` | Approved logo artwork; the dedicated launch overlay coordinates real startup readiness. |
| `documentProcessing` | Quiet document layers. Processing labels use only the existing `validating`, `uploading`, and `finalizing` callbacks. An in-flight request does not claim that the server is reading or generating a particular stage. The existing elapsed clock provides a longer-wait message after 30 seconds. |
| `flashcardGeneration` | Small organizing card stack, mounted only for a material whose status is `generating`. |
| `quizGeneration` | A question/check card, mounted only during confirmed generation. |
| `studyCastGeneration` | Decorative waveform while StudyCast content is generated. It is not a live signal or a claim that audio is ready. Existing playback and voice-session behavior are preserved. No separate buffering state was invented where the player exposes none. |
| `aiTutorThinking` | Small animated dots in the Tutor sheet, Study Coach request, and existing voice-processing state. Existing answers, request handlers, and error/retry controls are retained. |
| `screenLoading` | Dots with a readable status for saved-space loading, shared packs, class/support/admin data, and other existing screen waits. |
| `inlineLoading` | Compact dots in the shared primary button and inline status areas. Small operations do not invoke a fullscreen overlay. |

Queued tools show a static clock and waiting text. Failed tools retain the existing retry control and error details. Ready tools render through the existing material gate. The progress banner counts real completed tools; it no longer labels an incomplete set of tools as fully ready. Existing Discover skeletons remain, with a readable loading status.

![Local browser component gallery in dark mode](/Users/howieday/StudyBolt/docs/loading-preview-dark.jpg)

## Accessibility and performance

- Reduced motion starts enabled until the device preference has been read. A failed preference read leaves motion disabled. Artwork remains recognizable and statuses remain readable without animation.
- Loaders expose progress/busy semantics and meaningful text. Android/web receive polite live regions; meaningful noncompact loading messages and completed tool generation receive iOS announcements. Decorative layers are excluded from accessibility.
- The opening overlay hides the not-yet-ready app from accessibility, then releases it on dismissal. It does not create a modal focus trap.
- Opacity and transforms use React Native Animated's native driver on native platforms. SVG geometry is static; no per-frame path construction or particle simulation runs on JavaScript.
- Motion pauses while the app is inactive/backgrounded. Loops stop and listeners are removed on unmount. Animations are marked noninteractive so they do not hold up list rendering.
- Existing dependencies only: React Native Animated, `react-native-svg`, and Expo's existing status-bar/font support. No Lottie, Reanimated setup, video, GIF, remote artwork, or frame atlas was introduced.
- The existing approved PNG is about 1.7 MB. JavaScript reuses it directly; native launch uses a matching resource copy. No additional illustration or animation-image sequence was generated. The decoded image and actual frame rate have not been profiled on an older iPhone.

## Files in this change

New components: `src/components/StudyBoltBrand.tsx`, `StudyBoltLaunch.tsx`, `StudyBoltLoading.tsx`. New hook: `src/hooks/useLoadingMotion.ts`. Reduced-motion handling updated in `src/hooks/useReducedMotion.ts`.

Startup integration: `App.tsx`, `src/StudyBoltContext.tsx` (optional readiness callback only), `src/navigation/StudyBoltNavigator.tsx` (loading presentation only).

Loading presentation integrations: `src/components/ui.tsx`, `StudyCastSheets.tsx`, `StudyPackGenerationProgress.tsx`; screens `ProcessingScreen.tsx`, `StudyPackScreen.tsx`, `FeedbackScreen.tsx`, `AdminScreen.tsx`, `CommunityClassScreen.tsx`, `SharedStudyPackScreen.tsx`, `DiscoverScreen.tsx`, and `PremiumScreen.tsx`.

Native presentation: `plugins/withStudyBoltLaunchScreen.js`, `plugins/launch/SplashScreen.storyboard`, its plugin registration in `app.json`, `ios/StudyBolt/AppDelegate.swift`, `ios/StudyBolt/SplashScreen.storyboard`, and the two new `StudyBoltLaunch*` asset-catalog sets. Tests: `tests/launchConfiguration.test.mjs`. Evidence: this report and the two preview JPEGs.

The worktree already contained extensive product/backend changes and continued receiving unrelated mastery/statistics work during this task. Those changes were preserved and are not claimed as part of this implementation.

## Verification

| Check | Result |
| --- | --- |
| Baseline | TypeScript and 148 tests passed before this work. |
| Final TypeScript | PASS. A transient error in concurrent mastery work was resolved in that work; the final shared workspace check is clean. |
| Automated tests | PASS: 170 current workspace tests, including 3 new native-launch configuration tests. They verify repeat-prebuild safety, refusal to overwrite unrelated native customizations, and that a clean setup contains the exact referenced artwork and light/dark resources. |
| Native source/resource checks | Swift syntax parsing and storyboard XML parsing passed. Native logo hash matches `assets/icon.png`. Config customization is idempotent. This is not an iOS compile. |
| Local UI preview | Actual components inspected in a development-only browser gallery at a measured 390 CSS-pixel width. Light/dark loading layouts showed no horizontal overflow; no console errors. The readiness control removed the launch title/overlay. Temporary preview entry and page were removed afterward. |
| Startup preservation review | Font/error fallback, Auth mount sequence, account keys, provider hydration, storage-error reveal, and navigation loading branches inspected. No automated React lifecycle test suite is installed; native signed-in/offline lifecycle behavior remains untested. |
| Diff checks | PASS. Official icon/branding files have no diff. Scope reviewed against existing uncommitted work. |
| ESLint | NOT RUN: no installed ESLint command/configuration exists in this repository. No dependency was installed. |
| iOS simulator | NOT TESTED: the available CoreSimulator service/runtime could not be reached in this environment. No simulator app was built. |
| Real device / TestFlight / older iPhone FPS | NOT TESTED. |

## Required manual TestFlight checks

Use a future explicitly approved build containing the new native resources; the existing TestFlight binary cannot demonstrate a changed native storyboard.

1. Cold-launch signed out and signed in. Confirm there is no blank flash, logo jump, or extra waiting after the app is ready. Check the recovery/deep-link route too.
2. Repeat with system light/dark mode, a different saved app theme, large text, VoiceOver, and Reduce Motion. Confirm the static option and announcements are usable.
3. Launch offline/with slow connectivity. Exercise the saved-library read-error/retry path with a disposable local fixture; the retry screen must remain reachable.
4. Navigate between tabs, return from background, sign out, and switch accounts. The full launch sequence must not replay during ordinary navigation; private content must remain isolated.
5. Import a PDF and a PowerPoint. Check genuine stages, long-wait copy, success, existing cancellation, and existing failure/retry behavior.
6. Exercise queued → generating → ready and failed → retry for flashcards, quizzes, and StudyCast. Existing content must replace the loader only when ready. Normal playback must retain its own presentation.
7. Request a Tutor answer, receive a response, trigger a retryable error, and close/reopen the sheet. Confirm playback and conversation controls remain usable.
8. On an older supported iPhone, inspect cold-start time, animation smoothness, background pause, memory, and touch responsiveness. A 60 FPS target is an engineering objective, not a measured result of this task.

## Simulated design critique

Subjective desk review, not user research or an Apple/Meta/Instagram endorsement: **8/10** overall. Apple lens: clear hierarchy, real readiness, accessible calm fallback. Instagram lens: recognizable original artwork with controlled light effects. Meta lens: meaningful state feedback and no artificial waiting. The remaining confidence gap is native cold-launch/device performance and usability testing; no objective 9.5/10 claim is made.

Reference for the native/static-to-React separation and release-build verification: [Expo SDK 57 splash-screen guidance](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/). This implementation uses the existing React Native root loading-view API instead of adding that optional library.
