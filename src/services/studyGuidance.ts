export type GuidePage = 'home' | 'library' | 'planner' | 'stats' | 'pack' | 'discover';
export type GuideStatus = 'completed' | 'skipped';
export type GuideStep = { title: string; body: string; anchor?: string };
export type GuideDefinition = {
  id: string;
  version: number;
  page: GuidePage;
  kind: 'welcome' | 'tour' | 'tip' | 'update';
  title: string;
  steps: readonly GuideStep[];
};

export const GUIDES = [
  { id: 'welcome', version: 1, page: 'home', kind: 'welcome', title: 'Welcome to StudyBolt', steps: [
    { title: 'Welcome to StudyBolt', body: 'Turn your course material into a Study Pack, practice with it, and see your progress over time.' },
  ] },
  { id: 'home-basics', version: 1, page: 'home', kind: 'tour', title: 'Home', steps: [
    { anchor: 'home-plan', title: 'Today’s Learning Plan', body: 'See what to study next using your saved material, reviews, and Planner tasks.' },
    { anchor: 'home-import', title: 'Add course material', body: 'Choose a class and add slides, a document, or pasted notes to create a Study Pack.' },
    { anchor: 'home-tools', title: 'Study tools', body: 'Once a tool is ready, open it from Home or your Study Pack to start reviewing.' },
  ] },
  { id: 'library-basics', version: 1, page: 'library', kind: 'tour', title: 'Library', steps: [
    { anchor: 'library-class', title: 'Organize by class', body: 'Create a class with the plus button. Open a class to find its Study Packs.' },
    { anchor: 'library-search', title: 'Find saved material', body: 'Search by class or pack name, then tap a result to pick up where you left off.' },
  ] },
  { id: 'planner-basics', version: 1, page: 'planner', kind: 'tour', title: 'Planner', steps: [
    { anchor: 'planner-route', title: 'Your study route', body: 'The route estimates total time and time per study day. Choose your own material to replace the sample route.' },
    { anchor: 'planner-test', title: 'Study toward a test', body: 'Choose a pack or class, enter your test date, then build your plan to see what to study each day.' },
    { anchor: 'planner-progress', title: 'Read the two percentages', body: 'Mastery estimates learning from notes, flashcards, and practice scores. Plan completion tracks the study blocks you check off.' },
  ] },
  { id: 'stats-basics', version: 1, page: 'stats', kind: 'tour', title: 'Stats', steps: [
    { anchor: 'stats-scope', title: 'Choose which stats to see', body: 'Switch between one class and all classes. When you have multiple classes, swipe the knowledge card or use its arrows.' },
    { anchor: 'stats-knowledge', title: 'Read your knowledge estimate', body: 'The percentage shows the share of topics you recall consistently across study days. “Not assessed yet” means more evidence is needed.' },
    { anchor: 'stats-categories', title: 'Decide what to review next', body: 'Use Overview for a suggested next step, or open Insights and Quizzes to see where to practice.' },
  ] },
  { id: 'pack-basics', version: 1, page: 'pack', kind: 'tour', title: 'Study Pack tools', steps: [
    { anchor: 'pack-tools', title: 'Start with one tool', body: 'Use Notes to understand the material, then try ready Flashcards to recall it without looking.' },
    { anchor: 'pack-tools', title: 'Check what stuck', body: 'Use a ready Quiz to practice questions. If a tool is still preparing, you can start with one that’s ready.' },
  ] },
  { id: 'discover-basics', version: 1, page: 'discover', kind: 'tour', title: 'Discover', steps: [
    { anchor: 'discover-search', title: 'Find public study sets', body: 'Search by subject, course, or school. Open a public set to preview it before saving a copy.' },
    { title: 'Choose what to share', body: 'Your Study Packs stay private unless you choose to share them. Check the visibility option when creating a share link.' },
  ] },
  { id: 'pack-ready', version: 1, page: 'pack', kind: 'tip', title: 'Your first Study Pack', steps: [
    { title: 'Ready to practice?', body: 'Open Flashcards and try to answer before revealing the card.' },
  ] },
  { id: 'test-plan-saved', version: 1, page: 'planner', kind: 'tip', title: 'After building a test plan', steps: [
    { title: 'Take it one block at a time', body: 'Check off each study block in your day-by-day route as you finish it.' },
  ] },
  { id: 'knowledge-assessed', version: 1, page: 'stats', kind: 'tip', title: 'When readiness appears', steps: [
    { title: 'See what supports this score', body: 'Open Evidence and material details to see which topics show consistent recall.' },
  ] },
  // Only add kind: 'update' for a changed workflow. Its steps describe only the
  // change. Give unrelated features separate IDs; builds never reset a guide.
] as const satisfies readonly GuideDefinition[];

export type GuideId = typeof GUIDES[number]['id'];
export type GuideRecord = { version: number; status: GuideStatus; seenAt: number };
export type GuideProgress = Partial<Record<string, GuideRecord>>;
export type GuideState = { enrolled: boolean; guestClaim?: string; records: GuideProgress; pending: GuideProgress };
export const emptyGuideState = (): GuideState => ({ enrolled: false, records: {}, pending: {} });
export const GUIDANCE_GAP_MS = 60_000;
export const POMODORO_STORAGE_KEY = '@studybolt/pomodoro-timer/v1';
export const GUIDANCE_STORAGE_PREFIX = '@studybolt/guidance/v1/';
export const guideStateKey = (userId?: string) => GUIDANCE_STORAGE_PREFIX + (userId ? `account/${encodeURIComponent(userId)}` : 'guest');
export const guideFor = (id: GuideId): GuideDefinition => GUIDES.find(guide => guide.id === id)!;

export function mergeGuideProgress(previous: GuideProgress, incoming: GuideProgress): GuideProgress {
  const merged = { ...previous };
  for (const [id, next] of Object.entries(incoming)) {
    if (!next) continue;
    const old = merged[id];
    if (!old || next.version > old.version || (next.version === old.version && next.seenAt > old.seenAt)) merged[id] = next;
  }
  return merged;
}

export function unfinishedGuide(guide: GuideDefinition, state: GuideState) {
  return (state.records[guide.id]?.version ?? 0) < guide.version;
}

export function autoGuideEligible(guide: GuideDefinition, state: GuideState, page: GuidePage) {
  if (guide.page !== page || !unfinishedGuide(guide, state)) return false;
  if (guide.kind === 'update') return true;
  if (!state.enrolled) return false;
  if (guide.kind === 'welcome') return true;
  return state.records.welcome?.status === 'completed';
}

export function guidanceIsIdle({ busy, keyboard, foreground, timerKnown, focusUntil }: {
  busy: boolean; keyboard: boolean; foreground: boolean; timerKnown: boolean; focusUntil: number;
}, now = Date.now()) {
  return !busy && !keyboard && foreground && timerKnown && focusUntil <= now;
}

export function enrollGuidance(account: GuideState, guest: GuideState, userId: string) {
  if (account.enrolled) return { account, guest };
  const imported = guest.guestClaim && guest.guestClaim !== userId ? {} : guest.records;
  return {
    account: { ...account, enrolled: true, records: mergeGuideProgress(account.records, imported), pending: mergeGuideProgress(account.pending, imported) },
    guest: guest.guestClaim || !Object.keys(imported).length ? guest : { ...guest, guestClaim: userId },
  };
}

const metadataPrefix = 'studybolt_guide_';
const validId = /^[a-z][a-z0-9-]{0,63}$/;
function validRecord(value: unknown): value is GuideRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as GuideRecord;
  return Number.isSafeInteger(record.version) && record.version > 0
    && (record.status === 'completed' || record.status === 'skipped') && Number.isFinite(record.seenAt);
}

function parseProgress(value: unknown): GuideProgress {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value).filter(([id, item]) => validId.test(id) && validRecord(item)));
}

export function parseGuideState(raw: string | null): GuideState {
  try {
    const data = raw ? JSON.parse(raw) : null;
    return data ? { enrolled: data.enrolled === true, guestClaim: typeof data.guestClaim === 'string' ? data.guestClaim : undefined,
      records: parseProgress(data.records), pending: parseProgress(data.pending) } : emptyGuideState();
  } catch { return emptyGuideState(); }
}

export function readRemoteGuideState(metadata?: Record<string, unknown>) {
  let records: GuideProgress = {};
  for (const [key, entry] of Object.entries(metadata ?? {})) {
    if (!key.startsWith(metadataPrefix) || !validRecord(entry)) continue;
    const match = /^([a-z][a-z0-9-]{0,63})_v(\d+)$/.exec(key.slice(metadataPrefix.length));
    if (match && entry.version === Number(match[2])) records = mergeGuideProgress(records, { [match[1]!]: entry });
  }
  return { records, enrolled: metadata?.studybolt_guidance_enrolled_v1 === true };
}

export function guideMetadataPatch(records: GuideProgress, enrolled: boolean) {
  const data: Record<string, unknown> = {};
  if (enrolled) data.studybolt_guidance_enrolled_v1 = true;
  for (const [id, record] of Object.entries(records)) {
    if (validId.test(id) && validRecord(record)) data[`${metadataPrefix}${id}_v${record.version}`] = record;
  }
  return data;
}

export function removeSyncedGuides(pending: GuideProgress, sent: GuideProgress) {
  return Object.fromEntries(Object.entries(pending).filter(([id, next]) => {
    const accepted = sent[id];
    return next && (!accepted || accepted.version < next.version || (accepted.version === next.version && accepted.seenAt < next.seenAt));
  }));
}

export type GuideRect = { x: number; y: number; width: number; height: number };
export function fitGuideSpotlight(anchor: GuideRect | null, area: GuideRect, cardHeight: number) {
  if (!anchor || ![...Object.values(anchor), ...Object.values(area), cardHeight].every(Number.isFinite)
    || cardHeight <= 0 || cardHeight > area.height) return null;
  const gap = 10;
  const bounds = { x: anchor.x - 4, y: anchor.y - 4, width: anchor.width + 8, height: anchor.height + 8 };
  if (anchor.width <= 0 || anchor.height <= 0 || bounds.x < area.x || bounds.y < area.y
    || bounds.x + bounds.width > area.x + area.width || bounds.y + bounds.height > area.y + area.height) return null;
  const after = bounds.y + bounds.height + gap;
  const before = bounds.y - gap - cardHeight;
  if (after + cardHeight <= area.y + area.height) return { bounds, cardTop: after };
  if (before >= area.y) return { bounds, cardTop: before };
  return null;
}
