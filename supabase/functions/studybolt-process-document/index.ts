import { createClient } from 'npm:@supabase/supabase-js@2';
import { extractPptxLocally, type LocalVisualKnowledge, type PptxLocalExtraction } from './pptxVisuals.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 100 * 1024 * 1024;
const MAX_COURSE_NAME = 120;
const TEXT_NOTE_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const POWERPOINT_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type ImportDocumentType = 'pdf' | 'powerpoint' | 'notes';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) return json({ error: 'Secure document processing is not configured yet.' }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'The upload could not be read. Please choose the file again.' }, 400);
  }

  const fileValue = form.get('file');
  if (!(fileValue instanceof File)) return json({ error: 'Choose a PDF, PowerPoint, or notes file.' }, 400);
  if (fileValue.size <= 0) return json({ error: 'That file is empty. Choose a different file.' }, 400);
  if (fileValue.size > MAX_BYTES) return json({ error: 'Choose a file smaller than 100 MB and try again.' }, 413);

  const fileName = safeFileName(fileValue.name || 'study-material');
  const documentType = getDocumentType(fileName);
  if (!documentType) return json({ error: 'Choose a PDF, PowerPoint, or notes file.' }, 415);
  const courseName = stringValue(form.get('courseName')).slice(0, MAX_COURSE_NAME) || 'My class';
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  const mimeType = contentType(fileValue.type, documentType, extension);
  const documentId = crypto.randomUUID();
  let bytes: Uint8Array | null = null;
  let localPptx: PptxLocalExtraction | null = null;
  let uploadedFileId: string | null = null;
  let response: Response;
  try {
    if (documentType === 'powerpoint') {
      bytes = new Uint8Array(await fileValue.arrayBuffer());
      try {
        localPptx = await extractPptxLocally(bytes);
      } catch (error) {
        console.error('studybolt-process-document: local PPTX extraction failed', error);
      }
    }
    const sourceParts = TEXT_NOTE_EXTENSIONS.has(extension)
      ? sourceContent(bytes ?? new Uint8Array(await fileValue.arrayBuffer()), fileName)
      : [{ type: 'input_file', file_id: await uploadProviderFile(fileValue, fileName, mimeType) }];
    if (sourceParts[0]?.file_id) uploadedFileId = sourceParts[0].file_id;
    if (localPptx?.sourceText) sourceParts.unshift({ type: 'input_text', text: `LOCAL POWERPOINT EXTRACTION (no external visual AI was used):\n${localPptx.sourceText}` });
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('STUDYBOLT_PROCESSOR_MODEL') || 'gpt-5.6-luna',
        store: false,
        reasoning: { effort: 'low' },
        instructions: processorInstructions(documentType, fileName),
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: `Course name: ${courseName}\nSource file: ${fileName}\nSource type: ${documentType}` },
            ...sourceParts,
          ],
        }],
        text: {
          verbosity: 'low',
          format: { type: 'json_schema', name: 'studybolt_study_pack_content', strict: true, schema: STUDY_PACK_SCHEMA },
        },
        max_output_tokens: 28_000,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    console.error('studybolt-process-document: provider request failed', error);
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    if (error instanceof Error && error.message === 'The notes file is empty.') {
      return json({ error: 'That notes file is empty. Choose a different file.' }, 400);
    }
    return json({ error: 'StudyBolt could not reach the document processor. Check your connection and try again.' }, 502);
  }

  if (!response.ok) {
    const providerError = await responseError(response);
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    return json({ error: providerError || 'The document processor could not read this file.' }, 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    return json({ error: 'The document processor returned an unreadable response.' }, 502);
  }
  if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);

  try {
    const content = JSON.parse(outputText(payload)) as Record<string, unknown>;
    const owner = await resolveOwner(request);
    if (owner && localPptx?.visuals.length) await persistVisualSession(owner, documentId, fileName, localPptx.visuals);
    return json(buildStudyPack(content, { courseName, fileName, documentType }, localPptx, documentId));
  } catch (error) {
    console.error('studybolt-process-document: invalid generated pack', error);
    return json({ error: 'The generated study pack was incomplete. Please try processing the file again.' }, 502);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeFileName(value: string): string {
  return value.replace(/[\\/\u0000-\u001F]/g, '_').slice(0, 180) || 'study-material';
}

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  return index < 0 ? '' : fileName.slice(index + 1).toLowerCase();
}

function getDocumentType(fileName: string): ImportDocumentType | null {
  const extension = extensionOf(fileName);
  if (extension === 'pdf') return 'pdf';
  if (extension === 'ppt' || extension === 'pptx') return 'powerpoint';
  if (['txt', 'md', 'markdown', 'rtf', 'doc', 'docx'].includes(extension)) return 'notes';
  return null;
}

function contentType(fileType: string, documentType: ImportDocumentType, extension: string): string {
  if (documentType === 'pdf') return 'application/pdf';
  if (documentType === 'powerpoint') return extension === 'ppt' ? 'application/vnd.ms-powerpoint' : POWERPOINT_MIME;
  if (extension === 'md' || extension === 'markdown') return 'text/markdown';
  if (extension === 'rtf') return 'application/rtf';
  if (extension === 'doc') return 'application/msword';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (fileType && fileType.includes('/')) return fileType;
  return 'text/plain';
}

function sourceContent(bytes: Uint8Array, fileName: string): Array<Record<string, string>> {
  const text = new TextDecoder().decode(bytes).replace(/\u0000/g, '').trim();
  if (!text) throw new Error('The notes file is empty.');
  return [{ type: 'input_text', text: `VERBATIM NOTES FROM ${fileName}\n${text.slice(0, 180_000)}` }];
}

async function uploadProviderFile(source: Blob, fileName: string, mimeType: string): Promise<string> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) throw new Error('Missing OpenAI key');
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', source, fileName);
  const response = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`File upload returned ${response.status}`);
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== 'string' || !payload.id) throw new Error('Provider did not return a file ID');
  return payload.id;
}

async function deleteProviderFile(fileId: string, openAiKey: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${openAiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    console.error('studybolt-process-document: provider file cleanup failed');
  }
}

function processorInstructions(documentType: ImportDocumentType, fileName: string): string {
  const sourceLabel = documentType === 'powerpoint' ? 'PowerPoint presentation' : documentType === 'pdf' ? 'PDF' : 'student notes';
  return [
    'You are StudyBolt document processor.',
    `Read the attached ${sourceLabel} (${fileName}) as the only source of truth.`,
    'Extract the source in its original order before writing the study pack. Do not invent facts, fill gaps with general knowledge, or silently omit meaningful claims.',
    'Return the requested structured content only. Use section-1, section-2, and so on for outline IDs, and make exactly one simplified note and one detailed note for every outline section in the same order.',
    'The simplified layer should be concise: one summary, a short list of core ideas, one key idea, and retrieval prompts. The detailed layer should retain the meaningful source claims in hierarchical subsections, connections, grounded examples when present, and retrieval prompts. The two layers must not be duplicate copies.',
    'Every flashcard and quiz question must be answerable from the source and must include the matching source section ID. Use a mix of the source’s most important concepts, not filler.',
    'Before returning, re-scan the source for missing sections, claims, and source links. If the source is sparse, produce fewer grounded cards rather than inventing content.',
  ].join(' ');
}

function responseError(response: Response): Promise<string> {
  return response.json()
    .then((value: unknown) => {
      if (!isRecord(value)) return '';
      const error = isRecord(value.error) ? stringValue(value.error.message) : stringValue(value.error);
      return error.slice(0, 300);
    })
    .catch(() => '');
}

function outputText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === 'string') return payload.output_text;
  if (!isRecord(payload) || !Array.isArray(payload.output)) throw new Error('Missing model output');
  for (const item of payload.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('Missing model output text');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, fallback: string): string {
  return stringValue(value) || fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  return values.length ? values : fallback;
}

function rawOutline(value: unknown): Array<{ title: string; range: string }> {
  if (!Array.isArray(value)) throw new Error('Missing outline');
  const result = value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    return [{ title: text(item.title, `Section ${index + 1}`), range: text(item.range, `Section ${index + 1}`) }];
  });
  if (!result.length) throw new Error('Missing outline');
  return result.slice(0, 80);
}

function buildStudyPack(content: Record<string, unknown>, meta: { courseName: string; fileName: string; documentType: ImportDocumentType }, localPptx?: PptxLocalExtraction | null, documentId?: string) {
  const rawSections = rawOutline(content.outline);
  const outline = rawSections.map((section, index) => ({ id: `section-${index + 1}`, title: section.title, range: section.range }));
  const notes = normalizeNotes(content.notes, false, outline);
  const detailedNotes = normalizeNotes(content.detailedNotes, true, outline);
  const createdAt = new Date().toISOString();
  const visuals = localPptx?.visuals.map((visual) => ({ ...visual, ...(documentId ? { documentId } : {}) })) ?? [];
  return {
    id: `pack-${crypto.randomUUID()}`,
    courseId: `course-${slug(meta.courseName)}`,
    courseName: meta.courseName,
    title: text(content.title, meta.fileName.replace(/\.[^.]+$/, '')),
    subtitle: text(content.subtitle, `Source-grounded review from ${meta.fileName}`),
    fileName: meta.fileName,
    fileType: meta.documentType === 'powerpoint' ? 'pptx' : meta.documentType,
    pageCount: positiveInteger(content.pageCount, 1),
    createdAt,
    order: 0,
    color: '#418DFF',
    emoji: meta.documentType === 'notes' ? '📝' : meta.documentType === 'pdf' ? '📄' : '📊',
    outline,
    overview: text(content.overview, text(content.quickReview, 'A source-grounded overview of the uploaded material.')),
    originalText: text(content.originalText, text(content.quickReview, 'The uploaded material was processed into this Study Pack.')),
    quickReview: text(content.quickReview, text(content.overview, 'Review the core ideas in source order.')),
    notes,
    detailedNotes,
    flashcards: normalizeFlashcards(content.flashcards, outline),
    quiz: normalizeQuiz(content.quiz, outline),
    quizAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
    ...(visuals.length ? { visuals } : {}),
    ...(localPptx?.summary ? { visualSummary: localPptx.summary } : {}),
  };
}

async function resolveOwner(request: Request): Promise<{ userId: string; admin: ReturnType<typeof createClient> } | null> {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !supabaseUrl || !serviceRoleKey) return null;
  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user } } = await admin.auth.getUser(token);
    return user ? { userId: user.id, admin } : null;
  } catch {
    return null;
  }
}

async function persistVisualSession(owner: { userId: string; admin: ReturnType<typeof createClient> }, documentId: string, fileName: string, visuals: LocalVisualKnowledge[]): Promise<void> {
  try {
    const { error: documentError } = await owner.admin.from('studybolt_visual_documents').insert({
      document_id: documentId,
      owner_user_id: owner.userId,
      source_file_name: fileName,
    });
    if (documentError) throw documentError;
    const rows = visuals.map((visual) => ({
      document_id: documentId,
      visual_id: visual.id,
      owner_user_id: owner.userId,
      slide_number: visual.slideNumber,
      slide_title: visual.slideTitle,
      image_hash: visual.imageHash,
      visual_type: visual.visualType,
      educational_importance: visual.educationalImportance,
      local_confidence: visual.localConfidence,
      needs_user_review: visual.needsUserReview,
      status: visual.status,
      reason: visual.reason ?? null,
    }));
    if (rows.length) {
      const { error } = await owner.admin.from('studybolt_visuals').insert(rows);
      if (error) throw error;
    }
  } catch (error) {
    console.error('studybolt-process-document: visual session persistence failed', error);
  }
}

function normalizeNotes(value: unknown, detailed: boolean, outline: Array<{ id: string; title: string; range: string }>) {
  if (!Array.isArray(value) || value.length < outline.length) throw new Error(`Missing ${detailed ? 'detailed ' : ''}notes`);
  return outline.map((section, index) => {
    const item = value[index];
    const title = isRecord(item) ? text(item.title, section.title) : section.title;
    const summary = isRecord(item) ? text(item.summary, text(item.keyIdea, title)) : title;
    const bullets = isRecord(item) ? stringArray(item.bullets, [summary]) : [summary];
    const sections = isRecord(item) && Array.isArray(item.sections)
      ? item.sections.flatMap((entry) => {
          if (!isRecord(entry)) return [];
          return [{ heading: text(entry.heading, 'Key details'), points: stringArray(entry.points, bullets) }];
        })
      : [];
    if (detailed && !sections.length) sections.push({ heading: 'Key details', points: bullets });
    return {
      id: `${detailed ? 'detailed-note' : 'note'}-${index + 1}`,
      title,
      summary,
      bullets,
      sections,
      connections: isRecord(item) ? stringArray(item.connections, []) : [],
      examples: isRecord(item) ? stringArray(item.examples, []) : [],
      recallPrompts: isRecord(item) ? stringArray(item.recallPrompts, [`What is the main idea of ${title}?`]) : [`What is the main idea of ${title}?`],
      keyIdea: isRecord(item) ? text(item.keyIdea, summary) : summary,
      source: { sectionId: section.id, label: section.range },
    };
  });
}

function normalizeFlashcards(value: unknown, outline: Array<{ id: string; title: string; range: string }>) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = sourceForGeneratedItem(item, index, outline);
    return [{
      id: text(item.id, `flashcard-${index + 1}`),
      front: text(item.front, `What is the key idea in ${source.title}?`),
      back: text(item.back, 'Review the linked source note for the answer.'),
      explanation: text(item.explanation, ''),
      confidence: 'new' as const,
      source: { sectionId: source.id, label: source.range },
    }];
  });
}

function normalizeQuiz(value: unknown, outline: Array<{ id: string; title: string; range: string }>) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const source = sourceForGeneratedItem(item, index, outline);
    const options = stringArray(item.options, ['Review the source note', 'The source does not say', 'None of these', 'All of these']).slice(0, 4);
    while (options.length < 2) options.push(`Option ${options.length + 1}`);
    const correctIndex = Math.max(0, Math.min(options.length - 1, positiveInteger(item.correctIndex, 0)));
    return [{
      id: text(item.id, `quiz-${index + 1}`),
      type: 'multiple-choice' as const,
      prompt: text(item.prompt, `Which statement matches ${source.title}?`),
      options,
      correctIndex,
      explanation: text(item.explanation, 'Review the linked source note for the explanation.'),
      source: { sectionId: source.id, label: source.range },
      difficulty: item.difficulty === 'easy' || item.difficulty === 'hard' ? item.difficulty : 'medium' as const,
    }];
  });
}

function sourceForGeneratedItem(item: Record<string, unknown>, index: number, outline: Array<{ id: string; title: string; range: string }>) {
  const requestedId = isRecord(item.source) ? stringValue(item.source.sectionId) : '';
  return outline.find((section) => section.id === requestedId) ?? outline[index % outline.length] ?? outline[0]!;
}

function positiveInteger(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'general';
}

const SOURCE_REFERENCE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { sectionId: { type: 'string' }, label: { type: 'string' } },
  required: ['sectionId', 'label'],
};
const SECTION_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { heading: { type: 'string' }, points: { type: 'array', items: { type: 'string' }, minItems: 1 } },
  required: ['heading', 'points'],
};
const NOTE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, title: { type: 'string' }, summary: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' }, minItems: 1 },
    sections: { type: 'array', items: SECTION_SCHEMA },
    connections: { type: 'array', items: { type: 'string' } }, examples: { type: 'array', items: { type: 'string' } },
    recallPrompts: { type: 'array', items: { type: 'string' }, minItems: 1 }, keyIdea: { type: 'string' },
    source: SOURCE_REFERENCE_SCHEMA,
  },
  required: ['id', 'title', 'summary', 'bullets', 'sections', 'connections', 'examples', 'recallPrompts', 'keyIdea', 'source'],
};
const FLASHCARD_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, front: { type: 'string' }, back: { type: 'string' }, explanation: { type: 'string' },
    confidence: { type: 'string', enum: ['new'] }, source: SOURCE_REFERENCE_SCHEMA,
  },
  required: ['id', 'front', 'back', 'explanation', 'confidence', 'source'],
};
const QUIZ_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    id: { type: 'string' }, type: { type: 'string', enum: ['multiple-choice'] }, prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 }, correctIndex: { type: 'integer', minimum: 0, maximum: 3 },
    explanation: { type: 'string' }, source: SOURCE_REFERENCE_SCHEMA, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
  required: ['id', 'type', 'prompt', 'options', 'correctIndex', 'explanation', 'source', 'difficulty'],
};
const STUDY_PACK_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, subtitle: { type: 'string' }, overview: { type: 'string' }, originalText: { type: 'string' }, quickReview: { type: 'string' },
    pageCount: { type: 'integer', minimum: 1 },
    outline: { type: 'array', minItems: 1, maxItems: 80, items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, range: { type: 'string' } }, required: ['id', 'title', 'range'] } },
    notes: { type: 'array', minItems: 1, maxItems: 80, items: NOTE_SCHEMA }, detailedNotes: { type: 'array', minItems: 1, maxItems: 80, items: NOTE_SCHEMA },
    flashcards: { type: 'array', maxItems: 80, items: FLASHCARD_SCHEMA }, quiz: { type: 'array', maxItems: 80, items: QUIZ_SCHEMA },
  },
  required: ['title', 'subtitle', 'overview', 'originalText', 'quickReview', 'pageCount', 'outline', 'notes', 'detailedNotes', 'flashcards', 'quiz'],
};
