**StudyBolt — Today’s Plan card redesign**

November 9, 2026. Updated only Today’s Plan and its local presentation helpers. Home’s other sections, Stats, class icons/mapping, navigation, backend, subscriptions, and stored-data formats are preserved. This is a local implementation for device QA; no build or deployment was submitted.

**Design delivered**

A soft blue wash sits inside a thin blue-and-yellow gradient frame with an inset border, rounded corners, and a restrained shadow. A small book-and-lightning graphic anchors the header. The existing Planner button stays available. The requested exam-readiness subtitle appears when there is sufficient room.

The card prioritizes one useful next step, followed by up to two compact alternatives using ready tools. The class name is shown once in the selector; the task identifies the actual Study Pack. Generic encouragement is omitted when there is no recorded activity or dated plan. Real activity acknowledgments and existing dated-plan completion remain visible when supported. Priority details retain their existing disclosure and actions.

**Four data states**

| State | Presentation and action |
| --- | --- |
| No personal classes/materials | “Start with one class,” the requested explanatory copy, and the original Add course material action. Bundled examples do not become personal material. |
| Class with no materials | Actual class name and existing icon, zero materials, “Let’s get your class ready,” and the existing upload flow. No practice task is suggested for this class. |
| Uploaded material without performance evidence | Actual material count, a dash and “Not assessed yet,” plus the existing recommended study action and ready notes/cards/quiz alternatives. Queued or failed tools are not advertised as ready; View Study Pack leads to their existing status/retry interface. |
| Recorded performance | The same readiness value used by Stats, when its evidence requirements are met; otherwise the honest unassessed state remains. Existing due-review, missed-question, weak-topic, exam, practice, and audio-resume rules supply the next action. |

**Classes, progress, and action preservation**

Multiple classes use a compact horizontal paged selector, with Previous/Next buttons as an accessible alternative. A single class needs no paging controls. Changing the selection updates the class’s tasks and source material. Selection is local UI state and is not saved as a new preference. Missing/deleted classes fall back to an available class. Existing unassigned-material grouping remains supported.

The card calls the existing `buildLearningMastery` projection for readiness and existing Home dashboard/review selectors for recommendations. No formula, evidence threshold, confidence rating, or review schedule was changed. Readiness describes supported recall across identified topics and is not a predicted exam grade. Material counts use saved source filenames where available, including combined uploads, with duplicates inside a pack removed.

The original Home recommendation callback remains in use when its target matches the selected step. Other classes route through the same existing notes, flashcard, quiz, Smart Study, audio, pack, and mistake destinations. The existing upload callback is passed directly to the card, including the case where an empty selected class sits beside another class with materials. Upload retains the current file chooser and class-assignment flow.

Study priorities and dated-plan completion retain their existing overall scope. “All classes” identifies that scope when multiple classes are present, so those totals are not presented as selected-class evidence. No task checkmark, achievement, or completion value was invented.

**Motion and accessibility**

- A finite border highlight travels once along the upper edge on entry or class change. There is no rotating border, repeated glow loop, or background timer.
- The small book settles once. The card enters over 220ms and selected task content settles over 180ms; opacity stays between 0.96 and 1 so controls remain visible.
- Existing primary-button press feedback remains. Genuine dated-plan completion receives a brief acknowledgment. Native readiness rings animate between real previously displayed values; unassessed values and newly mounted classes do not animate from an invented zero. Web rings are static.
- Motion follows the existing Reduce Motion hook, which initially stays still until the preference is known. Programmatic class movement is immediate with Reduce Motion enabled.
- Main actions and selector arrows have at least 44-point targets. Text can wrap and scale; the readiness ring grows with font scaling. Inactive carousel pages retain the native accessibility hiding props, and selection changes are announced. Native focus, reading order, large text, and announcements require device QA.

**Exact implementation files**

| File | Change |
| --- | --- |
| `src/components/TodaysPlanCard.tsx` | Card layout, local class selection, existing action wiring, busy/error protection, ready task presentation, priority and completion presentation. |
| `src/components/TodaysPlanArtwork.tsx` | Local book graphic, finite edge highlight, and readiness ring. |
| `src/components/todaysPlanPresentation.ts` | Read-only class view of existing selectors, ready-tool checks, source count, and recommendation target comparison. |
| `src/screens/HomeScreen.tsx` | Only the Today’s Plan JSX call site: passes existing navigation/upload callbacks into the card. No other Home code changed. |
| `docs/todays-plan-redesign-2026-11-09.md` | This report. |
| `docs/todays-plan-2026-11-09/empty-light.jpg` | Empty-state preview using disposable guest data. |
| `docs/todays-plan-2026-11-09/ready-light.jpg` | Finished card with explicitly constructed, spaced-practice test history. |
| `docs/todays-plan-2026-11-09/ready-dark-small.jpg` | Small-width dark preview with the same test history. |

The screenshots demonstrate test fixtures, including the displayed 100% recall value; they do not depict a real student’s progress.

**Checks completed**

| Check | Result and limit |
| --- | --- |
| TypeScript | `npm run typecheck` passed after preview cleanup. |
| Existing suite | 173 tests passed, with no failures or skips. |
| Focused presentation checks | Six local checks passed: stable-ID class isolation, empty-class isolation, pending/failed gating, independent readiness of secondary tools, combined-source counts/non-mutation, and exact recommendation-target comparison. |
| Scope | Compared 101 existing source/dependency files with the initial baseline: 99 were byte-identical. The two changed existing files are the card and its Home call site. Home is byte-identical after excluding that single card invocation. Git changes contain no backend, configuration, route, icon, Stats, or unrelated Home component edit. |
| Formatting/lint | `git diff --check` and new-file whitespace checks passed. This repository has no lint script/configuration, so no lint result is claimed. |
| States/layout | No-class, empty-class, uploaded/unassessed, and performance states rendered locally. Single/multiple classes were checked. Dark layouts at 320px had document width equal to viewport width in the measured class, material, failed, and performance views. Pending state also rendered correctly after correcting an incomplete temporary fixture. Light layouts were reviewed at 390px. |
| Selection | Horizontal scrolling selected Chemistry and updated its tasks. Previous/Next controls changed classes and reported boundary disabled states. |
| Study navigation | Selected Chemistry notes opened its Notes tab; Take a quiz opened its Quiz setup; the primary study action reached adaptive study and an active prompt labeled Chemistry / Chemical bonds. No answer or assessment was submitted. |
| Existing navigation | Planner opened the real Planner tab. The original Due reviews action opened its existing priority sheet with the correct pack/count. |
| Upload | The selected empty class’s Add course material opened the existing file chooser despite another class having materials. No file was selected or uploaded. The preview was reloaded after the chooser check. |
| Busy/error | A controlled test callback held the action pending: the primary and secondary task buttons reported disabled. A deliberate rejection then showed the existing error text and re-enabled retry. This verifies card presentation, not a live service outage. |
| Motion/performance | Source checks confirm finite effects, cleanup, memoized projections, no new requests/dependencies, and Reduce Motion paths. No native frame-rate or energy benchmark was run. |

The temporary preview used disposable guest data on a separate local origin with cloud/purchase configuration unset. The preview entry and HTML file were removed, the local server was stopped, and the browser size override was reset. No actual student data or production service was exercised.

**Remaining TestFlight checks**

Check the smallest and largest supported iPhones with maximum Dynamic Type, VoiceOver focus/selection announcements, Reduce Motion, native swipe snapping, and long class/pack names. Verify native file-picker cancellation and successful import/class assignment. Exercise real pending/retry transitions, audio resume, weak/due/mistake paths, and a genuinely completed dated plan. Native animation smoothness, interruption recovery, and launch-time cost remain unmeasured.

**Design assessment**

These are heuristic scores from source and local preview evidence, not ratings awarded by Apple, Meta, Google, or LinkedIn. No measured satisfaction, retention, or exam-outcome improvement is claimed.

| Criterion | /10 | Evidence / remaining weakness |
| --- | --- | --- |
| Visual aesthetics | 8.5 | Distinct but restrained frame, cohesive surfaces, and clear action hierarchy; native rendering pending. |
| Friendliness | 8.5 | Small study graphic and supportive first-step guidance without extra rewards or urgency. |
| Ease of use | 8.5 | One main action, ready alternatives, tested class controls and destinations; real import journey remains. |
| Animation polish | 7.5 | Finite, subtle transitions and preference handling; device timing/frame rate unverified. |
| Educational usefulness | 8.5 | Real recall evidence, available study tasks, existing review priorities; no outcome study. |
| Personalization | 8.5 | Actual class, sources, readiness, and selected-class recommendations; no new persisted selection. |
| Accessibility | 7.5 | Generous main targets, wrapping/scaling, selection announcements, and motion paths; native assistive-tech QA pending. |
| Consistency with StudyBolt | 8.5 | Existing brand palette, subject artwork, destinations, and Stats readiness data retained. |
