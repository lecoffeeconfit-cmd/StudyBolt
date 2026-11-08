# Stats: Learning Mastery hero

## Scope and files

The Overview readiness card is replaced by a self-contained Learning Mastery hero. The existing Stats header, scope switch, tabs, empty-state card, detail sheet, all other tabs, and everything from **At a glance** onward are preserved from the pre-task working copy. Prior uncommitted changes were retained. No navigation routes, persistence, scoring, review schedules, backend services, purchases, environments, dependencies, or production resources were changed.

- `src/screens/StatsScreen.tsx`: import/render the new hero and remove only the old readiness card and its local variables.
- `src/components/LearningMasteryHero.tsx`: the carousel, SVG recall ring, material summary, supporting metrics, Focus next, and existing-detail-sheet action.
- `src/services/learningMastery.ts`: a pure, temporary display projection of existing saved data; nothing new is persisted.
- `tests/learningMastery.test.mjs`: evidence, scope, edge-case, and state-preservation checks.

## Available evidence and exact metric sources

| Display | Existing data and interpretation |
| --- | --- |
| Class identity | `StudyClass.id` matched to `StudyPack.courseId`. Display names are never association keys. Actual empty classes remain available. Sample-only classes are excluded. |
| Source material counts | Each current pack's `fileType`, `fileName`, and optional combined-upload `sourceFileNames`. Duplicate names within one pack count once. PowerPoints, PDFs, and note sets are identified separately. These are uploads, not evidence of knowledge. |
| Topics | Current `StudyPack.outline` IDs/titles. Quiz and card source-section references must match that outline. No topic names are generated or inferred. |
| Material practiced | Percentage of current, non-sample Study Packs with a dated recorded quiz answer or a review of an existing flashcard. The numerator and denominator are shown. This measures pack-level practice coverage, not the proportion of slides understood. Reads, audio, uploads, and confidence flags alone are not mastery evidence. |
| Quiz accuracy | Fully correct first recorded answers divided by distinct source questions. `originQuestionId` combines generated variants/retakes. Skips and partial-credit answers are not counted as fully correct. Aggregate legacy scores have no answer denominator, so they do not manufacture question-level accuracy. |
| Flashcard recall | Dated `flashcard-review` events with explicit `again`, `hard`, `good`, or `easy` ratings; good/easy indicate reported recall success. A current known-confidence flag alone supplies no dated recall outcome. |
| Focus next | Current outline topics with unsuccessful latest daily responses in the last 30 days, ranked by distinct missed items then recency. The hero shows up to two, labeled with their source Study Pack. Without topic evidence it asks the student to practice a quiz. |

Quiz and exam practice share the existing `quiz` activity records. Each answer is scoped by its source pack; ambiguous answers in multi-pack assessments are excluded. Exam-completion summary records are not counted again. Missing/deleted packs, future/invalid timestamps, bundled demo packs, and `seed-` events are ignored. Existing scores and answer records are never modified.

## Why the estimate is conservative

The existing overall mastery calculation counts note reading and blends confidence/quiz scores. Reusing it here would imply more than the proposed hero can support, so the lower Stats calculations remain untouched and the new hero uses a separate read-only reporting rule.

The hero stays **Not assessed yet** until every saved pack has complete outline-to-practice mapping, practice tools are ready, and every identified topic has at least two distinct current practice items. Every mapped item must have recorded first responses on separate UTC days at least 24 hours apart, within a rolling 30-day reporting window.

A topic shows consistent recall when every mapped item's two latest daily responses succeed, including a successful response separated by 24 hours, and no additional recorded topic item has a latest unsuccessful response. Only when all topics are assessed does the ring show the unweighted percentage of topics meeting that rule. A single strong subset cannot become a class-wide percentage. Retrying the same question on the same day adds no recall evidence and cannot overwrite the day's first response. The rule is deliberately strict and documented in the detail sheet; it is not a scientifically validated score or a prediction of an exam grade or full-syllabus knowledge.

## Interaction and existing destination

A horizontal native `FlatList` is confined to the card. It pages at the measured card width, uses stable group IDs, and renders a small window of pages. The title, position, ring, metrics, and review suggestions update for the selected class. Arrows have 44-point touch targets, stop at the ends, and use nonanimated scrolling when Reduce Motion is enabled. Position dots are decorative; larger class collections use the numeric position and arrows. Unrelated vertical content never participates in the horizontal carousel.

**Explore class breakdown** opens the existing Stats detail sheet with the selected class's pack list, recorded coverage, evidence explanation, and review topics. There is no new route or screen. Unassigned uploads use **Explore material breakdown**. With no packs the button is omitted and the hero directs the student to add material from Home.

## Empty states, accessibility, and performance

- With no classes, actual unassociated packs appear under **All study materials**; otherwise unmatched packs get **Unassigned materials**. No associations are invented.
- With no material or practice, the ring shows a dash and unassessed label; missing quiz accuracy shows a dash rather than zero.
- Partial/failed practice generation and missing topic mappings keep recorded activity visible while withholding mastery. This component makes no network request; existing application hydration/error handling remains in charge, with a local loading state until hydration completes.
- System colors and typography work in both themes. Text can wrap, and the ring/summary and metric columns stack at narrow widths or larger text settings. Numeric text fits inside the ring; explanatory labels remain outside it.
- VoiceOver labels describe values and missing evidence. Only the current page is exposed to accessibility, class changes are announced, and focus recommendations do not rely on color.
- Motion is limited to native paging and a short opacity transition; the ring never animates from a fabricated percentage. Reduce Motion disables both. Recency is recomputed on foregrounding without a polling timer.
- The evidence projection is memoized, derived locally, and never saved. Existing React Native and `react-native-svg` are reused; there are no new dependencies.

## Simulated design review

These are design perspectives applied during implementation, not claims of external review or measured engagement gains.

- **Apple-inspired:** Keep class identity and the recall ring dominant; use familiar tokens, calm surfaces, generous controls, and readable wrapping text. Numeric certainty must not replace a clear missing-evidence state.
- **Meta-inspired:** Make switching classes local and predictable, preserve selection, and pair the summary with evidence-backed Focus next and one working breakdown action. Do not add an unrelated navigation flow.
- **Learning science:** Distinguish exposure, first-answer quiz accuracy, practice coverage, and repeated recall. Avoid a weighted exam-success formula and leave insufficient or incomplete evidence unassessed, even when that produces fewer percentages.

## Validation and remaining device checks

Baseline: TypeScript passed and the existing 148 tests passed. Added evidence tests cover empty/same-named/unassigned classes, sample exclusions, uploads and single quizzes, repeated variants, complete and incomplete topic coverage, mixed-class assessments, generation failures, invalid/future/deleted data, recency, flashcard ratings, partial/skipped answers, combined filenames, and non-mutation.

Final validation: TypeScript passed. All 19 new Learning Mastery tests passed as part of the full suite of **170 passing tests**. Scoped whitespace checks passed. The existing header/tabs/scope matched the pre-task copy, and all content and styles from **At a glance** onward matched byte for byte (SHA-256 `cb4d471a39e68b592a7ce0042156fd8d908c82f9e3ae717ba771cd6568f1af6e`). The working tree also contains independent ongoing edits, which were preserved.

The saved pre-task Stats file is used for a byte-for-byte comparison of all code and styles from **At a glance** through the end of the file. No lint script is configured in this repository. No native build, export, deployment, or publication is part of this change.

Before release, check actual iPhone/iPad layouts in both themes and large accessibility text; swipe versus vertical scrolling; arrows at the ends; many-class paging; VoiceOver announcement/focus; Reduce Motion; and the existing detail sheet. No Stats reference screenshot was attached to this request, so the supplied text layout and current app design tokens guide the implementation. No real-device visual result or improved retention is claimed.

Deferred: full-syllabus topic coverage, semantic deduplication across separate uploads, backend topic analysis, a new class-detail screen, and validated long-term knowledge assessment. Existing data does not establish those capabilities.
