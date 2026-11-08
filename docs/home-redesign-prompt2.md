# Home and Today's Plan — Prompt 2 implementation

Date: 3 November 2026
Baseline: 0f697ed, branch codex/backend-production-readiness. The worktree was clean before this implementation.

## Summary and design review

Home now follows a compact welcome → Today's Plan → upload → learning progress → recent materials hierarchy. Existing exam planning, quick study actions, saved items, listening continuation and Pomodoro remain available beneath it.

Today's Plan leads with an actual task, source and reason. The large decorative hero, continuous illustration motion and layered panels were replaced with a restrained surface, readable text, a distinct action and expandable priority details. Light and dark themes retain StudyBolt's blue, gold and neutral identity. File-type badges retain their distinct colors.

Four design perspectives:
- Apple: clearer hierarchy, fewer competing surfaces, consistent radii, readable type and bounded motion.
- Meta: useful completed-work feedback, easy continuation, optional further practice after a dated plan is complete, no streak pressure.
- Google: explicit action labels, preserved routes, clear file limits, keyboard focus treatment, adaptive wrapping and recovery states.
- Learning science: recommendations use recorded quiz evidence and review dates; observed work and manually completed plan tasks are distinguished from mastery.

This is a subjective design improvement, not a demonstrated 9.5/10 score, retention lift or learning-outcome claim.

## Before and after

| Before | After |
| --- | --- |
| Generic Study Now hero and illustration precede the task | Specific recommended task and supporting evidence lead |
| Saved audio always outranks learning priorities | Quiz weaknesses/repeated misses, due reviews and an entered exam precede audio; a separate listening continuation remains available |
| Outstanding-work counts can be mistaken for today's progress | Priority counts are explicitly separate from today's recorded work and dated plan completion |
| Recent packs sorted by creation time, below several other sections | Recent personal material uses valid study activity when available and appears after progress |
| Large multicolor nested upload surface | One restrained upload card, colored format badges, comfortable button padding |
| Small supporting text and repeated prominent tool panels | Larger supporting text, compact secondary controls and disclosed detail |
| No explicit state for a pack whose study tools are unavailable | The existing pack destination exposes generation progress/retry controls |

## Recommendation behavior and sources

Pure Home selectors read existing application state. No AI request, backend operation or persistence write was added.

Order:
1. Confirmed weak topic from repeated quiz evidence.
2. Repeated missed questions whose latest recorded answer remains incorrect.
3. Scheduled due reviews.
4. Practice scoped to the existing, valid, entered exam.
5. An existing resumable Summary StudyCast position.
6. Practice or notes from relevant recent personal material.
7. Open an existing pack if usable notes/cards are not available yet.
8. Add material when no personal pack exists.

Weak-topic thresholds, standard/advanced review schedules and existing question identity rules are preserved. Smart Study's existing eight-prompt default and estimates are preserved. Due-review actions retain the existing ten-card subset. A missed-question recommendation opens the existing notebook; its text explains that further checking uses the pack quiz.

Today’s counts:
- Distinct source cards reviewed on the student's local calendar day.
- Correct/total valid quiz answers, attributed to each answer's timestamp when available.
- Quiz sessions completed today; completed listening and focus sessions are described separately.
- Completed/total existing plan blocks dated today, only when the plan scope resolves to personal material.
- No demo, seed, deleted-pack, invalid-date or future-event performance is introduced.

A completed plan means its existing dated blocks were marked complete. It does not mean every due review is complete, a subject is mastered, or an exam outcome is predicted. Where there is no dated plan, the UI does not invent a plan percentage.

## State handling

- New/demo-only user: no personal statistics; clear upload action and labeled sample materials.
- Personal material with little history: baseline practice/notes; no invented weak-topic or mastery result.
- Existing work: deterministic recommendation with source, reason and destination.
- Pending/failed study tools: open existing pack status; no processing contract changed.
- Completed dated plan: completion acknowledgment and an explicitly optional next recommendation.
- Opening action: duplicate activation guard and loading state; recoverable inline error.
- Picker/generation errors: existing selection validation and material-status handling preserved.
- Hydration: existing navigator loading gate remains responsible for loading local state.
- A storage-read failure cannot currently be distinguished from initial state by Home; exposing that would require a separate persistence/error contract change.

## Files modified

| File | Purpose |
| --- | --- |
| src/screens/HomeScreen.tsx | Greeting, hierarchy, recent material presentation, accessible Library action, listening continuation, existing action dispatch |
| src/components/TodaysPlanCard.tsx | Task-first card, priority disclosure, dated-plan progress, action/error states, bounded accessible motion |
| src/components/AddStudyMaterialCard.tsx | Restrained upload presentation, readable colored file badges, original selection/drop/status controls |
| src/components/HomeLearningCards.tsx | Recorded daily progress, expandable activity, clearer exam task completion language |
| src/services/homeDashboard.ts | Pure daily/recent selectors, deterministic priority order and existing-pack fallback |
| src/services/todaysPlan.ts | Task presentation and truthful daily-plan completion description |
| tests/homeDashboard.test.mjs | Priority, date, attribution, sample exclusion, available-tool and recent-material regression coverage |
| tests/todaysPlan.test.mjs | Completed-plan and unavailable-tool presentation contracts |
| docs/home-redesign-prompt2.md | Implementation evidence, limits and handoff |

## Functionality preserved

Source review and unchanged protected-file diffs confirm:
- Existing route names and parameters, navigator and Home prop callbacks.
- File picker/drop callbacks, formats, 20 MB limit, multiple-PowerPoint rules and errors.
- Generation counts, progress/retry destinations and partial-tool state handling.
- Exact due-card and weak-topic destinations, exam entry, Library, Stats, Settings, saved items and cram review.
- Authentication/account management, RevenueCat, cloud processing, tutoring and playback services.
- Flashcard/quiz records, persistence, schedules and planner state.
- Home Pomodoro behavior and notification handling.
- Production configuration, Supabase, schemas, migrations, API contracts and community restrictions.

No dependencies were installed. No commit, deployment, published update or store submission was made.

## Verification

Baseline: TypeScript and all 112 existing Node tests passed; no baseline failures found.

Final checks:
- TypeScript: passed.
- Node suite: 121/121 passed, including nine added regression cases.
- Relevant Home tests: passed as part of the full suite.
- git diff --check: passed.
- Web and iOS JavaScript exports: passed. These are local bundles, not native device builds.
- ESLint: no configured script/tooling in the project; none installed.
- Dedicated component/navigation test runner: none configured; none installed.
- Hosted database, production integration and native store tests: not run.

Browser checks on the local exported app:
- First-use Home at 390 × 844 in light and dark mode.
- Narrow 320 × 740 layout in dark mode, including upload button/icon padding and readable progress content.
- Wider 768 px DOM has no horizontal document overflow; native tablet layout remains unverified.
- Profile icon opens Settings; planner and Library links reach their expected tabs.
- Learning progress opens Stats; Flashcards opens the correct personal-material empty state.
- Final local preview screenshots: /private/tmp/studybolt-home-light.jpg and /private/tmp/studybolt-home-dark.jpg.
- Browser viewport override reset and temporary preview server stopped.

## Remaining verification and limitations

- Native iPhone/iPad rendering, Dynamic Type, VoiceOver/TalkBack, reduced-motion behavior and frame pacing require device verification.
- Returning-user card rendering, actual practice/review completion and live generation retries have selector coverage but were not manually exercised with a student's private material.
- Native picker/drop uploads, cloud AI, StudyCast playback, purchases and account deletion were not invoked.
- Estimates remain estimates; no predicted grade, fabricated deadline, mastery percentage or daily target was added.
- Study data remains local. No cloud synchronization was added.
- The existing global Stats/Library sample and mastery consistency findings from Prompt 1 remain outside this Home implementation.
- Existing storage persistence silently recovers some failures; no new persistence behavior was introduced.

## Deferred dependencies and Prompt 3 priorities

Separate backend/data approval is needed for cross-device synchronization, external calendar/LMS deadlines, multi-device study history and new production analytics contracts.

Prompt 3 should prioritize:
1. Truthful sample-versus-personal presentation and consistent mastery/coverage labels in Stats and Library.
2. Shared readable typography, text contrast, control semantics and modal focus across the remaining screens.
3. Study Pack overview hierarchy, non-interactive chevrons and material-type wording.
4. Clear tutor fallback/teach-back labels and StudyCast capability presentation, preserving their integrations.
5. Progressive disclosure of Exam Mode and Settings controls, preserving their actual settings and state.
