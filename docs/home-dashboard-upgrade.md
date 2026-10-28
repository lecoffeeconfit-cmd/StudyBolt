# Home dashboard upgrade

## Result

Home keeps StudyBolt’s branding, illustrated Study Now hero, blue-purple action, theme toggle, bottom navigation, file importer, focus timer, sample material access, Cram and Saved tools. It adds an understandable next action, source-backed priorities, an Upcoming Exam card, the four requested Quick Start actions, and Recent Activity. The import card remains the existing component. Home no longer presents seeded sample counts or blended mastery estimates as the student’s academic progress.

All recommendation calculations run locally over the existing saved state. There are no new network requests, paid AI integrations, packages, database migrations, or backend requirements. Nothing was deployed, published, or submitted.

## What each number means

| Display | Source and rule |
| --- | --- |
| Due reviews | Imported-pack flashcards with recorded review evidence and a due date at or before now. Standard mode uses the existing analytics interval: last review plus 0, 1 or 7 calendar days for New, Learning or Known. FSRS/SM-2 reuse `getRetentionCardSchedule` and require `hasEvidence`. Unreviewed cards are available through Flashcards and are excluded from this count. |
| Weak topics | Recorded completed quiz answers linked to a real source section. The most recent five sessions for each section must contain at least three distinct source question IDs across at least two sessions, with fewer than 60% correct. One miss, one session or manually selected card confidence cannot establish a weak topic. |
| Mistakes to revisit | Unique source questions supported by the existing Mistake Notebook, missed at least twice, with the latest recorded answer still incorrect. A correct retry removes the item from Home’s active list. The notebook opened from Home is scoped to that list. |
| Estimated duration | A labeled estimate based on the selected batch: approximately 0.75 minutes per due flashcard or 1.4 minutes per adaptive prompt. No duration is invented for listening resumes, notebook review or material selection. |
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

Due ties and topic ties have stable ID tie-breakers. The explanation appears beside each recommendation. Quick Start uses the existing Exam Mode setup, Mistake Notebook, flashcards and Library routes. No substitute pages or fake buttons were created.

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
- Existing Home evidence/resume tests were retained and run with the new tests.
- TypeScript and whitespace checks passed.
- Expo web export passed.
- Browser checks: narrow-screen Home, honest zero-count/sample states, Weak Topics explanation sheet, theme switching in light/dark mode, Library navigation and the Upcoming Exam link to Planner.

## Remaining limits

- Existing Planner supports one active exam plan. This upgrade does not add an exam calendar or multiple-exam storage.
- Older deadlines have no recorded provenance. Re-save an actual test date in Planner once to make it an Upcoming Exam; seeded/general deadlines are intentionally not promoted automatically.
- Only Summary StudyCast has persisted resume information. Quiz/adaptive-session drafts are not currently persisted, so Home does not claim those can resume.
- Plan blocks do not enumerate their individual concepts. Exam progress therefore uses actual task counts and does not invent “concepts remaining.” Plan completion reflects the student’s saved checkmarks.
- A mixed adaptive session can create one persisted quiz record per pack. Recent Activity identifies the saved completion records; it does not infer a total count of distinct cross-pack sessions.
- Native iOS/Android device performance, OS-level font/reduced-motion settings, and full signed-in end-to-end workflows still need device QA. Browser checks and selector tests are not a substitute for that release step.
