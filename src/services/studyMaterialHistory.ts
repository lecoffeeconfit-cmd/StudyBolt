import type { StudyClass, StudyPack } from '../models';

interface HistoryPack {
  deck: StudyPack;
  filenames: string[];
}

interface HistoryClass {
  id: string;
  name: string;
  color: string;
  packs: HistoryPack[];
}

export interface StudySemester {
  label: string;
  classes: HistoryClass[];
  packCount: number;
}

/** Use local dates so an upload near midnight falls in the student's calendar. */
function semesterFor(timestamp: number) {
  if (!Number.isFinite(timestamp)) return { key: -Infinity, label: 'Unknown date' };
  const date = new Date(timestamp);
  const month = date.getMonth();
  const term = month < 5 ? 0 : month < 7 ? 1 : 2;
  const year = date.getFullYear();
  return { key: year * 3 + term, label: `${['Spring', 'Summer', 'Fall'][term]} ${year}` };
}

export function buildStudyMaterialHistory(decks: StudyPack[], classes: StudyClass[]) {
  const classesById = new Map(classes.map(course => [course.id, course]));
  const sampleClassIds = new Set(decks.filter(deck => deck.fileType === 'demo').map(deck => deck.courseId));
  const savedPacks = [...new Map(decks.filter(deck => deck.fileType !== 'demo').map(deck => [deck.id, deck])).values()];
  const classIdsWithPacks = new Set(savedPacks.map(deck => deck.courseId));
  const visibleClassIds = new Set([...classesById.keys()]
    .filter(id => !sampleClassIds.has(id) || classIdsWithPacks.has(id))
    .map(id => `class:${id}`));
  const semesters = new Map<number, { label: string; classes: Map<string, HistoryClass>; packCount: number }>();
  const ordered = savedPacks.map(deck => {
    const parsed = Date.parse(deck.createdAt);
    return { deck, timestamp: Number.isFinite(parsed) ? parsed : -Infinity };
  }).sort((a, b) => b.timestamp - a.timestamp || a.deck.id.localeCompare(b.deck.id));
  let materialCount = 0;

  for (const { deck, timestamp } of ordered) {
    const { key, label } = semesterFor(timestamp);
    const semester = semesters.get(key) ?? { label, classes: new Map<string, HistoryClass>(), packCount: 0 };
    semesters.set(key, semester);
    const course = classesById.get(deck.courseId);
    const name = course?.name || deck.courseName?.trim();
    const id = course ? `class:${course.id}` : name ? `legacy:${deck.courseId || name}` : 'unassigned';
    if (name) visibleClassIds.add(id);
    const group = semester.classes.get(id) ?? {
      id, name: name || 'Unassigned materials', color: course?.color ?? deck.color, packs: [],
    };
    semester.classes.set(id, group);
    const sources = deck.sourceFileNames?.map(name => name.trim()).filter(Boolean);
    const filenames = sources?.length ? sources : [deck.fileName?.trim()].filter((name): name is string => Boolean(name));
    group.packs.push({ deck, filenames });
    semester.packCount += 1;
    materialCount += Math.max(1, filenames.length);
  }

  return {
    semesters: [...semesters.values()].map(({ label, classes: groups, packCount }): StudySemester => ({
      label, classes: [...groups.values()], packCount,
    })),
    classCount: visibleClassIds.size,
    materialCount,
  };
}
