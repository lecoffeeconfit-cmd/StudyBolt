// Used by both the app's picker validation and the Edge Function.
export type ImportDocumentType = 'pdf' | 'powerpoint' | 'notes';
export type ImportFormat = {
  type: ImportDocumentType;
  mimeType: string;
  input: 'text' | 'file' | 'image';
  label: string;
};

const documentFile = (mimeType: string, label: string): ImportFormat => ({ type: 'notes', mimeType, input: 'file', label });
const plainText = (mimeType: string, label: string): ImportFormat => ({ type: 'notes', mimeType, input: 'text', label });
const imageFile = (mimeType: string): ImportFormat => ({ type: 'notes', mimeType, input: 'image', label: 'image' });
const slides = (mimeType: string): ImportFormat => ({ type: 'powerpoint', mimeType, input: 'file', label: 'PowerPoint' });

const formats = {
  pdf: { type: 'pdf', mimeType: 'application/pdf', input: 'file', label: 'PDF' },
  pptx: slides('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  ppt: slides('application/vnd.ms-powerpoint'),
  docx: documentFile('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word document'),
  doc: documentFile('application/msword', 'Word document'),
  rtf: documentFile('application/rtf', 'rich text document'),
  odt: documentFile('application/vnd.oasis.opendocument.text', 'OpenDocument text'),
  pages: documentFile('application/vnd.apple.pages', 'Pages document'),
  key: documentFile('application/vnd.apple.keynote', 'Keynote presentation'),
  txt: plainText('text/plain', 'text document'),
  text: plainText('text/plain', 'text document'),
  md: plainText('text/markdown', 'Markdown document'),
  markdown: plainText('text/markdown', 'Markdown document'),
  rst: plainText('text/x-rst', 'text document'),
  tex: plainText('text/x-tex', 'LaTeX document'),
  json: plainText('application/json', 'JSON document'),
  xml: plainText('application/xml', 'XML document'),
  srt: plainText('application/x-subrip', 'transcript'),
  vtt: plainText('text/vtt', 'transcript'),
  html: documentFile('text/html', 'HTML document'),
  htm: documentFile('text/html', 'HTML document'),
  xlsx: documentFile('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'spreadsheet'),
  xls: documentFile('application/vnd.ms-excel', 'spreadsheet'),
  csv: documentFile('text/csv', 'spreadsheet'),
  tsv: documentFile('text/tab-separated-values', 'spreadsheet'),
  png: imageFile('image/png'),
  jpg: imageFile('image/jpeg'),
  jpeg: imageFile('image/jpeg'),
  webp: imageFile('image/webp'),
} satisfies Record<string, ImportFormat>;

type Extension = keyof typeof formats;
export const SUPPORTED_DOCUMENT_EXTENSIONS = Object.keys(formats) as Extension[];
export const UNSUPPORTED_DOCUMENT_MESSAGE = 'Choose a PDF, Word or Pages document, presentation, text file, spreadsheet, or JPEG, PNG, or WebP image. You can export other formats as PDF and try again.';

const mimeAliases: Partial<Record<string, Extension>> = {
  'text/rtf': 'rtf',
  'text/tsv': 'tsv',
  'text/xml': 'xml',
  'application/csv': 'csv',
};

export function getFileExtension(name: string): string {
  const cleanName = name.trim();
  const lastDot = cleanName.lastIndexOf('.');
  return lastDot < 0 ? '' : cleanName.slice(lastDot + 1).toLowerCase();
}

export function getImportFormat(name: string, mimeType?: string | null): (ImportFormat & { extension: Extension }) | null {
  const extension = getFileExtension(name);
  const mime = mimeType?.split(';', 1)[0]?.trim().toLowerCase();
  // A recognized MIME can recover extensionless files. It cannot override an
  // unsupported extension, and generic MIME types never determine the format.
  const supported = extension
    ? SUPPORTED_DOCUMENT_EXTENSIONS.find(candidate => candidate === extension)
    : SUPPORTED_DOCUMENT_EXTENSIONS.find(candidate => formats[candidate].mimeType === mime)
      ?? (mime && Object.hasOwn(mimeAliases, mime) ? mimeAliases[mime] : undefined);
  return supported ? { ...formats[supported], extension: supported } : null;
}
