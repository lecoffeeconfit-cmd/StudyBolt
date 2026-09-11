import { ImportAsset, StudyPack } from '../models';

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

function isStudyPack(value: unknown): value is StudyPack {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StudyPack>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.notes) &&
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
  return payload;
}
