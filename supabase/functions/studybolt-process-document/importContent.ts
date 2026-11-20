import type { ImportFormat } from '../_shared/importFormats.ts';

export function readPlainDocument(bytes: Uint8Array): string {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
    : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  const text = new TextDecoder(encoding, { fatal: true }).decode(bytes).trim();
  if (/[\u0000-\u0008\u000B\u000E-\u001F]/.test(text)) throw new Error('Invalid plain text');
  return text;
}

// The API requires input_image for a screenshot and input_file for a document.
export function providerSource(format: ImportFormat, fileId: string) {
  return format.input === 'image'
    ? { type: 'input_image', file_id: fileId, detail: 'high' }
    : { type: 'input_file', file_id: fileId };
}

export const STUDY_GUIDE_INSTRUCTIONS = 'For a study guide, preserve its learning objectives, covered topics, definitions, worked examples, and original practice questions in source order. Keep any answer key paired with its questions. Mark questions the source does not answer as unanswered and do not invent solutions.';
export const UNREADABLE_DOCUMENT_MESSAGE = 'StudyBolt couldn’t read that file. If it’s locked or damaged, try an unlocked PDF export or choose a clearer copy.';
