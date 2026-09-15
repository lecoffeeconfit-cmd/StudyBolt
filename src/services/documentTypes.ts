import type { StudyPack } from '../models';

export type ImportDocumentType = 'pdf' | 'powerpoint' | 'notes';

/**
 * Keep this list in one place. Some mobile document providers return a generic
 * MIME type for Office files, so the extension is still the source of truth
 * during validation.
 */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'ppt',
  'pptx',
  'txt',
  'md',
  'markdown',
  'rtf',
  'doc',
  'docx',
] as const;

// A few iOS/Android providers hide .pptx when given a MIME allow-list and
// report Office files as application/zip or application/octet-stream. Let the
// system picker show documents, then enforce the extension in validateImport.
export const DOCUMENT_PICKER_TYPE = '*/*' as const;

export function getFileExtension(name: string): string {
  const cleanName = name.trim().split(/[?#]/, 1)[0] ?? '';
  const lastDot = cleanName.lastIndexOf('.');
  return lastDot < 0 ? '' : cleanName.slice(lastDot + 1).toLowerCase();
}

export function getImportDocumentType(name: string, mimeType?: string | null): ImportDocumentType | null {
  const extension = getFileExtension(name);
  if (extension === 'pdf') return 'pdf';
  if (extension === 'ppt' || extension === 'pptx') return 'powerpoint';
  if (extension === 'txt' || extension === 'md' || extension === 'markdown' || extension === 'rtf' || extension === 'doc' || extension === 'docx') return 'notes';
  const mime = mimeType?.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'application/vnd.ms-powerpoint' || mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'powerpoint';
  if (mime === 'text/plain' || mime === 'text/markdown' || mime === 'application/rtf' || mime === 'application/msword' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'notes';
  return null;
}

export function getImportFileName(name: string, mimeType?: string | null): string {
  const trimmed = name.trim() || 'study-material';
  if (getFileExtension(trimmed)) return trimmed;
  const documentType = getImportDocumentType(trimmed, mimeType);
  const extension = documentType === 'pdf' ? 'pdf' : documentType === 'powerpoint' ? 'pptx' : documentType === 'notes' ? 'txt' : 'bin';
  return `${trimmed}.${extension}`;
}

export function studyPackFileType(documentType: ImportDocumentType): StudyPack['fileType'] {
  if (documentType === 'powerpoint') return 'pptx';
  return documentType;
}

export function documentTypeLabel(documentType: ImportDocumentType): string {
  if (documentType === 'powerpoint') return 'PowerPoint';
  if (documentType === 'pdf') return 'PDF';
  return 'notes';
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
