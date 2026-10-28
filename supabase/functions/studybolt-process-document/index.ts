import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { extractPptxLocally, type LocalVisualKnowledge, type PptxLocalExtraction } from './pptxVisuals.ts';
import { providerIdentity } from '../_shared/providerIdentity.ts';
import {
  authenticateDocumentRequest,
  estimateDocumentCost,
  reconcileDocumentUsage,
  releaseDocumentUsage,
  reserveDocumentUsage,
} from '../_shared/documentUsage.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = MAX_BYTES + 512 * 1024;
const MAX_GENERATION_BODY_BYTES = 512 * 1024;
const MAX_SINGLE_SOURCE_CHARS = 180_000;
const MAX_MULTI_SOURCE_CHARS = 360_000;
const MAX_COURSE_NAME = 120;
const TEXT_NOTE_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const POWERPOINT_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

type ImportDocumentType = 'pdf' | 'powerpoint' | 'notes';
type StudyPackMaterial = 'simpleNotes' | 'detailedNotes' | 'keyConcepts' | 'flashcards' | 'audio' | 'quiz';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await authenticateDocumentRequest(request);
  if ('response' in auth) return withCors(auth.response);
  const usageContext = auth.context;

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) return json({ error: 'Secure document processing is not configured yet.' }, 503);

  if (request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return handleMaterialGeneration(request, openAiKey, usageContext);
  }

  const boundedRequest = await boundedRequestBody(request, MAX_UPLOAD_BODY_BYTES, 'Choose a file smaller than 20 MB and try again.');
  if (boundedRequest instanceof Response) return boundedRequest;

  let form: FormData;
  try {
    form = await boundedRequest.formData();
  } catch {
    return json({ error: 'The upload could not be read. Please choose the file again.' }, 400);
  }

  const fileValue = form.get('file');
  if (!(fileValue instanceof File)) return json({ error: 'Choose a PDF, PowerPoint, or notes file.' }, 400);
  if (fileValue.size <= 0) return json({ error: 'That file is empty. Choose a different file.' }, 400);
  if (fileValue.size > MAX_BYTES) return json({ error: 'Choose a file smaller than 20 MB and try again.' }, 413);

  const fileName = safeFileName(fileValue.name || 'study-material');
  const documentType = getDocumentType(fileName);
  if (!documentType) return json({ error: 'Choose a PDF, PowerPoint, or notes file.' }, 415);
  const courseName = stringValue(form.get('courseName')).slice(0, MAX_COURSE_NAME) || 'My class';
  const extractionOnly = stringValue(form.get('action')) === 'extract';
  const extension = fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase();
  const mimeType = contentType(fileValue.type, documentType, extension);
  const documentId = crypto.randomUUID();
  let bytes: Uint8Array | null = null;
  if (documentType === 'powerpoint') {
    try {
      bytes = new Uint8Array(await fileValue.arrayBuffer());
    } catch {
      return json({ error: 'StudyBolt could not read this PowerPoint. Choose the file again and try again.' }, 400);
    }
  }
  let localPptx: PptxLocalExtraction | null = null;
  let uploadedFileId: string | null = null;
  let powerPointSourceHash: string | null = null;
  let powerPointImportPeriodStart: string | null = null;
  let limitedPowerPointImport = false;
  let response: Response;
  const extractionOutputEstimate = 28_000;
  // PDFs and office files can expand substantially when the provider reads
  // them. Reserve much more than the compressed upload size implies, up to the
  // hard 20 MB upload cap. Plain notes are truncated before they reach the API.
  const estimatedProviderBytes = TEXT_NOTE_EXTENSIONS.has(extension)
    ? Math.min(fileValue.size, 720_000)
    : fileValue.size;
  const extractionInputEstimate = Math.max(1_000, Math.ceil(estimatedProviderBytes / 8));

  if (documentType === 'powerpoint') {
    powerPointSourceHash = await sha256Hex(bytes ?? new Uint8Array(await fileValue.arrayBuffer()));
    const { data: claim, error: claimError } = await usageContext.admin.rpc('claim_studybolt_powerpoint_import', {
      p_user_id: usageContext.user.id,
      p_source_hash: powerPointSourceHash,
    });
    if (claimError || !isRecord(claim)) return json({ error: 'StudyBolt could not check your monthly PowerPoint import allowance. Please try again.' }, 503);
    if (claim.allowed !== true) return powerPointLimitResponse(claim);
    limitedPowerPointImport = claim.limited === true;
    if (limitedPowerPointImport) {
      powerPointImportPeriodStart = typeof claim.periodStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(claim.periodStart)
        ? claim.periodStart
        : null;
      if (!powerPointImportPeriodStart) return json({ error: 'StudyBolt could not reserve your monthly PowerPoint import. Please try again.' }, 503);
    }
  }

  const reservationResult = await reserveDocumentUsage(
    usageContext,
    estimateDocumentCost(usageContext, extractionInputEstimate, extractionOutputEstimate),
  );
  if ('response' in reservationResult) {
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return withCors(reservationResult.response);
  }
  const reservation = reservationResult.reservation;
  let modelRequestStarted = false;
  try {
    if (documentType === 'powerpoint') {
      try {
        localPptx = await extractPptxLocally(bytes ?? new Uint8Array());
      } catch (error) {
        console.error('studybolt-process-document: local PPTX extraction failed', error);
      }
    }
    const sourceParts = TEXT_NOTE_EXTENSIONS.has(extension)
      ? sourceContent(bytes ?? new Uint8Array(await fileValue.arrayBuffer()))
      : [{ type: 'input_file', file_id: await uploadProviderFile(fileValue, providerFileName(extension), mimeType) }];
    if (sourceParts[0]?.file_id) uploadedFileId = sourceParts[0].file_id;
    if (localPptx?.sourceText) sourceParts.unshift({ type: 'input_text', text: `LOCAL POWERPOINT EXTRACTION (no external visual AI was used):\n${localPptx.sourceText}` });
    const providerUserId = await providerIdentity(usageContext.user.id);
    modelRequestStarted = true;
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: usageContext.config.model,
        store: false,
        safety_identifier: providerUserId,
        reasoning: { effort: 'low' },
        instructions: extractionOnly ? extractionInstructions(documentType) : processorInstructions(documentType),
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: `Course name: ${courseName}\nSource type: ${documentType}` },
            ...sourceParts,
          ],
        }],
        text: {
          verbosity: 'low',
          format: { type: 'json_schema', name: extractionOnly ? 'studybolt_extracted_source' : 'studybolt_study_pack_content', strict: true, schema: extractionOnly ? EXTRACTED_SOURCE_SCHEMA : STUDY_PACK_SCHEMA },
        },
        max_output_tokens: 28_000,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    console.error('studybolt-process-document: provider request failed', error);
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    if (modelRequestStarted) {
      const reconciled = await reconcileDocumentUsage(usageContext, reservation, extractionOnly ? 'document_extract' : 'document_process', {}, {
        sourceType: documentType,
        sourceBytes: fileValue.size,
        providerRequestFailed: true,
      });
      if (!reconciled) {
        await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
        return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
      }
    } else {
      await releaseDocumentUsage(usageContext, reservation);
    }
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    if (error instanceof Error && error.message === 'The notes file is empty.') {
      return json({ error: 'That notes file is empty. Choose a different file.' }, 400);
    }
    return json({ error: 'StudyBolt could not reach the document processor. Check your connection and try again.' }, 502);
  }

  if (!response.ok) {
    const providerError = await responseError(response);
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    if (!(await reconcileDocumentUsage(usageContext, reservation, extractionOnly ? 'document_extract' : 'document_process', {}, {
      sourceType: documentType,
      sourceBytes: fileValue.size,
      providerStatus: response.status,
      providerRejected: true,
    }))) {
      await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
      return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    }
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return json({ error: providerError || 'The document processor could not read this file.' }, 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);
    const reconciled = await reconcileDocumentUsage(usageContext, reservation, extractionOnly ? 'document_extract' : 'document_process', {}, {
      sourceType: documentType,
      sourceBytes: fileValue.size,
      responseUnreadable: true,
    });
    if (!reconciled) {
      await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
      return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    }
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return json({ error: 'The document processor returned an unreadable response.' }, 502);
  }
  if (uploadedFileId) await deleteProviderFile(uploadedFileId, openAiKey);

  const payloadRecord = isRecord(payload) ? payload : {};
  if (!(await reconcileDocumentUsage(usageContext, reservation, extractionOnly ? 'document_extract' : 'document_process', payloadRecord, {
    sourceType: documentType,
    sourceBytes: fileValue.size,
  }))) {
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
  }
  if (!isRecord(payload)) {
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return json({ error: 'The document processor returned an unreadable response.' }, 502);
  }

  try {
    const content = JSON.parse(outputText(payload)) as Record<string, unknown>;
    const owner = { userId: usageContext.user.id, admin: usageContext.admin };
    if (owner && localPptx?.visuals.length) await persistVisualSession(owner, documentId, fileName, localPptx.visuals);
    const studyPack = extractionOnly
      ? buildExtractedStudyPack(content, { courseName, fileName, documentType }, localPptx, documentId)
      : buildStudyPack(content, { courseName, fileName, documentType }, localPptx, documentId);
    if (limitedPowerPointImport && powerPointSourceHash && powerPointImportPeriodStart) {
      const { data: completed, error: completionError } = await usageContext.admin.rpc('complete_studybolt_powerpoint_import', {
        p_user_id: usageContext.user.id,
        p_period_start: powerPointImportPeriodStart,
        p_source_hash: powerPointSourceHash,
      });
      if (completionError || completed !== true) {
        await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
        return json({ error: 'StudyBolt could not save your monthly import status. Please try processing the file again.' }, 503);
      }
    }
    return json(studyPack);
  } catch (error) {
    console.error('studybolt-process-document: invalid generated pack', error);
    await releasePowerPointImport(usageContext, limitedPowerPointImport, powerPointImportPeriodStart, powerPointSourceHash);
    return json({ error: 'The generated study pack was incomplete. Please try processing the file again.' }, 502);
  }
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function releasePowerPointImport(
  usageContext: { admin: SupabaseClient<any>; user: { id: string } },
  limited: boolean,
  periodStart: string | null,
  sourceHash: string | null,
): Promise<void> {
  if (!limited || !periodStart || !sourceHash) return;
  const { error } = await usageContext.admin.rpc('release_studybolt_powerpoint_import', {
    p_user_id: usageContext.user.id,
    p_period_start: periodStart,
    p_source_hash: sourceHash,
  });
  if (error) console.error('studybolt-process-document: could not release PowerPoint import claim', error);
}

function powerPointLimitResponse(claim: Record<string, unknown>): Response {
  const reason = claim.reason;
  if (reason === 'in_progress') {
    return json({ error: 'This PowerPoint is already being processed. Wait a moment, then try again.', code: 'powerpoint_import_in_progress' }, 409);
  }
  if (reason === 'already_imported') {
    return json({ error: 'This PowerPoint has already used your free import for this month. Your saved Study Packs remain available in your library.', code: 'powerpoint_already_imported' }, 409);
  }
  return json({
    error: 'You’ve used your one free PowerPoint import for this month. Your saved Study Packs are still available; subscribe to import more.',
    code: 'powerpoint_monthly_limit',
    periodStart: typeof claim.periodStart === 'string' ? claim.periodStart : undefined,
  }, 429);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function withCors(response: Response): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: { ...corsHeaders, ...Object.fromEntries(response.headers.entries()) },
  });
}

async function boundedRequestBody(request: Request, limit: number, tooLargeMessage: string): Promise<Request | Response> {
  const bytes = await readBoundedBody(request, limit, tooLargeMessage);
  if (bytes instanceof Response) return bytes;
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Request(request.url, { method: request.method, headers: request.headers, body });
}

async function readBoundedBody(request: Request, limit: number, tooLargeMessage: string): Promise<Uint8Array | Response> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) return json({ error: tooLargeMessage }, 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return json({ error: tooLargeMessage }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function handleMaterialGeneration(
  request: Request,
  openAiKey: string,
  usageContext: import('../_shared/documentUsage.ts').DocumentUsageContext,
): Promise<Response> {
  let input: Record<string, unknown>;
  try {
    const boundedBody = await readBoundedBody(request, MAX_GENERATION_BODY_BYTES, 'That study material is too large. Upload a smaller document and try again.');
    if (boundedBody instanceof Response) return boundedBody;
    const value = JSON.parse(new TextDecoder().decode(boundedBody));
    if (!isRecord(value)) throw new Error('Invalid body');
    input = value;
  } catch {
    return json({ error: 'The material request could not be read.' }, 400);
  }
  if (input.action !== 'generate' || !isStudyPackMaterial(input.material)) return json({ error: 'Choose a valid Study Pack material.' }, 400);
  const material = input.material;
  const sourceCount = Number(input.sourceCount ?? 1);
  if (!Number.isInteger(sourceCount) || sourceCount < 1 || sourceCount > 10) return json({ error: 'The study set has an invalid number of sources.' }, 400);
  const multipleSources = sourceCount > 1;
  const source = stringValue(input.source);
  const title = stringValue(input.title).slice(0, 180) || 'Study Pack';
  const outline = normalizedOutline(input.outline);
  const sourceLimit = multipleSources ? MAX_MULTI_SOURCE_CHARS : MAX_SINGLE_SOURCE_CHARS;
  if (!source || source.length > sourceLimit || !outline.length || outline.length > 250) {
    return json({ error: 'The processed document source is missing or too large. Upload a smaller document and try again.' }, 400);
  }

  const promptText = `Study Pack: ${title}\nOUTLINE:\n${JSON.stringify(outline)}\n\nNORMALIZED SOURCE (the only source of truth):\n${source}`;
  const maxOutputTokens = material === 'detailedNotes'
    ? (multipleSources ? Math.min(40_000, Math.max(24_000, outline.length * 220)) : 24_000)
    : material === 'simpleNotes'
      ? (multipleSources ? Math.min(40_000, Math.max(14_000, outline.length * 140)) : 14_000)
      : 10_000;
  const estimatedOutputTokens = maxOutputTokens;
  const estimatedInputTokens = Math.min(180_000, Math.max(1_000, Math.ceil(promptText.length / 2)));
  const reservationResult = await reserveDocumentUsage(
    usageContext,
    estimateDocumentCost(usageContext, estimatedInputTokens, estimatedOutputTokens),
  );
  if ('response' in reservationResult) return withCors(reservationResult.response);
  const reservation = reservationResult.reservation;

  let response: Response;
  let modelRequestStarted = false;
  try {
    const providerUserId = await providerIdentity(usageContext.user.id);
    modelRequestStarted = true;
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: usageContext.config.model,
        store: false,
        safety_identifier: providerUserId,
        reasoning: { effort: 'low' },
        instructions: materialInstructions(material, multipleSources),
        input: [{
          role: 'user',
          content: [{ type: 'input_text', text: promptText }],
        }],
        text: { verbosity: 'low', format: { type: 'json_schema', name: `studybolt_${material}`, strict: true, schema: MATERIAL_SCHEMAS[material] } },
        max_output_tokens: maxOutputTokens,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    console.error(`studybolt-process-document: ${material} request failed`, error);
    if (!(await reconcileDocumentUsage(usageContext, reservation, `document_${material}`, {}, {
      material,
      sourceCount,
      sourceChars: source.length,
      providerRequestFailed: modelRequestStarted,
    }))) return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    return json({ error: `${materialLabel(material)} could not reach the secure processor. Retry just this item.` }, 502);
  }
  if (!response.ok) {
    const providerError = await responseError(response);
    if (!(await reconcileDocumentUsage(usageContext, reservation, `document_${material}`, {}, {
      material,
      sourceCount,
      sourceChars: source.length,
      providerStatus: response.status,
      providerRejected: true,
    }))) return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    return json({ error: providerError || `${materialLabel(material)} could not be created. Retry just this item.` }, 502);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (!(await reconcileDocumentUsage(usageContext, reservation, `document_${material}`, {}, {
      material,
      sourceCount,
      sourceChars: source.length,
      responseUnreadable: true,
    }))) {
      return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    }
    return json({ error: `${materialLabel(material)} returned an unreadable response. Retry just this item.` }, 502);
  }
  try {
    const payloadRecord = isRecord(payload) ? payload : {};
    if (!(await reconcileDocumentUsage(usageContext, reservation, `document_${material}`, payloadRecord, {
      material,
      sourceCount,
      sourceChars: source.length,
    }))) {
      return json({ error: 'StudyBolt could not record AI usage. Please try again later.' }, 503);
    }
    if (!isRecord(payload)) throw new Error('Provider returned invalid JSON content');
    const content = JSON.parse(outputText(payload)) as Record<string, unknown>;
    return json(normalizeMaterial(content, material, outline));
  } catch (error) {
    console.error(`studybolt-process-document: invalid ${material} output`, error);
    return json({ error: `${materialLabel(material)} was incomplete. Retry just this item.` }, 502);
  }
}

function isStudyPackMaterial(value: unknown): value is StudyPackMaterial {
  return value === 'simpleNotes' || value === 'detailedNotes' || value === 'keyConcepts' || value === 'flashcards' || value === 'audio' || value === 'quiz';
}

function materialLabel(material: StudyPackMaterial): string {
  return material === 'simpleNotes' ? 'Simplified Notes'
    : material === 'detailedNotes' ? 'Detailed Notes'
      : material === 'keyConcepts' ? 'Key Concepts'
        : material === 'flashcards' ? 'Flashcards'
          : material === 'audio' ? 'Audio Summary' : 'Practice Quiz';
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

function sourceContent(bytes: Uint8Array): Array<Record<string, string>> {
  const text = new TextDecoder().decode(bytes).replace(/\u0000/g, '').trim();
  if (!text) throw new Error('The notes file is empty.');
  return [{ type: 'input_text', text: `VERBATIM STUDY NOTES\n${text.slice(0, 180_000)}` }];
}

function providerFileName(extension: string): string {
  return `study-material.${extension}`;
}

async function uploadProviderFile(source: Blob, fileName: string, mimeType: string): Promise<string> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) throw new Error('Missing OpenAI key');
  const form = new FormData();
  form.append('purpose', 'user_data');
  // Files API uploads otherwise persist until manually deleted. Keep a
  // one-hour provider-side expiry as a fallback if this function is stopped
  // before the immediate cleanup below can complete.
  form.append('expires_after[anchor]', 'created_at');
  form.append('expires_after[seconds]', '3600');
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
  const url = `https://api.openai.com/v1/files/${encodeURIComponent(fileId)}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${openAiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok || response.status === 404) return;
      if (response.status < 500 && response.status !== 429) {
        console.error('studybolt-process-document: provider file cleanup rejected', response.status);
        return;
      }
    } catch {
      // Retry transient network failures; the provider expiry remains the
      // fallback if all immediate cleanup attempts fail.
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  console.error('studybolt-process-document: provider file cleanup retries exhausted; one-hour expiry remains active');
}

function processorInstructions(documentType: ImportDocumentType): string {
  const sourceLabel = documentType === 'powerpoint' ? 'PowerPoint presentation' : documentType === 'pdf' ? 'PDF' : 'student notes';
  return [
    'You are StudyBolt document processor.',
    `Read the attached ${sourceLabel} as the only source of truth.`,
    'Extract the source in its original order before writing the study pack. Do not invent facts, fill gaps with general knowledge, or silently omit meaningful claims.',
    'Return the requested structured content only. Use section-1, section-2, and so on for outline IDs, and make exactly one simplified note and one detailed note for every outline section in the same order.',
    'The simplified layer should be concise: one summary, a short list of core ideas, one key idea, and retrieval prompts. The detailed layer should retain the meaningful source claims in hierarchical subsections, connections, grounded examples when present, and retrieval prompts. The two layers must not be duplicate copies.',
    'Every flashcard and quiz question must be answerable from the source and must include the matching source section ID. Use a mix of the source’s most important concepts, not filler.',
    'Before returning, re-scan the source for missing sections, claims, and source links. If the source is sparse, produce fewer grounded cards rather than inventing content.',
  ].join(' ');
}

function extractionInstructions(documentType: ImportDocumentType): string {
  const sourceLabel = documentType === 'powerpoint' ? 'PowerPoint presentation' : documentType === 'pdf' ? 'PDF' : 'student notes';
  return [
    'You are the secure StudyBolt source extractor.',
    `Read the attached ${sourceLabel} once and normalize it for reuse by independent study-material jobs.`,
    'Preserve all meaningful claims, definitions, examples, labels, and source order. Do not summarize away important content, invent facts, or use outside knowledge.',
    'Return a clear title, subtitle, page or slide count, a source-order outline, and normalized originalText. Use section-1, section-2, and so on for outline IDs.',
    'In originalText, keep section headings and source-location labels so later jobs can ground every item without receiving the original file again.',
  ].join(' ');
}

function materialInstructions(material: StudyPackMaterial, multipleSources = false): string {
  const common = 'Use only the supplied normalized source. Do not invent facts or fill gaps with general knowledge. Preserve the supplied section IDs in every source reference.';
  const crossPresentationGuidance = multipleSources
    ? ' The material contains several named presentations. Keep every item tied to its own presentation and section, spread review across all presentations, and connect or compare ideas only when the source supports the relationship.'
    : '';
  if (material === 'simpleNotes') return `${common} Create exactly one concise simplified note for every outline section in source order: one organizing summary, a short set of core ideas, one key idea, and retrieval prompts. These are the fast first-pass notes.${crossPresentationGuidance}`;
  if (material === 'detailedNotes') return `${common} Create exactly one detailed note for every outline section in source order. Preserve the meaningful source claims and wording in hierarchical subsections, connect related ideas, include examples only when grounded in the source, and add retrieval prompts. Do not merely repeat a short summary.${crossPresentationGuidance}`;
  if (material === 'keyConcepts') return `${common} Create a source-grounded lecture overview and a concise quickReview containing the most important concepts in source order. Aim for a useful spoken/read review, not a list of unsupported claims.${multipleSources ? ' Synthesize recurring themes across presentations while keeping distinct claims and vocabulary attributed to their own source.' : ''}`;
  if (material === 'flashcards') return `${common} Create active-recall flashcards from the most important source concepts. Every card must be answerable from the source and link to the matching outline section. Prefer fewer grounded cards over filler.${multipleSources ? ' Interleave cards from the different presentations instead of grouping the full deck by presentation.' : ''}`;
  if (material === 'quiz') return `${common} Create a basic multiple-choice practice quiz across the important source concepts. Every question and explanation must be answerable from the source and link to the matching outline section.${multipleSources ? ' Mix questions across the presentations; use comparison questions only when both sources explicitly support the comparison.' : ''}`;
  return `${common} Write a concise audio summary script in natural spoken language, ordered by the source. This text will be read with device text-to-speech; do not add stage directions, music, or SSML.${crossPresentationGuidance}`;
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

function normalizedOutline(value: unknown): Array<{ id: string; title: string; range: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 160).flatMap((item, index) => {
    if (!isRecord(item)) return [];
    return [{
      id: stringValue(item.id) || `section-${index + 1}`,
      title: text(item.title, `Section ${index + 1}`),
      range: text(item.range, `Section ${index + 1}`),
    }];
  });
}

function buildExtractedStudyPack(content: Record<string, unknown>, meta: { courseName: string; fileName: string; documentType: ImportDocumentType }, localPptx?: PptxLocalExtraction | null, documentId?: string) {
  const rawSections = rawOutline(content.outline);
  const outline = rawSections.map((section, index) => ({ id: `section-${index + 1}`, title: section.title, range: section.range }));
  const originalText = text(content.originalText, localPptx?.sourceText || '');
  if (!originalText) throw new Error('Missing normalized source');
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
    overview: '',
    originalText,
    processedSource: originalText,
    quickReview: '',
    notes: [],
    detailedNotes: [],
    flashcards: [],
    quiz: [],
    quizAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
    ...(visuals.length ? { visuals } : {}),
    ...(localPptx?.summary ? { visualSummary: localPptx.summary } : {}),
  };
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

function normalizeMaterial(content: Record<string, unknown>, material: StudyPackMaterial, outline: Array<{ id: string; title: string; range: string }>) {
  if (material === 'simpleNotes') return { notes: normalizeNotes(content.notes, false, outline) };
  if (material === 'detailedNotes') return { detailedNotes: normalizeNotes(content.detailedNotes, true, outline) };
  if (material === 'keyConcepts') return {
    overview: text(content.overview, ''),
    quickReview: text(content.quickReview, ''),
  };
  if (material === 'flashcards') return { flashcards: normalizeFlashcards(content.flashcards, outline) };
  if (material === 'quiz') return { quiz: normalizeQuiz(content.quiz, outline) };
  const audioSummary = text(content.audioSummary, '');
  if (!audioSummary) throw new Error('Missing audio summary');
  return { audioSummary };
}

async function persistVisualSession(owner: { userId: string; admin: SupabaseClient<any> }, documentId: string, fileName: string, visuals: LocalVisualKnowledge[]): Promise<void> {
  try {
    const { error: documentError } = await owner.admin.from('studybolt_visual_documents').insert({
      document_id: documentId,
      owner_user_id: owner.userId,
      source_file_name: fileName,
    });
    if (documentError) throw documentError;
    for (const visual of visuals) {
      if (!visual.imageDataUrl || !isUsefulVisual(visual)) continue;
      const decoded = decodeVisualDataUrl(visual.imageDataUrl);
      if (!decoded) continue;
      const imagePath = `${owner.userId}/${documentId}/${visual.id}-${visual.imageHash.slice(0, 12)}.${decoded.extension}`;
      try {
        const { error: uploadError } = await owner.admin.storage.from('studybolt-visuals').upload(imagePath, decoded.bytes, {
          contentType: decoded.contentType,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: signed } = await owner.admin.storage.from('studybolt-visuals').createSignedUrl(imagePath, 60 * 60);
        visual.imagePath = imagePath;
        if (signed?.signedUrl) visual.imageUrl = signed.signedUrl;
        // Signed-in users can refresh the private URL from imagePath. Keeping
        // base64 copies in app storage would quickly exhaust mobile storage.
        visual.imageDataUrl = undefined;
      } catch (error) {
        // The inline fallback remains available and one failed asset never
        // blocks the document or its other generated study materials.
        console.error('studybolt-process-document: visual asset upload failed', visual.id, error);
      }
    }
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
      image_path: visual.imagePath ?? null,
    }));
    if (rows.length) {
      const { error } = await owner.admin.from('studybolt_visuals').insert(rows);
      if (error) throw error;
    }
  } catch (error) {
    console.error('studybolt-process-document: visual session persistence failed', error);
  }
}

function isUsefulVisual(visual: LocalVisualKnowledge): boolean {
  return visual.educationalImportance >= 0.35
    && visual.visualType !== 'decorative'
    && visual.visualType !== 'logo'
    && visual.visualType !== 'background'
    && visual.visualType !== 'icon';
}

function decodeVisualDataUrl(value: string): { bytes: Uint8Array; extension: string; contentType: string } | null {
  const match = value.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  try {
    const subtype = match[1]!.toLowerCase();
    const contentType = subtype === 'jpg' ? 'image/jpeg' : `image/${subtype}`;
    const extension = subtype === 'jpeg' ? 'jpg' : subtype;
    const binary = atob(match[2]!);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { bytes, extension, contentType };
  } catch {
    return null;
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
const EXTRACTED_SOURCE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    title: { type: 'string' }, subtitle: { type: 'string' }, originalText: { type: 'string' }, pageCount: { type: 'integer', minimum: 1 },
    outline: { type: 'array', minItems: 1, maxItems: 80, items: { type: 'object', additionalProperties: false, properties: { id: { type: 'string' }, title: { type: 'string' }, range: { type: 'string' } }, required: ['id', 'title', 'range'] } },
  },
  required: ['title', 'subtitle', 'originalText', 'pageCount', 'outline'],
};
const MATERIAL_SCHEMAS: Record<StudyPackMaterial, Record<string, unknown>> = {
  simpleNotes: {
    type: 'object', additionalProperties: false,
    properties: { notes: { type: 'array', minItems: 1, maxItems: 160, items: NOTE_SCHEMA } },
    required: ['notes'],
  },
  detailedNotes: {
    type: 'object', additionalProperties: false,
    properties: { detailedNotes: { type: 'array', minItems: 1, maxItems: 160, items: NOTE_SCHEMA } },
    required: ['detailedNotes'],
  },
  keyConcepts: {
    type: 'object', additionalProperties: false,
    properties: { overview: { type: 'string' }, quickReview: { type: 'string' } },
    required: ['overview', 'quickReview'],
  },
  flashcards: {
    type: 'object', additionalProperties: false,
    properties: { flashcards: { type: 'array', minItems: 1, maxItems: 80, items: FLASHCARD_SCHEMA } },
    required: ['flashcards'],
  },
  audio: {
    type: 'object', additionalProperties: false,
    properties: { audioSummary: { type: 'string' } },
    required: ['audioSummary'],
  },
  quiz: {
    type: 'object', additionalProperties: false,
    properties: { quiz: { type: 'array', minItems: 1, maxItems: 80, items: QUIZ_SCHEMA } },
    required: ['quiz'],
  },
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
