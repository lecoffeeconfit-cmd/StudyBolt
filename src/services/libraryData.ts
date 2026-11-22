import type { StudyBoltState, StudyClass, StudyPack } from '../models';

export type LibraryItem =
  | { kind: 'class'; item_id: string; edited_at: string; content: StudyClass }
  | { kind: 'pack'; item_id: string; edited_at: string; content: StudyPack };

type LibraryEntity = { id: string; createdAt: string; libraryModifiedAt?: string };
const DEVICE_PACK_FIELDS = new Set(['reviewedNoteIds', 'quizAttempts', 'testAttempts', 'studyMinutes', 'audioPosition', 'originalUri', 'libraryModifiedAt', 'flashcards']);

export function libraryVersion(item: LibraryEntity): number {
  const stamp = Date.parse(item.libraryModifiedAt ?? item.createdAt);
  return Number.isFinite(stamp) ? stamp : 0;
}

export function markLibraryEdit<T extends LibraryEntity>(item: T, now = Date.now()): T {
  return { ...item, libraryModifiedAt: new Date(Math.max(now, libraryVersion(item) + 1)).toISOString() };
}

function classCopy(course: StudyClass): StudyClass {
  const { id, name, color, emoji, createdAt, iconId } = course;
  return { id, name, color, emoji, createdAt, ...(iconId === undefined ? {} : { iconId }) };
}

export function updateClassAppearance(classes: StudyClass[], original: StudyClass, appearance: Pick<StudyClass, 'iconId' | 'color'>): StudyClass[] {
  const current = classes.find(course => course.id === original.id);
  if (current?.color === appearance.color && current.iconId === appearance.iconId) return classes;
  const updated = markLibraryEdit({ ...(current ?? original), ...appearance });
  return current ? classes.map(course => course.id === updated.id ? updated : course) : [...classes, updated];
}

function portablePack(pack: StudyPack): StudyPack {
  const { originalUri, sharedFromToken, originalCreatorId, originalSetId, communityClassId, libraryModifiedAt, ...content } = pack;
  return {
    ...content,
    reviewedNoteIds: [],
    quizAttempts: [],
    testAttempts: undefined,
    audioPosition: 0,
    studyMinutes: 0,
    flashcards: pack.flashcards.map(card => ({ ...card, confidence: 'new', imageUrl: undefined })),
    visuals: pack.visuals?.map(visual => ({ ...visual, imageUrl: undefined, imageReference: undefined })),
  };
}

export function hasLibraryContentChanges(before: StudyPack, after: StudyPack): boolean {
  if (before.fileType === 'demo') return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)] as (keyof StudyPack)[]);
  for (const key of keys) {
    if (!DEVICE_PACK_FIELDS.has(key) && before[key] !== after[key]) return true;
  }
  if (before.flashcards === after.flashcards) return false;
  if (before.flashcards.length !== after.flashcards.length) return true;
  return before.flashcards.some((card, index) => {
    const next = after.flashcards[index]!;
    if (card === next) return false;
    const { confidence: _previous, ...oldContent } = card;
    const { confidence: _next, ...newContent } = next;
    return JSON.stringify(oldContent) !== JSON.stringify(newContent);
  });
}

function originalClasses(classes: StudyClass[], sampleIds: ReadonlySet<string>, packs: StudyPack[]) {
  const used = new Set(packs.map(pack => pack.courseId));
  return classes.filter(course => !sampleIds.has(course.id) || used.has(course.id));
}

export function localLibraryItems(state: StudyBoltState, sampleIds: ReadonlySet<string>): LibraryItem[] {
  const packs = state.decks.filter(pack => pack.fileType !== 'demo');
  const entries: LibraryItem[] = originalClasses(state.classes, sampleIds, packs).map(course => ({
    kind: 'class', item_id: course.id, edited_at: new Date(libraryVersion(course)).toISOString(), content: classCopy(course),
  }));
  for (const pack of packs) {
    // Pending jobs belong to the device that started them. Publish when its material generation has settled.
    if (pack.generation && Object.values(pack.generation.materials).some(material => material.status === 'queued' || material.status === 'generating')) continue;
    entries.push({ kind: 'pack', item_id: pack.id, edited_at: new Date(libraryVersion(pack)).toISOString(), content: portablePack(pack) });
  }
  return entries;
}

export function mergeLibraryItems(state: StudyBoltState, items: LibraryItem[]): StudyBoltState {
  if (!items.length) return state;
  const classes = new Map(state.classes.map(course => [course.id, course]));
  const packs = new Map(state.decks.map(pack => [pack.id, pack]));
  let changed = false;
  for (const item of items) {
    const revision = Date.parse(item.edited_at);
    if (!Number.isFinite(revision)) continue;
    if (item.kind === 'class') {
      const local = classes.get(item.item_id);
      if (local && libraryVersion(local) >= revision) continue;
      classes.set(item.item_id, { ...item.content, libraryModifiedAt: item.edited_at });
    } else {
      const local = packs.get(item.item_id);
      if (local && libraryVersion(local) >= revision) continue;
      if (local?.generation && Object.values(local.generation.materials).some(material => material.status === 'generating' || material.status === 'queued')) continue;
      const confidence = new Map(local?.flashcards.map(card => [card.id, card.confidence]));
      packs.set(item.item_id, {
        ...item.content,
        originalUri: local?.originalUri,
        reviewedNoteIds: local?.reviewedNoteIds ?? [],
        quizAttempts: local?.quizAttempts ?? [],
        testAttempts: local?.testAttempts,
        audioPosition: local?.audioPosition ?? 0,
        studyMinutes: local?.studyMinutes ?? 0,
        flashcards: item.content.flashcards.map(card => ({ ...card, confidence: confidence.get(card.id) ?? 'new' })),
        libraryModifiedAt: item.edited_at,
      });
      if (!classes.has(item.content.courseId)) {
        const { courseId, courseName, color, emoji, createdAt } = item.content;
        classes.set(courseId, { id: courseId, name: courseName, color, emoji, createdAt });
      }
    }
    changed = true;
  }
  return changed ? { ...state, classes: [...classes.values()], decks: [...packs.values()] } : state;
}

export function guestPacksToSave(guest: StudyBoltState, account: StudyBoltState): StudyPack[] {
  const accountIds = new Set(account.decks.map(pack => pack.id));
  return guest.decks.filter(pack => pack.fileType !== 'demo' && !accountIds.has(pack.id));
}

export function copyGuestLibrary(account: StudyBoltState, guest: StudyBoltState): StudyBoltState {
  const packs = guestPacksToSave(guest, account);
  const personalCourseIds = new Set(guest.decks.filter(pack => pack.fileType !== 'demo').map(pack => pack.courseId));
  const demoOnlyCourseIds = new Set(guest.decks.filter(pack => pack.fileType === 'demo' && !personalCourseIds.has(pack.courseId)).map(pack => pack.courseId));
  const accountCourseIds = new Set(account.classes.map(course => course.id));
  // Keep empty guest-created courses too, while excluding courses used only
  // by the built-in sample packs.
  const courses = guest.classes.filter(course => !demoOnlyCourseIds.has(course.id) && !accountCourseIds.has(course.id));
  if (!packs.length && !courses.length) return account;
  return {
    ...account,
    classes: [...account.classes, ...courses.map(course => markLibraryEdit(course))],
    decks: [...packs.map(pack => markLibraryEdit(pack)), ...account.decks],
  };
}
