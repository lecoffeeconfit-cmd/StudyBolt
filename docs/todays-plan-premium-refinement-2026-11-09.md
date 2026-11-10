# StudyBolt — Today’s Plan premium refinement

November 9, 2026. Local presentation refinement of the existing Home card. Overall heuristic assessment: **8.3/10 before → 8.9/10 after**. These are design judgments supported by source review and browser fixtures, not ratings from Apple or Meta, measured retention improvements, or evidence of better exam outcomes. A 9.5/10 claim would require native accessibility, large-text, gesture, and animation verification.

The existing structure was worth preserving: a selected class, one main recommendation, at most two ready alternatives, expandable overall priorities, and factual dated-plan completion. The changes improve comprehension and visual consistency within that structure.

## Before-and-after review

| Criterion | Before | Weakness and smallest useful refinement implemented | After |
| --- | --- | --- | --- |
| Visual cleanliness | 8.5 | Removed the extra inset border, softened the blue wash into a vertical fade, and reduced the outer frame to one point. | 9.1 |
| Premium aesthetics | 8.5 | Replaced the header’s font glyph with a small code-drawn open book; retained the existing book-and-yellow-bolt composition, subtle shadow, and rounded surfaces. | 9.1 |
| Visual hierarchy | 8.5 | Added a visible Knowledge caption to the actual score and made the first-upload button use the same filled primary treatment as the study action. | 9.2 |
| User friendliness | 8.5 | Shortened the header support copy to “Small steps. Stronger recall.” and corrected singular/plural topic copy without dropping evidence. | 9.0 |
| Class selector usability | 8.0 | Selected pages keep a warm outline; inactive pages use quieter surfaces. Added spring feedback, less prominent arrows, a small position accent, and a full-width name layout for long names on narrow screens. | 9.0 |
| Meaningful student engagement | 8.5 | Kept one strong next action and existing real completion; added press and focus feedback to the smaller tasks. No artificial urgency or reward was introduced. | 8.8 |
| Educational value | 8.5 | Real spaced-recall evidence, ready-tool gating, source attribution, and time-based review recommendations are preserved. The clearer score label helps interpretation; no outcome benefit is claimed. | 8.5 |
| Animation quality | 7.5 | Added a finite class-selection spring, refined the blue/yellow edge highlight, increased the visibility of the short content transition, and added a brief scale acknowledgment for actual dated-plan completion. Native smoothness remains unmeasured. | 8.5 |
| Accessibility | 7.5 | Added visible focus feedback to class arrows, secondary tasks, and the priorities disclosure; clarified the score’s spoken meaning and excluded decorative class artwork. Native VoiceOver and Dynamic Type remain to be checked. | 8.5 |
| Home page consistency | 8.5 | Uses existing blue, warm yellow, light/dark surfaces, type family, and primary button contrast; existing subject artwork and all other Home sections remain intact. | 9.2 |

## Visual and interaction refinements

The primary action stays immediately visible and its icon/text spacing is retained. Secondary tasks remain limited to the existing two suggestions. At normal phone width they form compact 62-point tiles; at narrower widths they become full-width rows with trailing chevrons. Source names wrap instead of being truncated. Focus uses a visible blue outline, and press feedback uses a subtle background change and a tiny scale response when motion is allowed.

Class names remain fully readable. Long names on narrow screens use a separate heading row and a compact evidence/score row, avoiding a thin column of wrapped words. A single class omits the paging controls. Multiple classes retain horizontal paging, Previous/Next alternatives, selection announcements, disabled boundary states, and the current local selection behavior.

The score is still the exact existing `buildLearningMastery` result used by Stats. Its label explains consistent spaced recall and states that it is a practice estimate, not an exam prediction. An unassessed class continues to show a dash and “Not assessed yet,” with no invented percentage. The material count and supported-topic evidence remain visible.

The edge highlight runs once on entry or a class change, combining blue with a small warm yellow accent. The class spring changes only opacity/scale; it does not alter paging or defer navigation. The book settles once. Content transitions remain short, and the completed-plan acknowledgment depends on the existing factual completion flag. All effects stop during cleanup and follow the existing Reduce Motion hook. Native ring transitions remain finite, while the web score ring remains static. No perpetual animation or delay was added.

## Four student states and additional cases

| State | Result |
| --- | --- |
| No classes | “Start with one class,” friendly study artwork, the existing explanatory copy, and a prominent Add course material action. |
| Class with no materials | Actual class and icon, zero materials, unassessed score, upload recommendation, and no unsupported practice tasks. |
| Materials without an assessment | Actual class/material counts, “Not assessed yet,” the existing practice recommendation, and only ready secondary tools. |
| Recorded learning evidence | Actual score/evidence and the existing class-specific due/weak/mistake/exam/practice/audio recommendation rules. |
| Processing or failed practice tools | Existing View Study Pack recommendation and available notes; unavailable quiz/cards are not advertised as ready. |
| Action pending or failed | Existing busy/disabled protection, error text, and retry remain connected. |
| Dated plan complete | Existing completion count and optional-next-step wording remain factual; zero tasks never creates completion. |

## Validation evidence and limits

| Check | Result |
| --- | --- |
| TypeScript | `npm run typecheck` passed before editing and after preview cleanup. |
| Relevant existing tests | **70 passed, 0 failed** across Today’s Plan, Home dashboard, Home study, learning mastery, and theme contrast. No new tests were added for decorative details. |
| Whitespace | `git diff --check` passed. |
| Lint | No lint script or configuration exists in this repository; no lint result is claimed. |
| Action preservation | A TypeScript syntax-tree comparison against HEAD confirmed that all six `onPress` expressions and the existing `select`, `navigateClass`, `start`, `startSelected`, `priorities`, `groups`, `selectedCourse`, `focus`, and `status` initializers are unchanged. |
| Planner and primary action | Preview callbacks received Planner and the original recommended due-review action. Chemistry’s primary action received Smart Study with the Chemistry pack ID. This confirms callback dispatch; native destination screens were not re-exercised in this pass. Home’s existing routing code is byte-identical. |
| Secondary tasks and priorities | Notes and quiz actions dispatched their existing tool callbacks; weak/due/missed-question controls dispatched the correct priority callback. The existing source guard and ready-tool check remain unchanged. |
| Class paging | Both arrow controls and horizontal browser scrolling changed the selected class and its recommendations. Boundary buttons reported disabled correctly. Native gesture feel remains to be checked. |
| Empty class and upload | Selecting an empty Physics class beside populated classes displayed the upload recommendation, and the Add material callback fired. The no-class primary action also fired its original materials callback. No document was uploaded. |
| Busy and failure | A controlled pending callback disabled the primary/secondary actions and class switching. Resolving it restored interaction; a controlled rejected primary callback showed the existing error and allowed retry. |
| Layout | Reviewed 390 CSS pixel light layouts and 319 CSS pixel light/dark layouts. Measured document width equaled viewport width at 319px for long-class, no-class, unassessed, and completed-plan fixtures. Long names remained visible and narrow tasks used full-width rows. |
| Targets and reading order | Primary action measured about 50px high, secondary tasks about 62px, and Planner/arrows/disclosure about 44px, subject to browser subpixel rounding. Browser accessibility snapshots exposed only the active class and included the clarified score label, busy states, disclosure expansion, and completion text. |
| Reduce Motion | A preview-only mocked system response exercised the existing hook’s reduced-motion branch with real completion data; finite animation paths and cleanup were also inspected. Actual iPhone system preference changes and VoiceOver announcements remain untested. |
| Rendering | A React DOM warning from the new decorative SVG was corrected by using platform-appropriate hidden/focus props. Subsequent previews had no new error entries. Existing web development deprecation warnings remain outside this refinement. |
| Scope | Only the two runtime files below changed. No services, algorithms, data models, Home call site, Stats, routes, icons/assets, subscriptions, backend, or dependencies changed. Supporting additions are this report and four preview images. |

The preview used disposable guest fixtures on a separate local origin with production public configuration removed from the local server environment. Screenshots contain constructed practice history; their 100% example is a computed fixture value, not a real student score. The temporary preview source/HTML were removed, the local server stopped, the browser tab closed, and the viewport override reset. No native build, TestFlight upload, deployment, production mutation, or purchase was performed.

## Exact changed files

- [TodaysPlanCard.tsx](/Users/howieday/StudyBolt/src/components/TodaysPlanCard.tsx): visual hierarchy, class layout, task spacing, focus/press feedback, and completion presentation.
- [TodaysPlanArtwork.tsx](/Users/howieday/StudyBolt/src/components/TodaysPlanArtwork.tsx): small book illustration, finite selection spring, blue/yellow border accent, and score accessibility description.
- [This report](/Users/howieday/StudyBolt/docs/todays-plan-premium-refinement-2026-11-09.md).
- [Assessed light preview](/Users/howieday/StudyBolt/docs/todays-plan-refinement-2026-11-09/assessed-light.png).
- [Long class, narrow dark preview](/Users/howieday/StudyBolt/docs/todays-plan-refinement-2026-11-09/long-class-dark-small.png).
- [No classes, narrow light preview](/Users/howieday/StudyBolt/docs/todays-plan-refinement-2026-11-09/no-classes-light-small.png).
- [Unassessed, narrow dark preview](/Users/howieday/StudyBolt/docs/todays-plan-refinement-2026-11-09/unassessed-dark-small.png).

The exact next verification is an iPhone pass using the smallest supported layout and maximum Dynamic Type: read the selected class/score with VoiceOver, swipe and use Previous/Next, open Planner and each existing study destination, toggle Reduce Motion, and observe an actual dated-plan completion. Native frame rate, interruption behavior, and any effect on retention or educational outcomes are unmeasured.
