import type { StudyBoltState, StudyPack } from '../models';
import { buildHomeDashboard } from '../services/homeDashboard';
import { findHomeAudioResume } from '../services/homeStudy';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { getRetentionCardSchedule } from '../services/retentionScheduler';
import { getTodaysPlanFocus } from '../services/todaysPlan';

type StudyTool = 'notes' | 'flashcards' | 'quiz';
type PlanAction =
  | { kind: 'materials' }
  | { kind: 'mistakes'; itemIds: string[] }
  | { kind: 'smart'; deck: StudyPack; sectionId?: string }
  | { kind: 'deck'; deck: StudyPack; tool?: StudyTool | 'audio'; cardIds?: string[] };

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
export function todaysPlanCourse(state: StudyBoltState, group: LearningMasteryGroup, now: Date) {
  const ids = new Set(group.packs.map(pack => pack.id));
  const decks = state.decks.filter(deck => deck.fileType !== 'demo' && ids.has(deck.id));
  const scoped = { ...state, decks };
  const dashboard = buildHomeDashboard(scoped, {
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

  const step = (action: PlanAction, title = focus.title, reason = focus.reason) => ({ action, title, reason });
  const recommend = () => {
    if (!decks.length) return step({ kind: 'materials' });
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
    if (next.kind === 'resume' && deck && (!deck.generation || deck.generation.materials.audio?.status === 'ready')) {
      return step({ kind: 'deck', deck, tool: 'audio' });
    }
    if (next.kind === 'exam' && deck) {
      if (planToolReady(deck, 'flashcards')) return step({ kind: 'smart', deck });
      const tool = (['quiz', 'notes'] as const).find(item => planToolReady(deck, item));
      if (tool) return step({ kind: 'deck', deck, tool }, next.title, next.why);
    }
    if (!group.practicedPacks && next.kind !== 'exam') {
      const first = toolSteps[0];
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
    examLabel: next.kind === 'exam' && 'deck' in primary.action && primary.action.deck.id === next.deckId ? focus.examLabel : null,
  };
}

export type TodaysPlanCourse = ReturnType<typeof todaysPlanCourse>;
export type TodaysPlanAction = TodaysPlanCourse['primary']['action'];
