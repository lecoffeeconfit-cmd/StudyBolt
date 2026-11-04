# StudyBolt onboarding upgrade

## Product decision

Replace the three passive feature slides with an optional welcome and a real active-recall sample. A student can select their own files immediately, try one bundled Biology flashcard, sign in, or explore the app. Returning users keep their existing completion state; the tour can still be replayed from Profile.

The intended retention mechanism is a useful first action and a clear next step. Increased activation or return rates are hypotheses until measured with actual users.

## User journey

- **Choose my files** uses the same picker and batch validation as Home, then opens the existing class-name / processing screen. Native picker cancellation leaves the tour open. Invalid files show the existing validation message. On web, guests see **Sign in to add my material** before file selection because provider sign-in reloads the page and cannot retain browser File objects. After signing in, the existing Home import card is the next action. The welcome explains sign-in, connectivity and plan requirements. Subscription limits and generation continue through existing services.
- **Try a quick sample** shows an actual question and source from the bundled Biology study pack. The student recalls an answer, reveals it, and can open the sample flashcards as the primary next action or choose their own files. Restarting the demo hides the answer again. The embedded reveal does not save scores, mastery, streaks or other academic progress, and makes no AI calls.
- **Sign in** is immediately available to returning users. No reminder permission or subscription prompt was added to onboarding.
- **Explore on my own** marks the introduction complete and opens the existing app.
- Account study category is optional and described accurately as a Profile field. Completion still uses the existing account metadata update. The selected processing task and entered class name survive the in-session sign-in and account-setup flow.
- Leaving sign-in as a guest cancels a pending import and returns to the app, rather than immediately reopening an import that requires sign-in. A cancelled processing screen also checks that it is still mounted after token lookup, before starting an upload.

## Implementation boundaries

`useStudyMaterialPicker` extracts Home's existing selection behavior for reuse. It owns cancellation, duplicate-opening prevention, validation and picker errors. It does not upload or process documents.

The bundled sample is explicitly identified as demo content. If it was removed locally, opening the sample restores it under a free ID. A collision cannot replace a student's document.

The tour uses existing light/dark theme tokens, a mode switch, responsive scrolling layouts, large controls, accessible labels and answer announcements, and a short entrance transition that respects Reduce Motion. Small accent text and the main actions use darker brand shades in light mode for contrast. Category radios expose checked state on web and native. Primary button labels can wrap instead of overflowing at larger text sizes. On narrow displays the two useful actions precede the decorative toolkit preview.

No backend, database, subscription products or legal-approval settings are changed.

## Evidence informing the design

- Apple Human Interface Guidelines: keep onboarding fast, optional, and grounded in experiencing the app: https://developer.apple.com/design/human-interface-guidelines/onboarding
- Roediger & Karpicke (2006), *Test-Enhanced Learning*: retrieval practice improved delayed retention in the study. This supports demonstrating recall; it does not establish a measured retention lift for StudyBolt: https://doi.org/10.1111/j.1467-9280.2006.01693.x

## Verification and limitations

Verified locally on November 2, 2026:

- 52 focused onboarding, Home upload, Home study/dashboard and Today's Plan tests passed. Sample selection/restoration coverage includes removed demos, personal-material collisions, free IDs, reuse and non-mutation.
- TypeScript, `git diff --check`, and Expo exports for iOS, Android and web passed.
- Browser checks covered 320- and 390-pixel phone layouts and the 1280-pixel desktop layout, light/dark themes, welcome, sample reveal/source, restarting with the answer hidden, opening the actual sample flashcards, skipping, replay from Settings, and completion persistence after reload.
- The shared Home picker selected a harmless local text fixture, opened the class-name step, stopped at the unauthenticated processing gate, and returned to the app when sign-in was declined. No document was sent for processing.
- An isolated local component fixture verified category selection/clearing, continuing without a category, recoverable save errors, retry, selected-category completion and the web radio's checked state. Its completion callback was simulated; it did not update a real account. Temporary fixtures were removed.

Remaining device checks: real Apple/Google/email sign-in and account metadata saving with a sandbox account, a real authenticated upload/account-setup round trip, VoiceOver/TalkBack focus and announcements, accessibility text sizes, Reduce Motion, and native system-picker cancellation. These are not proven by JavaScript export success. Pending imports elsewhere in the app still live in memory; persisted binary resumption after a browser reload or process termination is not claimed. The new guest web onboarding avoids selecting files before OAuth for this reason.

For later evaluation, use first completed personal import, first meaningful practice, and return for a due review as the primary outcomes. The embedded demo reveal is not academic progress. No analytics SDK or additional data collection was introduced for this change.
