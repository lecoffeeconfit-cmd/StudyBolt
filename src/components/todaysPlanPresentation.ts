import type { StudyBoltState, StudyPack } from '../models';
import { buildHomeDashboard, examCalendarDays, type HomeDashboard } from '../services/homeDashboard';
import { findHomeAudioResume } from '../services/homeStudy';
import { isHomeToolReady } from '../services/homeTools';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { getRetentionCardSchedule } from '../services/retentionScheduler';
import { getTodaysPlanFocus } from '../services/todaysPlan';

type StudyTool = 'notes' | 'flashcards' | 'quiz';
type PlanAction =
  | { kind: 'materials' }
  | { kind: 'mistakes'; itemIds: string[] }
  | { kind: 'exam'; deck: StudyPack }
  | { kind: 'smart'; deck: StudyPack; sectionId?: string }
  | { kind: 'deck'; deck: StudyPack; tool?: StudyTool | 'audio'; cardIds?: string[]; resume?: boolean };

const TOOL_LABELS = { notes: 'Review key notes', flashcards: 'Practice flashcards', quiz: 'Take a quiz' };
const FIRST_STEP_REASON = {
  notes: 'Get familiar with the key ideas before you practice.',
  flashcards: 'Try recalling each answer before you flip the card.',
  quiz: 'Find out what you already know and what needs another look.',
};

export function planToolReady(deck: StudyPack, tool: StudyTool) {
  const material = tool === 'notes' ? 'simpleNotes' : tool;
  return deck[tool].length > 0 && (!deck.generation || deck.generation.materials[material]?.status === 'ready');
}

/** Today's Plan reuses Stats evidence and Home priorities, with destinations limited to this page's packs. */
export function todaysPlanCourse(
  state: StudyBoltState,
  group: Pick<LearningMasteryGroup, 'packs' | 'practicedPacks' | 'nextPractice'>,
  now: Date,
  allClassesDashboard?: HomeDashboard,
) {
  const ids = new Set(group.packs.map(pack => pack.id));
  const decks = state.decks.filter(deck => deck.fileType !== 'demo' && ids.has(deck.id));
  const scoped = { ...state, decks };
  const dashboard = allClassesDashboard ?? buildHomeDashboard(scoped, {
    now,
    resumeDeckId: findHomeAudioResume(scoped)?.id,
    scheduleCard: (deckId, cardId) => getRetentionCardSchedule(state, deckId, cardId, state.retentionMode === 'standard' ? 'sm2' : state.retentionMode, now),
  });
  const next = dashboard.recommendation;
  const focus = getTodaysPlanFocus(dashboard);
  const deck = decks.find(item => item.id === next.deckId);
  const masteryPractice = group.nextPractice;
  const masteryDeck = decks.find(item => item.id === masteryPractice?.deckId);
  const recent = dashboard.recent.map(item => item.deck);
  const toolSteps = (['notes', 'flashcards', 'quiz'] as const).flatMap(tool => {
    const source = [deck, ...recent].find(pack => pack && planToolReady(pack, tool));
    return source ? [{ title: TOOL_LABELS[tool], action: { kind: 'deck' as const, deck: source, tool } }] : [];
  });

  const exam = dashboard.exam;
  const examDeck = exam && recent.find(pack => exam.deckIds.includes(pack.id)
    && (['flashcards', 'quiz', 'notes'] as const).some(tool => planToolReady(pack, tool)));
  const step = (action: PlanAction, title = focus.title, reason = focus.reason) => ({ action, title, reason });
  const prepareForExam = (pack: StudyPack, title: string) => {
    const reason = 'Practice with material from your exam plan.';
    const tool = (['quiz', 'flashcards', 'notes'] as const).find(item => planToolReady(pack, item));
    return step({ kind: 'deck', deck: pack, tool }, title, reason);
  };
  const scheduledStep = () => {
    const scope = state.plan.scope;
    const plannedPacks = recent.filter(pack => scope.type === 'deck' ? pack.id === scope.id : pack.courseId === scope.id);
    if (!plannedPacks.length) return;
    for (const day of state.plan.days) {
      if (!day.date) continue;
      const onDate = /^\d{4}-\d{2}-\d{2}$/.test(day.date)
        ? examCalendarDays(day.date, now) === 0
        : new Date(day.date).toDateString() === now.toDateString();
      if (!onDate) continue;
      for (const block of day.blocks) {
        if (block.complete) continue;
        const tool = block.modality;
        const pack = plannedPacks.find(item => tool === 'test'
          ? planToolReady(item, 'quiz') || planToolReady(item, 'flashcards')
          : tool === 'audio' ? isHomeToolReady(item, 'audio') : planToolReady(item, tool));
        if (pack) return step(tool === 'test' ? { kind: 'exam', deck: pack } : { kind: 'deck', deck: pack, tool },
          block.label, 'Scheduled in Planner today.');
      }
    }
  };
  const recommend = () => {
    if (!decks.length) return step({ kind: 'materials' });
    if (exam && examDeck && exam.daysRemaining <= 7) {
      return prepareForExam(examDeck, `Prepare for ${exam.title}`);
    }
    const scheduled = scheduledStep();
    if (scheduled) return scheduled;
    if (next.kind === 'mistakes') return step({ kind: 'mistakes', itemIds: dashboard.mistakeIds });
    if (next.kind === 'due' && deck && planToolReady(deck, 'flashcards')) {
      return step({ kind: 'deck', deck, tool: 'flashcards', cardIds: next.cardIds });
    }
    if (next.kind === 'weak' && deck && next.sectionId) {
      if (next.cardIds?.length && planToolReady(deck, 'flashcards')) {
        return step({ kind: 'smart', deck, sectionId: next.sectionId }, next.title, next.why);
      }
      const tool = (['quiz', 'notes'] as const).find(item => planToolReady(deck, item));
      if (tool) return step({ kind: 'deck', deck, tool }, TOOL_LABELS[tool], next.why);
    }
    if (next.kind === 'resume' && deck && isHomeToolReady(deck, 'audio')) {
      return step({ kind: 'deck', deck, tool: 'audio', resume: true });
    }
    if (next.kind === 'exam' && examDeck) return prepareForExam(examDeck, next.title);
    if (!group.practicedPacks && next.kind !== 'exam') {
      const firstTool = toolSteps[0];
      const noteDeck = firstTool?.action.tool === 'notes' ? firstTool.action.deck : null;
      const hasReviewedNotes = noteDeck?.notes.some(note => noteDeck.reviewedNoteIds?.includes(note.id));
      const first = (hasReviewedNotes ? toolSteps.find(task => task.action.tool !== 'notes') : undefined) ?? firstTool;
      if (first) return step(first.action, first.title, FIRST_STEP_REASON[first.action.tool]);
    }
    if (masteryPractice && masteryDeck && planToolReady(masteryDeck, masteryPractice.tool)) {
      return step({ kind: 'deck', deck: masteryDeck, tool: masteryPractice.tool, cardIds: masteryPractice.cardIds }, masteryPractice.label, masteryPractice.reason);
    }
    const available = toolSteps[0];
    if (available) return step(available.action, available.title, 'Continue with a study tool that’s ready.');
    const current = deck ?? recent[0]!;
    if (next.kind === 'pack') return step({ kind: 'deck', deck: current });
    return step({ kind: 'deck', deck: current }, 'Open your Study Pack', 'Check which tools are ready or need another try.');
  };

  const primary = recommend();
  const primaryTool = primary.action.kind === 'deck' ? primary.action.tool : primary.action.kind === 'smart' ? 'flashcards' : undefined;
  const secondary: Array<{ title: string; action: typeof toolSteps[number]['action'] | Extract<PlanAction, { kind: 'mistakes' }> }> =
    toolSteps.filter(task => task.action.tool !== primaryTool);
  if (primary.action.kind !== 'mistakes' && dashboard.mistakeIds.length) {
    secondary.unshift({ title: 'Review mistakes', action: { kind: 'mistakes', itemIds: dashboard.mistakeIds } });
  }
  return {
    primary, tasks: secondary.slice(0, 2), decks,
    materialCount: decks.reduce((total, pack) => total + (pack.sourceFileNames?.length ? new Set(pack.sourceFileNames).size : 1), 0),
    examLabel: exam && 'deck' in primary.action && exam.deckIds.includes(primary.action.deck.id)
      ? exam.daysRemaining === 0 ? 'Exam today' : exam.daysRemaining === 1 ? 'Exam tomorrow' : `Exam in ${exam.daysRemaining} days`
      : null,
  };
}

export type TodaysPlanCourse = ReturnType<typeof todaysPlanCourse>;
export type TodaysPlanAction = TodaysPlanCourse['primary']['action'];
