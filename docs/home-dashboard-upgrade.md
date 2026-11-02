# Home dashboard upgrade

## Today’s Plan refinement — 1 November 2026

Today’s Plan now combines the illustrated Study Now hero with tappable due reviews, weak topics and missed-question shortcuts, followed by one specific Next Up recommendation. The recommendation includes its source class/pack, a practical recall tip, the size of the next review set or default practice setup, and an exam countdown only when that exam belongs to the recommended material. A compact count tile labels work in the next set; it does not claim completion, grades, or a probability of passing. Notes-only and StudyCast actions retain their own labels, and new students see a real Add course material action without invented counts.

The header opens the existing Planner. Actions reuse the existing Home recommendation routes. `getTodaysPlanFocus` is a pure presentation selector; this change does not alter saved progress, recommendation ordering, study-session construction, or backend behavior. The card now follows StudyBolt’s existing blue, gold, and neutral theme surfaces. A blue book/gold bolt scene, three simple priority tiles, a focused blue Next Up panel, and a solid readable primary action replace the earlier multicolor border, waves, and ring. Typography and card radii align with the surrounding Home UI. Both themes, narrow-screen stacking, and keyboard focus styling use the existing app colors. The artwork floats for three gentle cycles, stops in the background, and respects Reduce Motion.

Validation: 37 focused Home/presentation tests passed, along with TypeScript and whitespace checks. The actual component was rendered in a temporary local web preview at 310, 350 and 520-point card widths, including light/dark pairs beside the existing upload card, due/weak-topic recommendations, and first-time states. Planner, priority and session callbacks were exercised in that preview. Native device and full signed-in navigation QA remain release checks. Preview fixtures were not stored as user data and were removed after inspection.

## Result

Home keeps StudyBolt’s branding, illustrated Study Now hero, blue-purple action, theme toggle, bottom navigation, file importer, focus timer, sample material access, Cram and Saved tools. It presents an understandable next action, source-backed priorities, an Upcoming Exam card, the four requested Quick Start actions, and Recent Learning Progress. A separate Upload & Create card now sits directly below the Study Now hero and above Upcoming Exam. There is one upload area. Returning students keep their recommended study action in the hero; students without imported material see a compact hero and a highlighted Start Here / Choose Files action below it. Home excludes seeded sample counts and blended mastery estimates from the student’s academic progress.

All recommendation calculations run locally over the existing saved state. There are no new network requests, paid AI integrations, packages, database migrations, or backend requirements. Nothing was deployed, published, or submitted.

## Upload & Create addition — 29 October 2026

The Home order is now header/greeting → Today's Plan / Study Now → Upload & Create → Upcoming Exam → Quick Start → Recent Learning Progress. The existing focus timer, recent/sample material access, Cram and Saved shortcuts follow those sections. The hero now displays the recommendation's real title and reason. The new-user hero uses a short setup explanation instead of an empty priority grid; the upload card becomes the strongest action. Returning students retain the personalized session action as the primary hero control.

Upload & Create uses a compact blue-purple rounded card, a Home-specific vector cloud/upload illustration, a visible dashed selection area, supported-format labels, an actual Choose Files button, and previews of notes, flashcards and practice quizzes. Wider layouts place the button beside the file-selection explanation. Narrow screens and large text stack naturally. Keyboard focus, screen-reader labels, 48-point selection targets, light/dark colors and bounded reduced-motion-aware animation are included.

### Integration and truthful states

- Choose Files calls Home's existing Expo document picker with the existing picker options. Both selections and browser drops call the existing `validateImportBatch` and then the unchanged `onImport(assets)` route. The shared validator enforces actual file types, the 20 MB per-file maximum, empty-file rejection, and the rule that multi-file selections must all be PowerPoints.
- Browser drag-and-drop is limited to this Home selection area. It retains the browser File Blob used by the existing web uploader, creates no base64 copy, and revokes its temporary object URLs on rejection or unmount. The native component has no browser APIs.
- Home reports picker opening and preflight errors inline. Cancellation leaves no new pack or success message. Initial uploading, source extraction, class naming, authentication, subscription checks, processing errors and their retries remain on the existing Processing screen.
- On return to Home, `getHomeUploadStatus` reads the saved pack's material statuses against the processor's existing required-tool list. It prioritizes active work, then failures, then completed packs. Queued/generating tools remain in progress; failed or missing statuses never become success. The ready message requires every expected tool to be recorded ready. View progress, Review & retry and Open pack all open the existing source pack and its existing controls.
- No upload service, processor, storage, AI call, navigation route or billing rule was added or changed. Existing deployment, legal-approval and account/plan gates can still prevent cloud processing until configured and approved.

### Files changed for this addition

- `src/screens/HomeScreen.tsx`: layout order, contextual greeting, picker feedback, shared preflight validation, drop integration and status selection.
- `src/components/TodaysPlanCard.tsx`: separate session hero, visible recommendation reason, and compact new-user state.
- `src/components/AddStudyMaterialCard.tsx`: the Upload & Create card and its accessible selection/status controls.
- `src/components/HomeLearningCards.tsx`: Recent Learning Progress label.
- `src/components/HomeFileDropArea.tsx` and `.web.tsx`: Home-only native wrapper/browser file-drop adapter.
- `src/services/homeUpload.ts`: pure saved-generation status selector.
- `tests/homeUpload.test.mjs`: nine status tests covering queued, partial, mixed, failed, missing, completed and immutable state, plus prioritization and demo/legacy exclusions.
- This Home-specific implementation note.

### Validation for this addition

- 37 focused Home tests passed: 17 dashboard, 11 study-evidence/resume, and 9 upload-state checks.
- TypeScript and whitespace checks passed.
- Expo web, iOS and Android bundle exports passed. These verify platform resolution and bundling, not a native installation or live service request.
- Physical-device/VoiceOver/TalkBack, real browser picker/drop interaction, and authenticated end-to-end cloud uploads were not exercised in this turn. Those remain device/browser QA; no test documents were sent to external services.

## What each number means

| Display | Source and rule |
| --- | --- |
| Due reviews | Imported-pack flashcards with recorded review evidence and a due date at or before now. Standard mode uses the existing analytics interval: last review plus 0, 1 or 7 calendar days for New, Learning or Known. FSRS/SM-2 reuse `getRetentionCardSchedule` and require `hasEvidence`. Unreviewed cards are available through Flashcards and are excluded from this count. |
| Weak topics | Recorded completed quiz answers linked to a real source section. The most recent five sessions for each section must contain at least three distinct source question IDs across at least two sessions, with fewer than 60% correct. One miss, one session or manually selected card confidence cannot establish a weak topic. |
| Mistakes to revisit | Unique source questions supported by the existing Mistake Notebook, missed at least twice, with the latest recorded answer still incorrect. A correct retry removes the item from Home’s active list. The notebook opened from Home is scoped to that list. |
| Estimated duration | A labeled estimate based on the selected batch: approximately 0.75 minutes per due flashcard or 1.4 minutes per adaptive prompt, using the existing eight-prompt default and five-minute minimum for adaptive sessions. No duration is invented for listening resumes, notebook review or material selection. |
| Exam date/countdown | Only `plan.exam.date`, saved explicitly by the student in Planner. Calendar-day comparison uses local dates and handles DST. A generated study-window deadline by itself is not treated as an exam. Optional exam titles come from the student’s Planner input. |
| Exam progress | Saved plan blocks marked complete divided by all plan blocks. This measures task completion, not readiness. No percentage is shown for a plan with no blocks. |
| Recent Activity | Valid, nonfuture, nonseeded completed quiz records, actual flashcard reviews, completed StudyCasts and completed focus events. Answer counts use the recorded answers, not a stored summary score. |
| Revisited questions answered correctly | Distinct source questions in that completed record whose preceding recorded answer was incorrect. No inferred mastery gain, improvement percentage or passing probability is displayed. |

Demo packs, seeded events, deleted source packs, skipped answers and invalid/future dates are excluded from Home’s academic evidence. Duplicate event IDs and duplicate answer rows are counted once. Source question IDs join generated variants. Topic names must resolve to actual outline sections.

## Recommendation order

The deterministic order is:

1. Resume a recorded unfinished Summary StudyCast with a valid saved word position.
2. Open unresolved repeatedly missed questions in the existing Mistake Notebook.
3. Start the oldest due review batch in the existing flashcard workflow, filtered to those cards.
4. Practice the lowest-performing sufficiently evidenced topic. Adaptive study is scoped to that pack and source section. Topics without flashcards open the existing notes view.
5. Practice material in the explicitly saved upcoming exam scope.
6. Practice available imported material, or choose/import material when none is ready.

Due ties and topic ties have stable ID tie-breakers. The study action keeps the recommended title and an accessible explanation of why it was chosen. Quick Start uses the existing Exam Mode setup, Mistake Notebook, flashcards and Library routes. No substitute pages or fake buttons were created.

## Files changed for this upgrade

- `src/screens/HomeScreen.tsx`: dashboard composition, real selectors, clock refresh, navigation actions, generation retry notice, honest empty/sample states and contrast improvements.
- `src/components/TodaysPlanCard.tsx`: responsive illustrated hero, tappable priorities, recommendation explanation and actual action.
- `src/components/HomeLearningCards.tsx` **new**: `UpcomingExamCard`, `RecentLearningCard`, `HomePrioritySheet` and private selection rows.
- `src/services/homeDashboard.ts` **new**: pure evidence, recommendation, date, progress and activity selectors.
- `src/models.ts`: optional student-entered `StudyPlan.exam` metadata.
- `src/screens/PlannerScreen.tsx`: save explicit exam provenance and optional test name; preserve it when changing scope or methods, clear it when choosing a new quick study window.
- `src/navigation/routes.ts` and `src/navigation/StudyBoltNavigator.tsx`: minimal optional source filters plus Home links to existing routes.
- `src/screens/StudyPackScreen.tsx`: optional ordered flashcard subset for due reviews; existing review records and editing still operate on the source pack.
- `src/services/adaptiveStudy.ts` and `src/screens/SmartStudyScreen.tsx`: optional source-section filter for targeted practice.
- `src/screens/MistakeNotebookScreen.tsx`: optional item-ID filter for Home’s active mistakes.
- `tests/homeDashboard.test.mjs` **new**: focused selector tests.
- `docs/home-dashboard-upgrade.md` **new**: implementation and validation record.

Existing unrelated workspace changes were not part of this upgrade.

## Accessibility, performance and state handling

The existing app-level hydration/authentication loading state is retained. Home reads saved state, so its priorities and activity do not depend on a fresh network request. Existing import failure feedback is retained; failed material generation links to the source pack’s existing retry controls. Empty states offer real actions.

Selectors are memoized. The local clock refreshes once per minute and on foreground resume. Advanced scheduling is skipped for cards without any review/quiz-section evidence. The isolated timer’s ticks do not recalculate Home’s dashboard. Layouts wrap and stack at narrow widths or larger font scales, preserve safe-area scrolling, and use accessible button labels and source explanations. Entry/press and brief completion highlights respect Reduce Motion; there are no continuous Home animations or confetti.

## Validation

- Focused Node tests cover empty and demo-only state, reviewed versus new cards, standard and advanced due dates, weak-topic evidence thresholds, the exact 60% boundary, duplicates, question attribution, corrected mistakes, recommendation order, exam provenance, zero denominators, DST/leap dates, exam scope, invalid/future records and immutability.
- All 28 focused Home dashboard/evidence/resume tests passed (17 new dashboard tests, 11 retained tests).
- TypeScript and whitespace checks passed.
- Expo web, iOS and Android bundle exports passed.
- Browser checks: narrow-screen Home, honest zero-count/sample states, Weak Topics explanation sheet, theme switching in light/dark mode, Library navigation, Recent Activity navigation to Stats, and the Upcoming Exam link to Planner.

## Remaining limits

- Existing Planner supports one active exam plan. This upgrade does not add an exam calendar or multiple-exam storage.
- Older deadlines have no recorded provenance. Re-save an actual test date in Planner once to make it an Upcoming Exam; seeded/general deadlines are intentionally not promoted automatically.
- Only Summary StudyCast has persisted resume information. Quiz/adaptive-session drafts are not currently persisted, so Home does not claim those can resume.
- Plan blocks do not enumerate their individual concepts. Exam progress therefore uses actual task counts and does not invent “concepts remaining.” Plan completion reflects the student’s saved checkmarks.
- A mixed adaptive session can create one persisted quiz record per pack. Recent Activity identifies the saved completion records; it does not infer a total count of distinct cross-pack sessions.
- Native iOS/Android device performance, OS-level font/reduced-motion settings, and full signed-in end-to-end workflows still need device QA. Browser checks and selector tests are not a substitute for that release step.
