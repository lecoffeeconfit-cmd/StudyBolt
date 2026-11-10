import type { StudyBoltState, StudyPack } from '../models';
import type { HomeDashboard } from '../services/homeDashboard';
import { buildHomeDashboard } from '../services/homeDashboard';
import { findHomeAudioResume } from '../services/homeStudy';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { getRetentionCardSchedule } from '../services/retentionScheduler';
import { getTodaysPlanFocus } from '../services/todaysPlan';

export type PlanStudyTask = { deckId: string; tool: 'notes' | 'flashcards' | 'quiz'; title: string; detail: string };

/** Card-only view of existing selectors. Never writes state or changes a score/schedule. */
export function todaysPlanCourse(state: StudyBoltState, group: LearningMasteryGroup, now = new Date()) {
  const ids = new Set(group.packs.map(pack => pack.id));
  const decks = state.decks.filter(deck => deck.fileType !== 'demo' && ids.has(deck.id));
  const scoped = { ...state, decks };
  const dashboard = buildHomeDashboard(scoped, {
    now, resumeDeckId: findHomeAudioResume(scoped)?.id,
    scheduleCard: (deckId, cardId) => getRetentionCardSchedule(state, deckId, cardId, state.retentionMode === 'standard' ? 'sm2' : state.retentionMode, now),
  });
  const next = dashboard.recommendation;
  const deck = decks.find(item => item.id === next.deckId);
  // Old saved packs may contain tool arrays while generation is incomplete. Advertise only ready tools.
  const needsCards = ['due', 'weak', 'exam', 'practice'].includes(next.kind) && Boolean(deck?.flashcards.length);
  const needsNotes = ['weak', 'exam', 'practice'].includes(next.kind) && !deck?.flashcards.length;
  if (deck && ((needsCards && !planToolReady(deck, 'flashcards')) || (needsNotes && !planToolReady(deck, 'notes')) || (next.kind === 'resume' && deck.generation?.materials.audio.status !== undefined && deck.generation.materials.audio.status !== 'ready'))) {
    const failed = Object.values(deck.generation?.materials ?? {}).some(material => material.status === 'failed');
    dashboard.recommendation = { kind: 'pack', deckId: deck.id, title: failed ? 'Pick up your Study Pack' : 'Your study tools are taking shape', why: failed ? 'Open your Study Pack to use available tools or retry a tool that needs attention.' : 'Open your Study Pack to check progress and use each tool as it becomes ready.', actionLabel: 'View Study Pack', minutes: null };
  }
  const tasks: PlanStudyTask[] = [];
  const primaryTool = getTodaysPlanFocus(dashboard).medium;
  for (const tool of ['notes', 'flashcards', 'quiz'] as const) {
    if ((tool === 'flashcards' && primaryTool === 'practice' && dashboard.recommendation.kind !== 'mistakes') || (tool === 'notes' && primaryTool === 'notes')) continue;
    const source = dashboard.recent.map(item => item.deck).find(pack => planToolReady(pack, tool));
    if (!source) continue;
    tasks.push({ deckId: source.id, tool, title: tool === 'notes' ? 'Review notes' : tool === 'quiz' ? 'Take a quiz' : 'Practice flashcards', detail: source.title });
  }
  return {
    dashboard, tasks: tasks.slice(0, 2),
    materialCount: decks.reduce((sum, pack) => sum + (pack.sourceFileNames?.length ? new Set(pack.sourceFileNames).size : 1), 0),
  };
}

export function planToolReady(deck: StudyPack, tool: PlanStudyTask['tool']) {
  const material = tool === 'notes' ? 'simpleNotes' : tool;
  return deck[tool].length > 0 && (!deck.generation || deck.generation.materials[material].status === 'ready');
}

/** Keep the original Home callback when its exact recommendation is the selected next step. */
export function samePlanRecommendation(a: HomeDashboard, b: HomeDashboard) {
  const key = (dashboard: HomeDashboard) => JSON.stringify({
    kind: dashboard.recommendation.kind, deckId: dashboard.recommendation.deckId,
    sectionId: dashboard.recommendation.sectionId, cardIds: dashboard.recommendation.cardIds,
    mistakes: dashboard.recommendation.kind === 'mistakes' ? dashboard.mistakeIds : undefined,
  });
  return key(a) === key(b);
}
