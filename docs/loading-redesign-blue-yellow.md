# StudyBolt yellow + blue loading redesign

Implemented locally on 9 November 2026. This pass changes loading artwork and loading copy only. No app binary was built, uploaded, or deployed.

## Result

Longer waits now use a cohesive illustrated language: calming blue paper and book shapes, warm yellow tabs and lightning accents, soft depth, and restrained motion. Short actions retain a small footprint through a blue/yellow pulse. The approved rounded launch logo remains the startup artwork; the new book illustration is a contextual document/notes graphic, not a replacement logo.

![Light-mode component preview](/Users/howieday/StudyBolt/docs/loading-blue-yellow-light.jpg)

## Loading-state audit and implementation

| Existing context | Presentation after this pass | State handling |
| --- | --- | --- |
| Cold startup, font/Auth/library readiness | Existing rounded official artwork, warmer opening copy, and the new small blue/yellow pulse | Existing readiness, exit, error reveal, and account isolation retained |
| Sign-in and password forms | Shared primary buttons inherit the new compact pulse; confirmation-email sending uses it too. Apple/Google provider artwork and opening labels remain | Existing busy, disabled, and submit handlers retained |
| File picker / Home upload and Today’s Plan actions | Compact pulse in the existing icon slot | Existing picker-opening state retained; no simulated upload |
| PDF, PowerPoint and document processing | Custom open study book, yellow energy accent, and a gently moving note | The existing ProcessingScreen callbacks still supply the actual stage; no processing or request changes |
| Simplified/detailed notes and key concepts | Same study-book illustration with organizing copy | Only the existing confirmed `generating` branch animates |
| Flashcard generation | Three softly layered cards with a yellow tab, slight perspective, and small alignment/float changes | Queued/failed/ready branches and retry handlers retained |
| Quiz generation | Illustrated quiz card with a yellow option and decorative check accent | The check is part of the illustration, not a completion signal; the parent remains an indeterminate progress indicator until the existing ready state |
| StudyCast content generation | Blue/yellow sound bars in a soft headphone/card composition | Decorative movement, not live sound, a real audio measurement, or a claim that content is ready |
| AI Tutor / Study Coach / voice processing | Small blue thought bubble and yellow energy accent; compact pulses stay compact inside inline and voice controls | Request/response, streaming, voice behavior, errors, and retry conditions retained |
| Exam Mode | Compact pulse in the existing grading icon with a meaningful busy label | Existing submission/scoring state and handlers retained; no invented preparation wait |
| Class, shared pack, Discover, support and admin loading | Shared pulses and existing readable messages; existing Discover/shared-pack skeletons remain | Existing loading/error/empty/results conditions retained |
| Stats and course mastery hydration | Small blue/yellow pulse beside the existing progress-loading copy | Existing hydration condition and all statistics calculations retained |
| Narration language/voice options | Compact pulse with “Loading narration options…” | Existing local option loading and empty/error behavior retained |
| Visual study suggestions | Compact blue/yellow indicator and “Preparing a study suggestion…” | Existing request, review/editor, and error/retry controls retained |

No new fullscreen loading state, page, route, class icon, or navigation control was introduced. Other page-presentation edits were already in progress in this shared worktree; this pass preserves them.

## Reusable components

- **New `src/components/StudyBoltLoadingArtwork.tsx`:** `LoadingArtwork` selects the task illustration, uses one shared animation clock, and supplies the private reusable book, flashcard, quiz, audio, thought-bubble, and compact-pulse graphics.
- **Updated `src/components/StudyBoltLoading.tsx`:** keeps the existing public props, progress validation, messages, cancellation control, and accessibility behavior. It imports/re-exports `LoadingArtwork`, so current callers retain the same interface.
- The existing `useLoadingMotion` and `useReducedMotion` hooks are reused without modification. The rounded official-logo component, native splash, startup readiness implementation, and native plugin are unchanged by this pass.

The artwork uses code-based SVG shapes and existing React Native Animated transforms. No runtime raster illustration, remote animation, new service, new package, or animation framework was added. Preview JPEGs live only in documentation and are not imported into the app.

![Dark-mode preview at a narrow phone width](/Users/howieday/StudyBolt/docs/loading-blue-yellow-dark.jpg)

## Files changed by this pass

- New illustration component: `src/components/StudyBoltLoadingArtwork.tsx`.
- Shared loading presentation: `src/components/StudyBoltLoading.tsx`.
- Opening copy only: `src/components/StudyBoltLaunch.tsx`.
- Small loader integrations: `src/components/AddStudyMaterialCard.tsx`, `TodaysPlanCard.tsx`, `LearningMasteryHero.tsx`, `NarrationSettingsSheet.tsx`.
- Small loader integrations: `src/screens/LoginScreen.tsx`, `DiscoverScreen.tsx`, `StatsScreen.tsx`, `VisualReviewScreen.tsx`, `ExamModeScreen.tsx`.
- Generation loading copy only: `src/screens/StudyPackScreen.tsx`.
- This report and `docs/loading-blue-yellow-{light,dark,audio,startup}.jpg`.

Document processing, Tutor, shared packs, class/support/admin screens, and primary buttons pick up the design through their existing shared-component calls. They did not require changes to their functional code.

## Performance and accessibility

- Each artwork has one existing loading-animation clock. Nested illustrations consume that clock rather than adding per-layer timers or React state updates.
- Native platforms use the existing native animation driver for opacity/transforms. SVG paths stay static; there is no JavaScript path morphing, particle simulation, or measured-progress simulation.
- Movement is restrained: a few points of floating, small card angles, a five-degree perspective shift, and gentle sound-bar scaling. No flashing, spinning, full flips, or bouncing sequence was added.
- The existing hooks start with motion disabled until the preference is known, stop motion for Reduce Motion/backgrounding, and clean up listeners/loops on unmount. Static illustrations remain fully readable.
- Loading elements still mount under the existing real busy/generating conditions and disappear through the existing success/error/cancellation branches. The artwork adds no wait or completion callback.
- Illustrations are hidden from screen readers. Status text, busy/progress semantics, real progress values when supplied, and existing cancellation controls remain. Exam grading gets an explicit accessible busy label in its small indicator slot.
- Text scales through the existing React Native text settings and has no new fixed-height clipping. Light/dark palettes use the app’s existing text/surface colors with blue/yellow illustration accents.

## Validation

| Check | Result |
| --- | --- |
| Baseline | Existing TypeScript and 173 tests passed before implementation. |
| Existing automated suite | PASS: 173 tests. No tests were added that merely mirror the illustration implementation. |
| App source TypeScript | PASS when excluding only `remainingUiPreview.tsx`, an unrelated temporary preview introduced concurrently. |
| Full workspace TypeScript | Still reports one unrelated error at `remainingUiPreview.tsx:71`: `accessibilityRole="status"` is not a supported React Native accessibility role. That other preview was preserved. No loading-artwork or app-source type error was reported. |
| Diff check | PASS. No dependency, backend, Auth service, subscription service, document-processing service, navigation, native launch resource, or branding-asset change belongs to this pass. |
| Visual component preview | Inspected actual shared components in light mode at 390 CSS pixels and dark mode at 319 CSS pixels. No horizontal overflow or console errors. Document/book, cards, quiz, audio, Tutor, generic and compact/button contexts were inspected. |
| Motion | Browser-computed card transform matrices changed between observations. This confirms the preview was animated; it is not a native FPS measurement. |
| Startup | Approved source logo loaded in the preview. Triggering the existing readiness prop removed the startup title/overlay. No readiness logic was changed. |
| Error/retry/cancel preservation | Source/diff review confirms existing handlers and loading-to-error/success conditions remain; live API failure and cancellation scenarios were not executed. |
| ESLint | Not available: this repository has no installed lint command/configuration. No package was installed. |
| Native device / TestFlight | Not tested by this pass; no native build was created. |

The local gallery was temporary, did not make upload/purchase/API calls, and was removed. Its preview server was stopped. A separate preview belonging to concurrent work was left intact.

![StudyCast and Tutor preview](/Users/howieday/StudyBolt/docs/loading-blue-yellow-audio.jpg)

## Manual device verification remaining

1. On a supported iPhone, inspect the book/card/quiz/audio graphics in both appearances and at large text sizes. Verify Reduce Motion and VoiceOver.
2. Check a successful and failed PDF/PowerPoint import, cancellation during a request, and the existing retry path. Status labels must continue following actual callbacks.
3. Check queued, generating, ready, and failed/retry states for notes, flashcards, quizzes and StudyCast. Confirm ordinary audio playback remains distinct from the generation illustration.
4. Request a Tutor response, close its sheet, retry an error, and inspect voice processing. Existing conversation and playback controls must remain usable.
5. Check sign-in, file picker, stats hydration, narration options, visual suggestions, Exam Mode grading, and shared-data loading on-device. Verify that small indicators fit their controls and remain accessible.
6. On an older supported iPhone, measure smoothness, battery/memory behavior, background pause and cold-start responsiveness. No measured native performance result is claimed here.

Resolve the unrelated temporary preview’s accessibility-role error (or remove that temporary preview through its owning task) before relying on a full-workspace TypeScript pass. Native visual verification can use a future explicitly approved TestFlight build.
