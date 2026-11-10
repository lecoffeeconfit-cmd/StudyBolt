import type { StudyBoltState, StudyPack } from '../models';

const DAY = 86_400_000;
const WINDOW = 30 * DAY;

export interface LearningPracticeAction {
  deckId: string;
  tool: 'quiz' | 'flashcards' | 'notes';
  cardIds?: string[];
  label: string;
  reason: string;
}

export interface LearningMasteryGroup {
  id: string;
  name: string;
  kind: 'class' | 'overview' | 'unassigned';
  packs: Array<{ id: string; title: string; practiced: boolean; topics: number }>;
  powerpoints: number;
  pdfs: number;
  noteSets: number;
  flashcards: number;
  completedQuizzes: number;
  pendingPacks: number;
  failedPacks: number;
  materialPracticed: number | null;
  practicedPacks: number;
  quizAccuracy: number | null;
  quizQuestions: number;
  topicCount: number;
  assessedTopics: number;
  supportedTopics: number;
  practicedTopicIds: string[];
  mastery: number | null;
  focusTopics: Array<{ id: string; title: string; packTitle: string; packId: string; sectionId: string }>;
  nextPractice: LearningPracticeAction | null;
  explanation: string;
}

interface Observation { at: number; successful: boolean }
interface TopicEvidence {
  id: string;
  title: string;
  items: Set<string>;
  // First response per item per UTC day; retrying in one session cannot inflate recall.
  observations: Map<string, Map<string, Observation>>;
}
interface PackEvidence {
  deck: StudyPack;
  topics: Map<string, TopicEvidence>;
  questions: Map<string, { item: string; section: string }>;
  cards: Map<string, { item: string; section: string }>;
  firstAnswers: Map<string, Observation>;
  quizEvents: Set<string>;
  practiced: boolean;
  completeMapping: boolean;
  pending: boolean;
}

function preparePack(deck: StudyPack): PackEvidence {
  const topics = new Map<string, TopicEvidence>();
  for (const section of deck.outline) {
    if (section.id && section.title.trim()) topics.set(section.id, { id: `${deck.id}:${section.id}`, title: section.title, items: new Set(), observations: new Map() });
  }
  const pending = Boolean(deck.generation && ['quiz', 'flashcards'].some((material) => {
    const status = deck.generation!.materials[material as 'quiz' | 'flashcards'].status;
    return status !== 'ready';
  }));
  const result: PackEvidence = {
    deck, topics, questions: new Map(), cards: new Map(), firstAnswers: new Map(), quizEvents: new Set(), practiced: false,
    completeMapping: topics.size > 0 && topics.size === deck.outline.length && !pending, pending,
  };
  for (const question of deck.quiz) {
    const item = `quiz:${question.originQuestionId || question.id}`;
    const section = question.source.sectionId;
    const topic = topics.get(section);
    if (!topic) result.completeMapping = false;
    else topic.items.add(item);
    result.questions.set(question.id, { item, section });
    if (question.originQuestionId) result.questions.set(question.originQuestionId, { item, section });
  }
  for (const card of deck.flashcards) {
    const item = `card:${card.id}`;
    const section = card.source.sectionId;
    const topic = topics.get(section);
    if (!topic) result.completeMapping = false;
    else topic.items.add(item);
    result.cards.set(card.id, { item, section });
  }
  if ([...topics.values()].some((topic) => !topic.items.size)) result.completeMapping = false;
  return result;
}

function observe(topic: TopicEvidence | undefined, item: string, at: number, successful: boolean) {
  if (!topic) return;
  const day = new Date(at).toISOString().slice(0, 10);
  const days = topic.observations.get(item) ?? new Map<string, Observation>();
  const previous = days.get(day);
  if (!previous || at < previous.at) days.set(day, { at, successful });
  topic.observations.set(item, days);
}

function recentResponses(topic: TopicEvidence, now: number) {
  return new Map([...topic.observations].map(([item, days]) => [item,
    [...days.values()].filter((entry) => entry.at >= now - WINDOW).sort((a, b) => a.at - b.at),
  ]));
}

/**
 * Read-only hero projection; never changes scores, schedules, persisted state or analytics below it.
 * This is a conservative reporting rule, not a validated learning-science score:
 * at least two distinct mapped practice items in every identified source topic need first-response
 * evidence on separate days at least 24 hours apart, within the last 30 days.
 * A topic shows supported recall when the two latest daily responses for each item
 * succeed, including a successful spaced response, with no latest topic-item failure.
 * Only complete class coverage unlocks the unweighted share of supported topics.
 */
export function buildLearningMastery(state: StudyBoltState, now = new Date()): LearningMasteryGroup[] {
  const timestamp = +now;
  const decks = state.decks.filter((deck) => deck.fileType !== 'demo');
  const evidence = new Map(decks.map((deck) => [deck.id, preparePack(deck)]));
  const events = state.activityEvents.filter((event) => !event.id.startsWith('seed-')
    && Number.isFinite(+new Date(event.occurredAt)) && +new Date(event.occurredAt) <= timestamp)
    .sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt));
  const seenEvents = new Set<string>();
  for (const event of events) {
    if (seenEvents.has(event.id)) continue;
    seenEvents.add(event.id);
    const eventTime = +new Date(event.occurredAt);
    if (event.type === 'quiz') {
      for (const answer of event.quizAnswers ?? []) {
        // A mixed-class assessment must identify each answer's actual source pack.
        const deckId = answer.sourceDeckId ?? (event.sourceDeckIds && event.sourceDeckIds.length > 1 ? undefined : event.deckId ?? event.sourceDeckIds?.[0]);
        const pack = deckId ? evidence.get(deckId) : undefined;
        const at = answer.answeredAt ? +new Date(answer.answeredAt) : eventTime;
        if (!pack || !answer.questionId || typeof answer.correct !== 'boolean' || !Number.isFinite(at) || at > timestamp) continue;
        const question = pack.questions.get(answer.originQuestionId ?? answer.questionId) ?? pack.questions.get(answer.questionId);
        const item = question?.item ?? `quiz:${answer.originQuestionId || answer.questionId}`;
        const successful = answer.correct === true && !answer.skipped && (answer.partialCredit === undefined || answer.partialCredit >= 1);
        pack.practiced = true;
        pack.quizEvents.add(event.id);
        // First answer per stable source question, never a repeated-attempt average.
        const first = pack.firstAnswers.get(item);
        if (!first || at < first.at) pack.firstAnswers.set(item, { at, successful });
        const section = answer.sourceSectionId || question?.section;
        if (question && section !== question.section) { pack.completeMapping = false; continue; }
        if (section) observe(pack.topics.get(section), item, at, successful);
      }
    } else if (event.type === 'flashcard-review' && event.deckId && event.cardId) {
      const pack = evidence.get(event.deckId);
      const card = pack?.cards.get(event.cardId);
      if (!pack || !card) continue;
      pack.practiced = true;
      // Legacy confidence flags are exposure evidence, not dated recall outcomes.
      if (event.reviewRating && ['again', 'hard', 'good', 'easy'].includes(event.reviewRating)) observe(pack.topics.get(card.section), card.item, eventTime, ['good', 'easy'].includes(event.reviewRating));
    }
  }

  const sampleClasses = new Set(state.decks.filter((deck) => deck.fileType === 'demo').map((deck) => deck.courseId));
  const courses = [...new Map(state.classes.map((course) => [course.id, course])).values()]
    .filter((course) => !sampleClasses.has(course.id) || decks.some((deck) => deck.courseId === course.id));
  const classIds = new Set(courses.map((course) => course.id));
  const unassigned = decks.filter((deck) => !classIds.has(deck.courseId));
  const groups: Array<{ id: string; name: string; kind: LearningMasteryGroup['kind']; decks: StudyPack[] }> = courses.map((course) => ({
    id: `class:${course.id}`, name: course.name, kind: 'class', decks: decks.filter((deck) => deck.courseId === course.id),
  }));
  if (unassigned.length) groups.push({ id: 'unassigned-materials', name: courses.length ? 'Unassigned materials' : 'All study materials', kind: courses.length ? 'unassigned' : 'overview', decks: unassigned });
  if (!groups.length) groups.push({ id: 'learning-overview', name: 'Your study materials', kind: 'overview', decks: [] });

  return groups.map((group) => {
    const packs = group.decks.map((deck) => evidence.get(deck.id)!);
    let assessedTopics = 0;
    let supportedTopics = 0;
    const focus: Array<{ id: string; title: string; packTitle: string; packId: string; sectionId: string; misses: number; lastAt: number }> = [];
    for (const pack of packs) for (const [sectionId, topic] of pack.topics) {
      const responses = recentResponses(topic, timestamp);
      const assessed = topic.items.size >= 2 && [...topic.items].every((item) => {
        const history = responses.get(item) ?? [];
        return history.length >= 2 && history[history.length - 1]!.at - history[0]!.at >= DAY;
      });
      const latest = [...responses.values()].flatMap((history) => history.length ? [history[history.length - 1]!] : []);
      const supported = assessed && latest.every((entry) => entry.successful) && [...topic.items].every((item) => {
        const history = responses.get(item)!;
        const last = history[history.length - 1]!;
        return history.slice(-2).every((entry) => entry.successful)
          && history.some((entry) => entry.successful && last.at - entry.at >= DAY);
      });
      if (assessed) assessedTopics += 1;
      if (supported) supportedTopics += 1;
      const misses = latest.filter((entry) => !entry.successful).length;
      if (misses) focus.push({ id: topic.id, title: topic.title, packTitle: pack.deck.title, packId: pack.deck.id, sectionId, misses, lastAt: Math.max(...latest.map((entry) => entry.at)) });
    }
    const topicCount = packs.reduce((total, pack) => total + pack.topics.size, 0);
    const complete = packs.length > 0 && packs.every((pack) => pack.completeMapping) && topicCount > 0 && assessedTopics === topicCount;
    const quizAnswers = packs.flatMap((pack) => [...pack.firstAnswers.values()].map((answer) => answer.successful));
    const practicedPacks = packs.filter((pack) => pack.practiced).length;
    let powerpoints = 0;
    let pdfs = 0;
    let noteSets = 0;
    for (const { deck } of packs) {
      if (deck.fileType === 'notes') { noteSets += 1; continue; }
      const names = deck.sourceFileNames?.length ? [...new Set(deck.sourceFileNames)] : [deck.fileName];
      for (const name of names) {
        if (/\.pptx$/i.test(name) || (!/\.pdf$/i.test(name) && deck.fileType === 'pptx')) powerpoints += 1;
        else if (/\.pdf$/i.test(name) || deck.fileType === 'pdf') pdfs += 1;
      }
    }
    const pendingPacks = packs.filter((pack) => pack.pending).length;
    const failedPacks = packs.filter(pack => pack.deck.generation && ['quiz', 'flashcards'].some(material => pack.deck.generation!.materials[material as 'quiz' | 'flashcards'].status === 'failed')).length;
    const rankedFocus = focus.sort((a, b) => b.misses - a.misses || b.lastAt - a.lastAt || a.id.localeCompare(b.id));
    const practiceFor = (pack: PackEvidence, topic?: typeof rankedFocus[number]): LearningPracticeAction | null => {
      const { deck } = pack;
      const ready = (material: 'quiz' | 'flashcards' | 'simpleNotes' | 'detailedNotes') => !deck.generation || deck.generation.materials[material].status === 'ready';
      const cards = topic ? deck.flashcards.filter((card) => card.source.sectionId === topic.sectionId) : deck.flashcards;
      if (topic && cards.length && ready('flashcards')) return { deckId: deck.id, tool: 'flashcards', cardIds: cards.map((card) => card.id), label: 'Review this topic', reason: `Revisit ${topic.title} from ${deck.title}.` };
      if (deck.quiz.length && ready('quiz')) return { deckId: deck.id, tool: 'quiz', label: topic ? 'Practice this pack' : 'Practice a quiz', reason: topic ? `Your latest practice highlighted ${topic.title}.` : `Build your practice history in ${deck.title}.` };
      if (cards.length && ready('flashcards')) return { deckId: deck.id, tool: 'flashcards', label: 'Review flashcards', reason: `Check what you can recall from ${deck.title}.` };
      if (!topic && deck.notes.length && ready('simpleNotes')) return { deckId: deck.id, tool: 'notes', label: 'Read your notes', reason: `Get familiar with ${deck.title} before practice.` };
      return null;
    };
    const focusedAction = rankedFocus.map((topic) => practiceFor(evidence.get(topic.packId)!, topic)).find(Boolean);
    const nextPractice = focusedAction ?? [...packs].sort((a, b) => Number(a.practiced) - Number(b.practiced))
      .map((pack) => practiceFor(pack)).find(Boolean) ?? null;
    const explanation = !packs.length ? 'Add class material from Home, then start a quiz or flashcard review.'
      : failedPacks ? 'Some practice tools need attention. Open the Study Pack from Library to check or retry them.'
        : pendingPacks ? 'Some practice tools are still processing. Your recorded practice stays visible.'
        : !packs.every((pack) => pack.completeMapping) ? 'Topic mapping is incomplete. Practice results stay visible; mastery is unassessed.'
          : !complete ? 'Not enough practice yet. Build recall across topics on different days.'
            : 'Share of identified topics showing consistent, spaced recall in the last 30 days. A practice estimate, not an exam prediction.';
    return {
      id: group.id, name: group.name, kind: group.kind,
      packs: packs.map((pack) => ({ id: pack.deck.id, title: pack.deck.title, practiced: pack.practiced, topics: pack.topics.size })),
      powerpoints, pdfs, noteSets, pendingPacks, failedPacks, practicedPacks,
      flashcards: packs.reduce((sum, pack) => sum + pack.deck.flashcards.length, 0),
      completedQuizzes: new Set(packs.flatMap((pack) => [...pack.quizEvents])).size,
      materialPracticed: packs.length ? Math.round(practicedPacks / packs.length * 100) : null,
      quizAccuracy: quizAnswers.length ? Math.round(quizAnswers.filter(Boolean).length / quizAnswers.length * 100) : null,
      quizQuestions: quizAnswers.length, topicCount, assessedTopics, supportedTopics,
      mastery: complete ? Math.round(supportedTopics / topicCount * 100) : null,
      practicedTopicIds: packs.flatMap(pack => [...pack.topics.values()].filter(topic => topic.observations.size > 0).map(topic => topic.id)),
      focusTopics: rankedFocus.slice(0, 3).map(({ id, title, packTitle, packId, sectionId }) => ({ id, title, packTitle, packId, sectionId })),
      nextPractice,
      explanation,
    };
  });
}
