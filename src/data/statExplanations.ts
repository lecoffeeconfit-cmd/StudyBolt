export interface StatExplanation {
  description: string;
  calculation: string;
  whyItMatters: string;
}

export interface StatDetail extends StatExplanation {
  label: string;
  value: string;
  supporting: string;
  insight: string;
}

type StatDetailOverrides = Partial<StatExplanation> & { insight?: string };

const STAT_EXPLANATIONS: Record<string, StatExplanation> = {
  'Evidence history': {
    description: 'A qualitative description of how much learning history supports the detailed estimates.',
    calculation: 'Strong requires at least five recorded quizzes and five flashcard review days. Building requires at least two recorded quizzes plus two active study days in the last 30 days. Other histories are early.',
    whyItMatters: 'This describes the amount of evidence rather than your knowledge or a statistical confidence level.',
  },
  'Active weeks': {
    description: 'The number of recent seven-day windows containing recorded study activity.',
    calculation: 'The last 28 days are grouped into four seven-day windows. A window counts if it contains positive-duration study activity.',
    whyItMatters: 'Use this as a description of your routine and choose a pace that works for you.',
  },
  'Classes saved': {
    description: 'The number of classes currently saved in the selected statistics scope.',
    calculation: 'Your personal view counts unique real course IDs, including classes that do not have a Study Pack yet. The all-data view also includes saved sample classes.',
    whyItMatters: 'This describes the organization of your material.',
  },
  'Your presentations': {
    description: 'PowerPoint source files associated with your current personal Study Packs.',
    calculation: 'The course projection counts PowerPoint source filenames, deduplicating repeated names within a combined-upload pack. Bundled examples are excluded.',
    whyItMatters: 'A material count describes what is saved; practice results describe what you can recall.',
  },
  'Study Packs saved': {
    description: 'The number of Study Packs currently saved in the selected statistics scope.',
    calculation: 'Each current pack is counted once. Deleted packs do not contribute.',
    whyItMatters: 'Use your Library to organize or revisit the saved material.',
  },
  'Page coverage estimate': {
    description: 'An approximate number of source pages represented by your weighted pack activity.',
    calculation: 'Each pack’s page count is multiplied by its weighted activity completion; the results are added and rounded. Individual page views are not counted.',
    whyItMatters: 'This gives context for activity coverage. Use recorded practice evidence to judge understanding.',
  },
  'Study progress': {
    description: 'A composite of activity coverage, self-ratings, and assessment scores across your saved Study Packs.',
    calculation: 'Without a cumulative test, each pack uses reviewed notes (25%), flashcard confidence (35%), and its latest quiz score (40%). With a test, notes contribute 20%, cards 30%, the latest quiz 20%, and the latest test 30%. Pack composites are averaged equally.',
    whyItMatters: 'Use this to track your study work. Course readiness separately requires repeated recall evidence across identified topics.',
  },
  'Active study days': {
    description: 'How many of the last seven calendar days contain recorded study time.',
    calculation: 'A day counts when a valid notes, flashcard, quiz, listening, or focus event has a positive duration.',
    whyItMatters: 'This describes your routine. Choose a rhythm that works for you; every recorded session contributes.',
  },
  'Consecutive study days': {
    description: 'The current run of consecutive days with recorded study time.',
    calculation: 'StudyBolt counts backward from today, or yesterday if you have not studied today, until it reaches a day without positive-duration study activity.',
    whyItMatters: 'Treat this as routine feedback. Taking a break does not erase what you learned.',
  },
  'Concepts showing strength': {
    description: 'The number of tracked concepts whose current estimated signal is at least 80%.',
    calculation: 'The existing concept estimate blends card confidence, matching quiz accuracy, and stored assessment evidence when available. Concepts at or above 80% are counted.',
    whyItMatters: 'Self-ratings contribute to this estimate. Revisit an idea after a delay to add stronger recall evidence.',
  },
  'Concepts to practice': {
    description: 'Tracked concepts below the current 80% estimate threshold, including concepts without recall evidence yet.',
    calculation: 'The existing concept estimate blends card confidence and matching assessment evidence. Concepts below 80% are counted.',
    whyItMatters: 'An unseen concept is an opportunity to build a baseline, rather than evidence of a poor result.',
  },
  'Estimated recall': {
    description: 'A model-based estimate of current recall for concepts with dated evidence.',
    calculation: 'The existing FSRS or SM-2 schedule is used when enabled. Standard mode applies StudyBolt’s time-based decay model to the current concept estimate. Concepts without dated evidence are excluded.',
    whyItMatters: 'Use the estimate to choose a review, then let your actual answer guide the next step.',
  },
  'Most active day': {
    description: 'The weekday with the most tracked study time in the last 30 days.',
    calculation: 'Positive-duration activity is grouped by weekday; the weekday with the highest total is shown.',
    whyItMatters: 'This describes when you spend time studying. Practice results help you judge learning quality.',
  },
  'Most active time': {
    description: 'The part of the day with the most tracked study time in the last 30 days.',
    calculation: 'Activity is grouped into morning, afternoon, and evening. The largest group appears after five active days.',
    whyItMatters: 'Use this to understand your routine alongside the accuracy and recall views.',
  },
  'Estimated exam readiness': {
    description: 'A blended estimate of how prepared your studied material appears to be right now.',
    calculation: 'Material coverage (20%), concept mastery (25%), recent quizzes (20%), first-try recall (15%), spaced retention (15%), and weak/unseen gaps (5%) are combined. It unlocks after at least two quizzes, two active days, and two reviewed concepts.',
    whyItMatters: 'Use it as a direction signal, not a predicted exam grade. The component breakdown shows the fastest place to improve it.',
  },
  'Overall mastery': {
    description: 'Your average demonstrated knowledge across concepts in every class.',
    calculation: 'StudyBolt combines flashcard confidence and quiz evidence for each concept, then aggregates those concept estimates across your Study Packs.',
    whyItMatters: 'A high value is most convincing when it is supported by repeated recall on different days—not just recent familiarity.',
  },
  'Recent quiz average': {
    description: 'Your current quiz performance, weighted toward what you did most recently.',
    calculation: 'The arithmetic mean of your five most recent recorded quiz or cumulative-test scores.',
    whyItMatters: 'Compare this with overall mastery. A large difference can reveal that confidence ratings and tested recall tell different stories.',
  },
  'Study time this week': {
    description: 'Time spent in tracked study activities during the rolling last seven days.',
    calculation: 'Durations from notes, flashcards, quizzes, listening, and other tracked study events in the last seven calendar days are added together.',
    whyItMatters: 'Time is useful context, but learning quality matters more. Pair it with recall, spacing, and mastery changes.',
  },
  'Study streak': {
    description: 'The number of consecutive days with tracked study activity.',
    calculation: 'StudyBolt counts backward through days with at least one positive-duration event. Today may be empty without ending yesterday’s active streak.',
    whyItMatters: 'A streak can support consistency, but short, focused retrieval sessions are more valuable than studying only to preserve a number.',
  },
  'Concepts mastered': {
    description: 'Concepts whose current observed mastery estimate is at least 80%.',
    calculation: 'Each concept blends flashcard confidence with question accuracy; concepts at 80% or above are counted.',
    whyItMatters: 'Mastered means currently strong, not permanent. Spaced reviews help confirm that the knowledge remains accessible.',
  },
  'Still learning': {
    description: 'Concepts that have not yet reached the 80% mastery threshold.',
    calculation: 'All tracked concepts with a current mastery estimate below 80% are counted, including weak and unseen material.',
    whyItMatters: 'Prioritize low-mastery concepts that are also due; they are the best candidates for your next retrieval session.',
  },
  'Due today': {
    description: 'Concept reviews that are ready or overdue based on their latest recall evidence.',
    calculation: 'Standard mode uses fixed confidence-based intervals. FSRS or SM-2 mode uses each card’s adaptive due date.',
    whyItMatters: 'Reviewing close to the due date gives useful retrieval effort without letting the memory become too weak.',
  },
  'Pack completion': {
    description: 'How much of your Study Packs you have meaningfully touched across all learning modes.',
    calculation: 'Each pack weights reviewed notes 30%, attempted flashcards 35%, quiz completion 25%, and listening progress 10%; the displayed total averages all packs.',
    whyItMatters: 'Completion measures coverage, not understanding. Use mastery and quiz accuracy to judge learning quality.',
  },
  'Material remaining': {
    description: 'The share of Study Pack activity that is not yet complete.',
    calculation: '100% minus average Study Pack completion.',
    whyItMatters: 'This is a coverage queue. A lower number means you have encountered more material, not necessarily mastered it.',
  },
  'Recall probability': {
    description: 'An estimate of the chance that you could retrieve studied concepts now without seeing the answer.',
    calculation: 'FSRS/SM-2 uses each card’s schedule when enabled. Standard mode decays observed mastery over elapsed time, with stability increasing after successful evidence. Concepts without dated evidence are excluded.',
    whyItMatters: 'Low recall probability plus high importance is a strong signal to review soon. It is an estimate, not a guarantee.',
  },
  'Recognition vs. recall': {
    description: 'The gap between recognizing an answer in a quiz and producing it through flashcard recall.',
    calculation: 'Recognition accuracy minus successful flashcard-recall rate for matching sections, with at least three observations of each.',
    whyItMatters: 'A positive gap can mean the material feels familiar when shown but is harder to retrieve independently.',
  },
  'Confidence calibration': {
    description: 'How closely your confidence matches whether your answers are actually correct.',
    calculation: 'For at least five confidence-rated answers, StudyBolt compares your stated probability with the outcome and converts average error to a 0–100 score.',
    whyItMatters: 'Better calibration makes self-testing more trustworthy. Confidently wrong answers deserve immediate attention.',
  },
  'First-try accuracy': {
    description: 'Accuracy the first time each distinct question is recorded.',
    calculation: 'Correct or partial-credit points from only the first recorded attempt per question, divided by the number of first attempts.',
    whyItMatters: 'This is a cleaner measure of initial retrieval than a score boosted by repeating familiar questions.',
  },
  'Delayed retention': {
    description: 'How often recall still succeeds after a meaningful delay.',
    calculation: 'Successful repeat flashcard reviews at least 6.5 days after the prior review, divided by all such attempts. At least three are required.',
    whyItMatters: 'Delayed success is stronger evidence of durable learning than success repeated in the same session.',
  },
  'Long-term retention': {
    description: 'How often recall still succeeds after a meaningful delay.',
    calculation: 'Successful repeat flashcard reviews at least 6.5 days after the prior review, divided by all such attempts. At least three are required.',
    whyItMatters: 'Delayed success is stronger evidence of durable learning than success repeated in the same session.',
  },
  'Learning velocity': {
    description: 'The recent rate at which your demonstrated mastery is changing.',
    calculation: 'Mastery gains from repeated card ratings and quiz scores over the last 28 days are normalized per distinct concept or assessment and per elapsed week. It requires three changes across two units.',
    whyItMatters: 'Positive velocity means your evidence is improving. A flat or negative trend can suggest changing method, spacing, or topic priority.',
  },
  'Response time': {
    description: 'How long you usually take to answer timed retrieval prompts.',
    calculation: 'The mean response time across timed quiz answers and flashcard reviews; at least three timed observations are required. The median is shown for comparison.',
    whyItMatters: 'Faster is useful only when accuracy holds. A mean much higher than the median can indicate a few unusually slow answers.',
  },
  'Fluency': {
    description: 'The pace of successful retrieval during timed practice.',
    calculation: 'Correct timed quiz answers and successful card recalls divided by total timed minutes, with at least five observations.',
    whyItMatters: 'Rising fluency with stable accuracy suggests recall is becoming easier and more automatic.',
  },
  'Best study time': {
    description: 'The two-hour time window in which your timed answers have been most accurate.',
    calculation: 'Timed observations are grouped into two-hour windows; windows with at least five answers are ranked by accuracy, then sample size.',
    whyItMatters: 'Treat this as a personal pattern, not a rule. More data across different times makes it more reliable.',
  },
  'Session fatigue': {
    description: 'The change in accuracy from the beginning to the end of longer quiz runs.',
    calculation: 'For at least two quizzes with eight or more questions, accuracy in the first third is compared with accuracy in the final third.',
    whyItMatters: 'A consistent drop suggests shorter sessions or a brief reset may protect performance.',
  },
  'Ideal session length': {
    description: 'The study-duration range associated with your strongest retrieval accuracy.',
    calculation: 'Tracked sessions are grouped by duration. Each session needs at least three scored observations, and a duration band needs at least two sessions.',
    whyItMatters: 'Use it as a starting point for planning focused blocks; topic difficulty can still change the right duration.',
  },
  'Efficiency trend': {
    description: 'How your mastery gain per study hour changed versus the previous week.',
    calculation: 'Normalized mastery gain per concept per hour from the last seven days is compared with the prior seven days. Both periods need repeated measured gains.',
    whyItMatters: 'An improving trend means your recent time is producing more observable progress, even if total hours are unchanged.',
  },
  'Best study method': {
    description: 'The study method associated with your highest measured mastery gain per hour.',
    calculation: 'Observed before/after gains are normalized per distinct unit and divided by tracked hours. A method needs repeated evidence across at least two units.',
    whyItMatters: 'This is personal evidence. Use it to allocate time, but keep mixing methods when the learning goal differs.',
  },
  'Most efficient course': {
    description: 'The course where tracked study time is currently producing the highest measured mastery gain.',
    calculation: 'Observed gains are normalized per distinct unit and divided by tracked hours for each course; repeated evidence is required.',
    whyItMatters: 'A lower-efficiency course may simply be harder. Use this to plan enough time, not to avoid the course.',
  },
  'Consistency score': {
    description: 'A 28-day measure of how regularly study is distributed across days and weeks.',
    calculation: 'Active days contribute 70% of the score, reaching full credit at 16 days. Coverage across the four weeks contributes the remaining 30%.',
    whyItMatters: 'Regular contact usually supports spacing better than concentrating the same time into one or two sessions.',
  },
  'Spacing quality': {
    description: 'The share of repeat card reviews occurring in a useful spacing window.',
    calculation: 'Repeat intervals from 20 hours through 14 days count as well spaced; the score is those intervals divided by all repeat intervals. At least three intervals are required.',
    whyItMatters: 'Low spacing can mean reviews are clustered too closely or left too long. Aim for effortful but still successful recall.',
  },
  'Cramming index': {
    description: 'How much of a study plan’s tracked work happened in its final 24 hours.',
    calculation: 'Minutes in the last 24 hours before the target date divided by all tracked minutes within that plan’s scope.',
    whyItMatters: 'A lower share generally indicates more distributed practice. The metric appears only when a plan enters its final day.',
  },
  'Plan adherence': {
    description: 'How much of your planned study time you have marked complete.',
    calculation: 'Minutes in completed plan blocks divided by minutes in all planned blocks.',
    whyItMatters: 'This reflects following the plan, not the learning result. Pair it with mastery and retention.',
  },
  'Reviews by tomorrow': {
    description: 'Cards due or overdue before the end of tomorrow.',
    calculation: 'Adaptive due dates are used in FSRS/SM-2; Standard mode derives due dates from the last recall and confidence rating.',
    whyItMatters: 'This is your near-term review workload. Overdue cards are included so the number may exceed tomorrow’s newly due cards.',
  },
  'Reviews in 7 days': {
    description: 'Cards scheduled or already overdue within the next seven days.',
    calculation: 'All card due dates before the end of the seven-day window are counted, including overdue cards.',
    whyItMatters: 'Use this forecast to distribute review work before the queue becomes concentrated.',
  },
  'Retention rate': {
    description: 'How often repeated, spaced flashcard recall is successful.',
    calculation: 'Known ratings on repeat reviews at least 18 hours apart divided by all such reviews. It appears after three attempts.',
    whyItMatters: 'This is direct evidence that learning survived beyond the initial session.',
  },
  'Retention confidence': {
    description: 'How convincing the current retention estimate is, based on both success and evidence volume.',
    calculation: 'Retention rate contributes 75%; sample strength contributes 25%. It appears only with strong multi-day history.',
    whyItMatters: 'A strong retention rate with low evidence can be fragile. This score helps distinguish a promising result from a well-supported one.',
  },
  'Repeat accuracy': {
    description: 'Accuracy on questions you have answered before.',
    calculation: 'Correct or partial-credit points on all attempts after the first attempt for each question, divided by repeat attempts.',
    whyItMatters: 'Compare it with first-try accuracy to see whether review is closing gaps or repetition is only creating short-term familiarity.',
  },
  'Unseen concepts': {
    description: 'Concepts with no recorded quiz or flashcard recall evidence.',
    calculation: 'New cards with no review history and no matching question answers are counted.',
    whyItMatters: 'These are coverage gaps. Sample them before spending more time polishing already-strong concepts.',
  },
  'Overall accuracy': {
    description: 'Accuracy across every recorded answer with question-level detail.',
    calculation: 'Correct answers and partial-credit points divided by all recorded detailed answers.',
    whyItMatters: 'This is broad performance. First-try accuracy and difficulty breakdowns reveal more about where the result comes from.',
  },
  'Average quiz score': {
    description: 'Your mean score across all completed quiz and cumulative-test runs.',
    calculation: 'All recorded run scores are added and divided by the number of completed runs.',
    whyItMatters: 'Averages are stable but can hide recent improvement; compare this with the recent trend.',
  },
  'Best score': {
    description: 'Your highest recorded score on any quiz or cumulative test.',
    calculation: 'The maximum of all recorded quiz-run scores.',
    whyItMatters: 'This shows demonstrated potential, but repeatable performance is better represented by averages and retention.',
  },
  'Questions answered': {
    description: 'Quiz responses saved with answer-level detail.',
    calculation: 'Every stored quiz answer record is counted, including repeats.',
    whyItMatters: 'More varied answers improve the reliability of breakdowns by difficulty, type, confidence, and timing.',
  },
  'Correct answers': {
    description: 'Recorded detailed answers marked correct.',
    calculation: 'All correct answer records are counted. Partial credit affects percentage metrics but does not count as fully correct here.',
    whyItMatters: 'Use the count as sample context; accuracy is more comparable across different amounts of practice.',
  },
  'Needs review': {
    description: 'Recorded detailed answers that were incorrect.',
    calculation: 'All answer records not marked correct are counted.',
    whyItMatters: 'Repeated misses and confidence outcomes help identify which errors deserve priority.',
  },
  'Perfect quizzes': {
    description: 'Completed quiz or test runs with a score of exactly 100%.',
    calculation: 'StudyBolt counts all recorded run scores equal to 100.',
    whyItMatters: 'A perfect result is encouraging; repeating recall after time passes is stronger evidence of retention.',
  },
  'Quizzes completed': {
    description: 'The total number of recorded quiz and cumulative-test runs.',
    calculation: 'Every saved quiz score is counted once, including legacy scores.',
    whyItMatters: 'More runs provide trend context, especially when they cover different topics and are spaced over time.',
  },
  'Study time today': {
    description: 'Minutes recorded in study activities today.',
    calculation: 'Positive durations from today’s tracked study events are added together.',
    whyItMatters: 'Use this against your daily goal, while keeping the session focused on a clear retrieval or coverage target.',
  },
  'This week': {
    description: 'Tracked study time in the rolling last seven days.',
    calculation: 'Durations from all tracked study events in the seven-day window are added together.',
    whyItMatters: 'Compare time with active days to see whether work is distributed or concentrated.',
  },
  'This month': {
    description: 'Tracked study time in the rolling last 30 days.',
    calculation: 'Durations from all tracked study events in the 30-day window are added together.',
    whyItMatters: 'This gives workload context for monthly mastery and consistency changes.',
  },
  'Total study time': {
    description: 'Your all-time tracked study duration, including compatible legacy totals.',
    calculation: 'StudyBolt uses the larger of recorded activity-event time and the stored legacy study total to avoid double counting.',
    whyItMatters: 'Lifetime time shows investment, not efficiency. Mastery gain per hour is the better result signal.',
  },
  'Daily average': {
    description: 'Average minutes studied on days when you were active during the last 30 days.',
    calculation: '30-day tracked minutes divided by the number of days with positive tracked study time.',
    whyItMatters: 'Because inactive days are excluded, use consistency score to understand how often these sessions happen.',
  },
  'Average session': {
    description: 'The typical duration of your tracked study sessions.',
    calculation: 'Events no more than 35 minutes apart are grouped into a session; session minutes are then averaged.',
    whyItMatters: 'Compare this with your ideal session length and fatigue signal to tune the size of study blocks.',
  },
  'Study time change': {
    description: 'How your recorded study time changed compared with the preceding seven-day window.',
    calculation: 'Minutes in the last seven calendar days minus minutes in the previous seven days, divided by the previous total, then multiplied by 100. A comparison appears only when the previous window contains study time.',
    whyItMatters: 'This describes workload, not learning quality. Compare it with quiz accuracy, recall, and your schedule before deciding whether to spend more time.',
  },
  'Days meeting your goal': {
    description: 'How often your recorded study time reached your current daily goal during the last seven days.',
    calculation: 'Each local calendar day is counted if its study minutes meet or exceed the daily goal you have set now. The same current goal is used for all seven days; today counts as soon as you reach it.',
    whyItMatters: 'Use the pattern to set a manageable routine. If your goal recently changed, read this as a comparison against your new target rather than a record of the targets you had at the time.',
  },
  'Longest session': {
    description: 'Your longest grouped study session.',
    calculation: 'Tracked events no more than 35 minutes apart are grouped, and the largest total duration is shown after at least three sessions.',
    whyItMatters: 'Long is not automatically productive. Check whether accuracy falls late in longer runs.',
  },
  'Most productive day': {
    description: 'The weekday with the most tracked study time in the last 30 days.',
    calculation: 'Study minutes are grouped by weekday and the largest total is selected.',
    whyItMatters: 'This describes your current routine; it does not measure which day produces the most learning.',
  },
  'Most productive time': {
    description: 'The part of day with the most tracked study time in the last 30 days.',
    calculation: 'Minutes are grouped into morning, afternoon, and evening; the largest group appears after five active days.',
    whyItMatters: 'Compare it with best study time: one shows when you study most, while the other shows when timed accuracy is strongest.',
  },
  'Study sessions': {
    description: 'The number of distinct tracked study sessions.',
    calculation: 'Positive-duration events are grouped together until there is a gap longer than 35 minutes.',
    whyItMatters: 'Session count helps interpret averages and duration patterns; it is not a goal by itself.',
  },
  Notes: {
    description: 'Foreground time spent with a Study Pack’s notes open, plus sections explicitly marked reviewed.',
    calculation: 'Time is counted while the notes view is open in the foreground, paused when the app is backgrounded or you leave Notes. Marking a section reviewed updates coverage separately.',
    whyItMatters: 'Notes build context. Follow reading with retrieval practice to test whether the ideas are accessible from memory.',
  },
  Flashcards: {
    description: 'Your recorded flashcard retrieval practice.',
    calculation: 'Every flashcard-review event is counted, with current concept mastery separating mastered from still-learning cards.',
    whyItMatters: 'Flashcards are most informative when you answer before revealing the back and revisit them after time has passed.',
  },
  Quizzes: {
    description: 'Completed quiz and cumulative-test practice.',
    calculation: 'Recorded run scores and detailed question answers are counted from your assessment history.',
    whyItMatters: 'Quizzes sample performance under retrieval. Review why distractors were tempting, not only which answer was correct.',
  },
  Listening: {
    description: 'Time spent with audio study and completion of quick reviews.',
    calculation: 'Audio-event minutes are added; average completion uses the latest completion percentage for each Study Pack.',
    whyItMatters: 'Listening can reinforce coverage, but pair it with active recall to verify what you can produce independently.',
  },
  'Classes created': {
    description: 'The number of classes currently in your StudyBolt library.',
    calculation: 'Every saved class is counted once.',
    whyItMatters: 'This is an organization count and does not affect mastery or readiness by itself.',
  },
  'Lectures uploaded': {
    description: 'Uploaded source documents that became Study Packs.',
    calculation: 'Every non-demo Study Pack source is counted once.',
    whyItMatters: 'This shows source coverage; use pack completion to see how much you have actually reviewed.',
  },
  'Study Packs created': {
    description: 'The total number of Study Packs in your library.',
    calculation: 'Every saved Study Pack, including demos, is counted once.',
    whyItMatters: 'This is an organization count. Coverage and mastery show how deeply those packs have been used.',
  },
  'Pages / slides': {
    description: 'The total source-page or slide count represented by your Study Packs.',
    calculation: 'Page counts reported for all Study Pack sources are added together.',
    whyItMatters: 'Use this as workload context, not a learning outcome.',
  },
  'Slides reviewed': {
    description: 'An approximate page-equivalent measure of Study Pack progress.',
    calculation: 'Each pack’s source-page count is multiplied by its weighted completion percentage, then the results are rounded and added.',
    whyItMatters: 'The approximation blends multiple learning modes; it does not mean each individual source page was opened.',
  },
};

function numericValue(value: string): number | null {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function asSentence(value: string): string {
  const trimmed = value.trim();
  return !trimmed || /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function insightFor(label: string, value: string, supporting: string): string {
  if (value === '—' || /not enough|more history|building/i.test(value)) {
    return `This insight is still building. ${supporting || 'Keep studying normally and it will appear when enough evidence is available.'}`;
  }
  const numeric = numericValue(value);
  if (label === 'Study time change' && numeric !== null) {
    const change = numeric > 0 ? `${Math.abs(numeric)}% more` : numeric < 0 ? `${Math.abs(numeric)}% less` : 'about the same amount of';
    return `You recorded ${change} study time compared with the preceding seven days. More time is not automatically better; check your recall and quiz results alongside it.`;
  }
  if (label === 'Material remaining' && numeric !== null) {
    return `You have about ${value} of weighted Study Pack activity left. ${asSentence(supporting)}`;
  }
  if (label === 'Cramming index' && numeric !== null) {
    const pattern = numeric <= 25 ? 'mostly distributed before the final day' : numeric <= 50 ? 'partly concentrated near the deadline' : 'heavily concentrated in the final day';
    return `Your tracked study was ${pattern}. ${asSentence(supporting)}`;
  }
  if (value.includes('%') && numeric !== null) {
    const band = numeric >= 80 ? 'a strong current signal' : numeric >= 60 ? 'a developing signal with room to strengthen' : 'a useful area to prioritize';
    return `Your current value is ${value}, which is ${band}. ${asSentence(supporting)}`.trim();
  }
  return `Your current snapshot is ${value}. ${asSentence(supporting)}`.trim();
}

export function makeStatDetail(label: string, value: string, supporting: string, overrides: StatDetailOverrides = {}): StatDetail {
  const base = STAT_EXPLANATIONS[label] ?? {
    description: `A personal learning signal for ${label.toLowerCase()}.`,
    calculation: 'StudyBolt calculates this from the tracked activity and learning evidence shown with the stat.',
    whyItMatters: 'Use it together with accuracy, mastery, and spacing rather than as a standalone judgment.',
  };
  const explanation = { ...base, ...overrides };
  return {
    label,
    value,
    supporting,
    description: explanation.description,
    calculation: explanation.calculation,
    whyItMatters: explanation.whyItMatters,
    insight: overrides.insight ?? insightFor(label, value, supporting),
  };
}
