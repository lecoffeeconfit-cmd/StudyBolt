import type { DeckOutlineItem, ImportAsset, NoteBlock, StudyPack, StudyPackMaterial } from '../models';
import Constants from 'expo-constants';
import { ensureDistinctNoteLayers } from './noteLayers';
import {
  getFileExtension,
  getImportFileName,
  getImportMimeType,
  getImportDocumentType,
  studyPackFileType,
  SUPPORTED_DOCUMENT_EXTENSIONS,
} from './documentTypes';

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const PROCESSOR_TIMEOUT_MS = 180_000;
const BUILT_IN_PROCESSOR_URL = 'https://studybolt-api.duckdns.org/functions/v1/studybolt-process-document';
const manifestProcessorUrl = typeof Constants.expoConfig?.extra?.studyboltProcessorUrl === 'string'
  ? Constants.expoConfig.extra.studyboltProcessorUrl.trim()
  : '';

/**
 * Resolve the self-hosted VPS route from the build environment or manifest.
 * The built-in fallback intentionally points at the VPS so a missing EAS
 * environment variable cannot silently route document uploads to hosted Supabase.
 */
export function resolveProcessorEndpoint(): string {
  const customProcessorUrl = process.env.EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL?.trim();
  if (customProcessorUrl) return customProcessorUrl;
  if (manifestProcessorUrl) return manifestProcessorUrl;
  return BUILT_IN_PROCESSOR_URL;
}

export class StudyBoltProcessingError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
  ) {
    super(message);
  }
}

export const AUTOMATIC_STUDY_PACK_MATERIALS: StudyPackMaterial[] = [
  'simpleNotes',
  'detailedNotes',
  'keyConcepts',
  'flashcards',
  'audio',
  'quiz',
];

export const STUDY_PACK_MATERIAL_LABELS: Record<StudyPackMaterial, string> = {
  simpleNotes: 'Simplified Notes',
  detailedNotes: 'Detailed Notes',
  keyConcepts: 'Key Concepts',
  flashcards: 'Flashcards',
  audio: 'Audio Summary',
  quiz: 'Practice Quiz',
};

export const STUDY_PACK_MATERIAL_STAGES: Record<StudyPackMaterial, string> = {
  simpleNotes: 'Organizing notes…',
  detailedNotes: 'Creating detailed notes…',
  keyConcepts: 'Finding key concepts…',
  flashcards: 'Building flashcards…',
  audio: 'Preparing audio content…',
  quiz: 'Preparing your quiz…',
};

export function validateImport(asset: ImportAsset): void {
  if (!asset.uri?.trim()) {
    throw new StudyBoltProcessingError('Document URI is missing', 'The selected file could not be read. Please choose it again.');
  }
  const extension = getFileExtension(asset.name);
  const documentType = getImportDocumentType(asset.name, asset.mimeType);
  if (!documentType || (extension && !SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension as typeof SUPPORTED_DOCUMENT_EXTENSIONS[number]))) {
    throw new StudyBoltProcessingError(
      `Unsupported document extension: ${extension ?? 'none'}`,
      'Choose a PDF, PowerPoint, or notes file (.txt, .md, .rtf, .doc, or .docx).',
    );
  }
  if (typeof asset.size === 'number' && asset.size > MAX_IMPORT_BYTES) {
    throw new StudyBoltProcessingError('Document exceeds 100 MB', 'Choose a file smaller than 100 MB and try again.');
  }
  if (asset.size === 0) {
    throw new StudyBoltProcessingError('Document is empty', 'That file is empty. Choose a different file and try again.');
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

function isCompleteStudyPack(value: unknown): value is StudyPack {
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

function isExtractedStudyPack(value: unknown): value is StudyPack {
  if (!isRecord(value)) return false;
  const candidate = value as Partial<StudyPack>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.originalText === 'string'
    && candidate.originalText.trim().length > 0
    && Array.isArray(candidate.outline)
    && candidate.outline.length > 0
    && candidate.outline.every(isOutlineItem);
}

function queuedGeneration(): NonNullable<StudyPack['generation']> {
  const now = new Date().toISOString();
  return {
    materials: Object.fromEntries(AUTOMATIC_STUDY_PACK_MATERIALS.map((material) => [material, {
      status: 'queued' as const,
      stage: STUDY_PACK_MATERIAL_STAGES[material],
      updatedAt: now,
    }])) as NonNullable<StudyPack['generation']>['materials'],
  };
}

export async function processDocument(asset: ImportAsset, courseName: string, accessToken?: string | null): Promise<StudyPack> {
  validateImport(asset);
  const documentType = getImportDocumentType(asset.name, asset.mimeType);
  if (!documentType) {
    throw new StudyBoltProcessingError('Unsupported document type', 'Choose a PDF, PowerPoint, or notes file and try again.');
  }
  const endpoint = resolveProcessorEndpoint();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!endpoint) {
    throw new StudyBoltProcessingError(
      'EXPO_PUBLIC_STUDYBOLT_PROCESSOR_URL is not configured',
      'Your file is valid, but secure document processing has not been connected yet. Add a processor endpoint and try again.',
    );
  }

  const form = new FormData();
  const fileName = getImportFileName(asset.name, asset.mimeType);
  const mimeType = getImportMimeType(fileName, asset.mimeType);
  // DocumentPicker only supplies `file` on web. Native React Native fetch
  // expects its proprietary { uri, name, type } descriptor instead. Keeping
  // those paths explicit avoids the Blob/FormData mismatch on iOS builds.
  if (typeof Blob !== 'undefined' && asset.file instanceof Blob) {
    form.append('file', asset.file, fileName);
  } else {
    const nativeFile = { uri: asset.uri, name: fileName, type: mimeType };
    form.append('file', nativeFile as unknown as Blob);
  }
  form.append('courseName', courseName);
  form.append('documentType', documentType);
  form.append('extension', getFileExtension(fileName));
  form.append('action', 'extract');

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), PROCESSOR_TIMEOUT_MS) : null;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
      },
      body: form,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) {
      let serverMessage = '';
      try {
        const body = await response.json() as { error?: unknown; message?: unknown };
        serverMessage = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : '';
      } catch {
        // Keep the stable client message when the processor did not return JSON.
      }
      throw new StudyBoltProcessingError(
        `Processor returned ${response.status}${serverMessage ? `: ${serverMessage}` : ''}`,
        serverMessage || 'StudyBolt could not process this file. The original file was not added to your library.',
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new StudyBoltProcessingError('Processor returned invalid JSON', 'The document processor returned an unreadable response. Please try again.');
    }
    if (!isExtractedStudyPack(payload)) {
      throw new StudyBoltProcessingError('Malformed StudyPack response', 'The generated study pack was incomplete. Please try processing the file again.');
    }
    const legacyComplete = isCompleteStudyPack(payload);
    return {
      ...payload,
      fileName: payload.fileName || fileName,
      fileType: payload.fileType === 'pdf' || payload.fileType === 'notes' || payload.fileType === 'pptx'
        ? payload.fileType
        : studyPackFileType(documentType),
      courseName: payload.courseName || courseName,
      processedSource: payload.processedSource || payload.originalText,
      notes: legacyComplete ? payload.notes : [],
      detailedNotes: legacyComplete ? ensureDistinctNoteLayers(payload.notes, payload.detailedNotes, payload.originalText, payload.outline) : [],
      flashcards: legacyComplete ? payload.flashcards : [],
      quiz: legacyComplete ? payload.quiz : [],
      overview: payload.overview || '',
      quickReview: payload.quickReview || '',
      quizAttempts: Array.isArray(payload.quizAttempts) ? payload.quizAttempts : [],
      reviewedNoteIds: Array.isArray(payload.reviewedNoteIds) ? payload.reviewedNoteIds : [],
      audioPosition: typeof payload.audioPosition === 'number' ? payload.audioPosition : 0,
      studyMinutes: typeof payload.studyMinutes === 'number' ? payload.studyMinutes : 0,
      generation: legacyComplete ? {
        materials: Object.fromEntries(AUTOMATIC_STUDY_PACK_MATERIALS.map((material) => [material, {
          status: 'ready' as const,
          updatedAt: new Date().toISOString(),
        }])) as NonNullable<StudyPack['generation']>['materials'],
      } : queuedGeneration(),
    };
  } catch (error) {
    if (error instanceof StudyBoltProcessingError) throw error;
    if (controller?.signal.aborted) {
      throw new StudyBoltProcessingError('Processor request timed out', 'Document processing took too long. Check your connection and try again.');
    }
    throw new StudyBoltProcessingError('Processor request failed', 'StudyBolt could not reach the secure processor. Check your connection and try again.');
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export type GeneratedStudyPackMaterial = Partial<Pick<StudyPack, 'notes' | 'detailedNotes' | 'overview' | 'quickReview' | 'flashcards' | 'quiz' | 'audioSummary'>>;

export async function generateStudyPackMaterial(
  deck: StudyPack,
  material: StudyPackMaterial,
  accessToken?: string | null,
): Promise<GeneratedStudyPackMaterial> {
  const endpoint = resolveProcessorEndpoint();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), PROCESSOR_TIMEOUT_MS) : null;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : anonKey ? { Authorization: `Bearer ${anonKey}` } : {}),
      },
      body: JSON.stringify({
        action: 'generate',
        material,
        studyPackId: deck.id,
        title: deck.title,
        courseName: deck.courseName,
        fileName: deck.fileName,
        source: deck.processedSource || deck.originalText,
        outline: deck.outline,
      }),
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) {
      let serverMessage = '';
      try {
        const body = await response.json() as { error?: unknown; message?: unknown };
        serverMessage = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : '';
      } catch {
        // Keep a stable per-material error if the processor did not return JSON.
      }
      throw new StudyBoltProcessingError(
        `Material processor returned ${response.status}${serverMessage ? `: ${serverMessage}` : ''}`,
        serverMessage || `${STUDY_PACK_MATERIAL_LABELS[material]} could not be created.`,
      );
    }
    const payload = await response.json() as GeneratedStudyPackMaterial;
    if (!isRecord(payload)) throw new Error('Material response was not an object');
    if (material === 'simpleNotes' && (!Array.isArray(payload.notes) || !payload.notes.every((note) => isSourceLinkedNote(note, false)))) throw new Error('Simplified notes were incomplete');
    if (material === 'detailedNotes' && (!Array.isArray(payload.detailedNotes) || !payload.detailedNotes.every((note) => isSourceLinkedNote(note, true)))) throw new Error('Detailed notes were incomplete');
    if (material === 'keyConcepts' && (typeof payload.overview !== 'string' || typeof payload.quickReview !== 'string')) throw new Error('Key concepts were incomplete');
    if (material === 'flashcards' && !Array.isArray(payload.flashcards)) throw new Error('Flashcards were incomplete');
    if (material === 'quiz' && !Array.isArray(payload.quiz)) throw new Error('Quiz was incomplete');
    if (material === 'audio' && typeof payload.audioSummary !== 'string') throw new Error('Audio summary was incomplete');
    return payload;
  } catch (error) {
    if (error instanceof StudyBoltProcessingError) throw error;
    if (controller?.signal.aborted) {
      throw new StudyBoltProcessingError('Material request timed out', `${STUDY_PACK_MATERIAL_LABELS[material]} took too long. Retry just this item.`);
    }
    throw new StudyBoltProcessingError('Material request failed', `${STUDY_PACK_MATERIAL_LABELS[material]} could not reach the secure processor. Retry just this item.`);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
