import type { StudyPack } from '../models';
import { getFileExtension, getImportFormat, type ImportDocumentType } from '../../supabase/functions/_shared/importFormats.ts';

export { getFileExtension, UNSUPPORTED_DOCUMENT_MESSAGE } from '../../supabase/functions/_shared/importFormats.ts';
export type { ImportDocumentType };

// Mobile providers may report Office documents as ZIP or octet-stream.
export const DOCUMENT_PICKER_TYPE = '*/*' as const;

export function getImportDocumentType(name: string, mimeType?: string | null): ImportDocumentType | null {
  return getImportFormat(name, mimeType)?.type ?? null;
}

export function getImportFileName(name: string, mimeType?: string | null): string {
  const trimmed = name.trim().replace(/\.+$/, '') || 'study-material';
  if (getFileExtension(trimmed)) return trimmed;
  return `${trimmed}.${getImportFormat(trimmed, mimeType)?.extension ?? 'bin'}`;
}

export function getImportMimeType(name: string, mimeType?: string | null): string {
  return getImportFormat(name, mimeType)?.mimeType ?? 'application/octet-stream';
}

export function getImportDocumentLabel(name: string, mimeType?: string | null): string {
  return getImportFormat(name, mimeType)?.label ?? 'document';
}

export function studyPackFileType(documentType: ImportDocumentType): StudyPack['fileType'] {
  return documentType === 'powerpoint' ? 'pptx' : documentType;
}

export function documentIcon(documentType: ImportDocumentType): 'file-pdf-box' | 'microsoft-powerpoint' | 'note-text-outline' {
  if (documentType === 'powerpoint') return 'microsoft-powerpoint';
  if (documentType === 'pdf') return 'file-pdf-box';
  return 'note-text-outline';
}

export function pageLabel(fileType: StudyPack['fileType']): string {
  if (fileType === 'pdf') return 'pages';
  if (fileType === 'notes') return 'source pages';
  return 'slides';
}
