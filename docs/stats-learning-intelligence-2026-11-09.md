# Stats Learning Intelligence Dashboard — 9 November 2026

## Before implementation: audit and data boundaries

The existing page has six tabs (Overview, Insights, Mastery, Quizzes, Activity, Methods), a swipeable course-readiness card, explanation sheets, practice destinations, personal/sample scope selection, and a large set of observed and estimated metrics. Swiping only changes the course card; the analytics below are global. Topics and packs are distributed across tabs, material coverage has no expandable topic hierarchy, and dated performance has no selectable time window. Detailed retention explanations already exist.

The knowledge rule in `buildLearningMastery`, quiz scoring, `buildAnalytics`, and retention scheduling will remain unchanged. The existing readiness value is a conservative reporting rule, not a validated exam predictor. The numeric exam-readiness heuristic available internally is not validated and will not be promoted as an exam forecast.

| Information | Support | Presentation decision |
| --- | --- | --- |
| Class name, saved icon, materials, current course readiness | Fully supported | Reuse current group projection and existing SubjectIcon |
| Topic practice estimates | Fully supported, with evidence limits | Reuse analytics values and suppress percentages without dated topic practice |
| Source-linked question attempts and correctness | Derivable from recorded answers | Count existing answers; preserve partial-credit semantics for accuracy |
| Next practice | Fully supported | Reuse group.nextPractice and existing navigation |
| Dated quiz/test performance | Fully supported when a valid score and date exist | Chart actual saved results; no invented earlier knowledge snapshots |
| Whole-course knowledge growth and changes in syllabus scope | Not supported historically | Explain limits; do not reconstruct history or call scope changes forgetting |
| Materials → topics → performance | Partially supported | Expand saved packs; combined uploads remain combined where source-topic attribution is absent |
| Practice coverage and assessed topics | Fully supported | Distinguish exposure, assessment coverage, and recall outcomes |
| Review timing, spaced retention, confidence calibration | Fully supported after existing thresholds | Reuse existing metrics and explanation sheets |
| Validated exam readiness | Not available | Show an honest explanation, no new score |
| Satisfaction, acquisition, Stats-to-study conversion | Not established by available local records | Recommend future evaluation; no new tracking |

Class scope will be a local read-only projection using stable pack/class IDs. Cross-class or ambiguous assessments cannot be assigned a class score without inventing attribution; they remain available in the existing All classes view. Undated legacy scores also remain in existing detailed totals, but will not be plotted at invented dates.

Implementation, validation, limitations, and final design assessment follow below after review.
