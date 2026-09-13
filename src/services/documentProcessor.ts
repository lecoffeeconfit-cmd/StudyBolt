import type { DeckOutlineItem, ImportAsset, NoteBlock, StudyPack } from '../models';
import { ensureDistinctNoteLayers } from './noteLayers';

const ALLOWED_EXTENSIONS = ['pdf', 'ppt', 'pptx'];

export class StudyBoltProcessingError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
  }
}

export function validateImport(asset: ImportAsset): void {
  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
    throw new StudyBoltProcessingError(
      `Unsupported document extension: ${extension ?? 'none'}`,
      'StudyBolt currently accepts PDF, PPT, and PPTX files.',
    );
  }
  if (asset.size && asset.size > 50 * 1024 * 1024) {
    throw new StudyBoltProcessingError('Document exceeds 50 MB', 'Choose a file smaller than 50 MB and try again.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isOutlineItem(value: unknown): value is DeckOutlineItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.range === 'string';
}

function isSourceLinkedNote(value: unknown, detailed: boolean): value is NoteBlock {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || !isStringArray(value.bullets)) return false;
  if (!isRecord(value.source) || typeof value.source.sectionId !== 'string' || typeof value.source.label !== 'string') return false;
  if (!isStringArray(value.recallPrompts)) return false;
  if (!detailed) return typeof value.summary === 'string' && value.summary.trim().length > 0;
  return Array.isArray(value.sections)
    && value.sections.length > 0
    && value.sections.every((section) => isRecord(section) && typeof section.heading === 'string' && isStringArray(section.points));
}

function coversOutline(notes: NoteBlock[], outline: StudyPack['outline']): boolean {
  const covered = new Set(notes.map((note) => note.source.sectionId));
  return outline.every((section) => covered.has(section.id));
}

function isStudyPack(value: unknown): value is StudyPack {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<StudyPack>;
  const outline = Array.isArray(candidate.outline) ? candidate.outline : [];
  const notes = Array.isArray(candidate.notes) ? candidate.notes : [];
  const detailedNotes = Array.isArray(candidate.detailedNotes) ? candidate.detailedNotes : [];
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.originalText === 'string' &&
    typeof candidate.quickReview === 'string' &&
    outline.length > 0 &&
    outline.every(isOutlineItem) &&
    notes.length > 0 &&
    notes.every((note) => isSourceLinkedNote(note, false)) &&
    detailedNotes.length > 0 &&
    detailedNotes.every((note) => isSourceLinkedNote(note, true)) &&
    coversOutline(notes, outline) &&
    coversOutline(detailedNotes, outline) &&
    Array.isArray(candidate.flashcards) &&
    Array.isArray(candidate.quiz)
  );
}

export async function processDocument(asset: ImportAsset, courseName: string): Promise<StudyPack> {
  validateImport(asset);
  const endpoint = process.env.EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL;
  if (!endpoint) {
    throw new StudyBoltProcessingError(
      'EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL is not configured',
      'Your file is valid, but secure slide processing has not been connected yet. Use the sample pack to explore every study feature.',
    );
  }

  const form = new FormData();
  if (asset.file instanceof Blob) {
    form.append('file', asset.file, asset.name);
  } else {
    const nativeFile = { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
    form.append('file', nativeFile as unknown as Blob);
  }
  form.append('courseName', courseName);

  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', body: form });
  } catch {
    throw new StudyBoltProcessingError('Processor request failed', 'StudyBolt could not reach the secure processor. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new StudyBoltProcessingError(
      `Processor returned ${response.status}`,
      'StudyBolt could not process this file. The original file was not added to your library.',
    );
  }
  const payload: unknown = await response.json();
  if (!isStudyPack(payload)) {
    throw new StudyBoltProcessingError('Malformed StudyPack response', 'The generated study pack was incomplete. Please try processing the file again.');
  }
  return {
    ...payload,
    detailedNotes: ensureDistinctNoteLayers(payload.notes, payload.detailedNotes, payload.originalText, payload.outline),
  };
}
