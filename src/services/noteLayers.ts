import type { DeckOutlineItem, NoteBlock } from '../models';

function clean(value: string | undefined): string {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function sourceSentences(originalText: string): string[] {
  return originalText
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => clean(sentence))
    .filter((sentence) => sentence.length > 24);
}

function noteKey(note: NoteBlock): string {
  return [note.summary, ...note.bullets, ...(note.sections?.flatMap((section) => section.points) ?? [])]
    .map((value) => clean(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Keeps the two reading modes meaningfully different for legacy/imported packs.
 * Real processor output with sections is preserved; only empty or effectively
 * duplicated detailed layers are expanded with source wording and hierarchy.
 */
export function ensureDistinctNoteLayers(
  notes: NoteBlock[],
  detailedNotes: NoteBlock[] | undefined,
  originalText = '',
  outline: DeckOutlineItem[] = [],
): NoteBlock[] {
  const detailed = Array.isArray(detailedNotes) ? detailedNotes : [];
  const duplicate = detailed.length === 0 || notes.length === detailed.length && detailed.every((note, index) => {
    const simplified = notes[index];
    if (!simplified) return false;
    const hasHierarchy = Boolean(note.sections?.length && note.sections.some((section) => section.points.length > 0));
    const simpleBullets = simplified.bullets.map((bullet) => clean(bullet).toLowerCase());
    const detailPoints = note.sections?.flatMap((section) => section.points).map((point) => clean(point).toLowerCase()) ?? [];
    const sectionsOnlyRepeatBullets = detailPoints.length > 0
      && detailPoints.every((point) => simpleBullets.some((bullet) => bullet === point));
    const hasAdditionalValue = Boolean(note.connections?.length || note.examples?.length || (note.keyIdea && note.keyIdea !== simplified.keyIdea));
    return (!hasHierarchy && noteKey(note) === noteKey(simplified))
      || (hasHierarchy && sectionsOnlyRepeatBullets && !hasAdditionalValue);
  });
  if (!duplicate) return detailed;

  const sentences = sourceSentences(originalText);
  return notes.map((note, index) => {
    const existingSections = note.sections?.filter((section) => section.points.length > 0) ?? [];
    const start = sentences.length ? Math.floor((index / Math.max(1, notes.length)) * sentences.length) : 0;
    const end = sentences.length ? Math.max(start + 1, Math.floor(((index + 1) / Math.max(1, notes.length)) * sentences.length)) : 0;
    const sourcePoints = sentences.slice(start, end).slice(0, 8);
    const fallbackPoints = note.bullets.map((bullet) => clean(bullet)).filter(Boolean);
    const sections = existingSections.length ? existingSections : [
      {
        heading: outline[index]?.title ? `Source claims · ${outline[index].title}` : 'Source claims',
        points: sourcePoints.length >= 2 ? sourcePoints : fallbackPoints,
      },
      {
        heading: 'Study meaning',
        points: [clean(note.keyIdea ?? note.summary ?? fallbackPoints[0])].filter(Boolean),
      },
    ].filter((section) => section.points.length > 0);
    return {
      ...note,
      title: note.title,
      sections,
      connections: note.connections?.length ? note.connections : [clean(note.keyIdea ?? note.summary)].filter(Boolean),
      examples: note.examples?.length ? note.examples : undefined,
      recallPrompts: note.recallPrompts?.length ? note.recallPrompts : [`Explain ${note.title} in your own words.`],
    };
  });
}
