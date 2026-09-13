import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type {
  DeckOutlineItem,
  Flashcard,
  NoteBlock,
  QuizQuestion,
  SharedStudyPackContent,
  SharedStudyPackLink,
  SharedStudyPackMetadata,
  SharedStudyPackPreview,
  StudyPack,
  SharedStudyPackVisibility,
} from '../models';
import { ensureDistinctNoteLayers } from './noteLayers';

const LOCAL_LINKS_KEY = '@studybolt/shared-links/v1';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const configuredShareBase = process.env.EXPO_PUBLIC_STUDYBOLT_SHARE_BASE_URL?.replace(/\/$/, '') ?? '';

const hasPlaceholderAnonKey = supabaseAnonKey === 'PASTE_ANON_KEY_HERE';
export const isSharingBackendConfigured = Boolean(supabaseUrl && supabaseAnonKey && !hasPlaceholderAnonKey);

export function shareUrlForToken(token: string): string {
  if (configuredShareBase) return `${configuredShareBase}/${encodeURIComponent(token)}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/share/${encodeURIComponent(token)}`;
  return `studybolt://share/${encodeURIComponent(token)}`;
}

export function parseShareToken(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/share/';
  const markerIndex = url.toLowerCase().indexOf(marker);
  if (markerIndex < 0) return null;
  const token = url.slice(markerIndex + marker.length).split(/[?#]/)[0];
  if (!token) return null;
  try {
    return decodeURIComponent(token);
  } catch {
    return null;
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  const cryptoLike = (globalThis as typeof globalThis & {
    crypto?: { getRandomValues?: (target: Uint8Array) => Uint8Array };
  }).crypto;
  if (cryptoLike?.getRandomValues) {
    cryptoLike.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('')}`;
}

function safeSource(source: { sectionId: string; label: string }) {
  return { sectionId: source.sectionId, label: source.label };
}

function shareableNote(note: NoteBlock): NoteBlock {
  return {
    id: note.id,
    title: note.title,
    ...(note.summary ? { summary: note.summary } : {}),
    bullets: [...note.bullets],
    ...(note.sections ? { sections: note.sections.map((section) => ({ heading: section.heading, points: [...section.points] })) } : {}),
    ...(note.connections ? { connections: [...note.connections] } : {}),
    ...(note.examples ? { examples: [...note.examples] } : {}),
    ...(note.recallPrompts ? { recallPrompts: [...note.recallPrompts] } : {}),
    ...(note.keyIdea ? { keyIdea: note.keyIdea } : {}),
    source: safeSource(note.source),
  };
}

export function createShareableContent(deck: StudyPack): SharedStudyPackContent {
  const detailedNotes = ensureDistinctNoteLayers(deck.notes, deck.detailedNotes, deck.originalText, deck.outline);
  return {
    courseId: deck.courseId,
    courseName: deck.courseName,
    title: deck.title,
    subtitle: deck.subtitle,
    fileType: deck.fileType,
    pageCount: deck.pageCount,
    color: deck.color,
    emoji: deck.emoji,
    outline: deck.outline.map((item) => ({ id: item.id, title: item.title, range: item.range })),
    overview: deck.overview,
    // The original extracted source text and uploaded file are intentionally not shared.
    quickReview: deck.quickReview,
    notes: deck.notes.map(shareableNote),
    detailedNotes: detailedNotes.map(shareableNote),
    flashcards: deck.flashcards.map((card) => {
      const { confidence: _privateProgress, ...studyCard } = card;
      return { ...studyCard, source: safeSource(card.source) };
    }),
    quiz: deck.quiz.map((question) => ({
      ...question,
      options: [...question.options],
      source: safeSource(question.source),
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function sourceValue(value: unknown): { sectionId: string; label: string } {
  const source = isRecord(value) ? value : {};
  return { sectionId: stringValue(source.sectionId, 'shared-section'), label: stringValue(source.label, 'Study Pack') };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseNote(value: Record<string, unknown>, index: number): NoteBlock {
  const sections = Array.isArray(value.sections)
    ? value.sections.filter(isRecord).map((section) => ({
      heading: stringValue(section.heading),
      points: stringArray(section.points),
    })).filter((section) => section.heading && section.points.length)
    : [];
  return {
    id: stringValue(value.id, `shared-note-${index}`),
    title: stringValue(value.title, `Note ${index + 1}`),
    ...(typeof value.summary === 'string' ? { summary: value.summary } : {}),
    bullets: stringArray(value.bullets),
    ...(sections.length ? { sections } : {}),
    ...(Array.isArray(value.connections) ? { connections: stringArray(value.connections) } : {}),
    ...(Array.isArray(value.examples) ? { examples: stringArray(value.examples) } : {}),
    ...(Array.isArray(value.recallPrompts) ? { recallPrompts: stringArray(value.recallPrompts) } : {}),
    ...(typeof value.keyIdea === 'string' ? { keyIdea: value.keyIdea } : {}),
    source: sourceValue(value.source),
  };
}

function parseContent(value: unknown): SharedStudyPackContent | null {
  if (!isRecord(value)) return null;
  const title = stringValue(value.title).trim();
  const courseName = stringValue(value.courseName).trim();
  if (!title || !courseName) return null;

  const outline = Array.isArray(value.outline)
    ? value.outline.filter(isRecord).map((item, index): DeckOutlineItem => ({
      id: stringValue(item.id, `shared-outline-${index}`),
      title: stringValue(item.title, `Section ${index + 1}`),
      range: stringValue(item.range),
    }))
    : [];
  const notes = Array.isArray(value.notes)
    ? value.notes.filter(isRecord).map(parseNote)
    : [];
  const parsedDetailedNotes = Array.isArray(value.detailedNotes)
    ? value.detailedNotes.filter(isRecord).map(parseNote)
    : notes;
  const detailedNotes = ensureDistinctNoteLayers(notes, parsedDetailedNotes, stringValue(value.quickReview), outline);
  const flashcards = Array.isArray(value.flashcards)
    ? value.flashcards.filter(isRecord).map((card, index): Omit<Flashcard, 'confidence'> => ({
      id: stringValue(card.id, `shared-card-${index}`),
      front: stringValue(card.front),
      back: stringValue(card.back),
      ...(typeof card.explanation === 'string' ? { explanation: card.explanation } : {}),
      source: sourceValue(card.source),
    }))
    : [];
  const quiz = Array.isArray(value.quiz)
    ? value.quiz.filter(isRecord).map((question, index): QuizQuestion => ({
      id: stringValue(question.id, `shared-question-${index}`),
      type: question.type === 'true-false' ? 'true-false' : 'multiple-choice',
      prompt: stringValue(question.prompt),
      options: Array.isArray(question.options) ? question.options.filter((item): item is string => typeof item === 'string') : [],
      correctIndex: typeof question.correctIndex === 'number' ? question.correctIndex : 0,
      explanation: stringValue(question.explanation),
      source: sourceValue(question.source),
      ...(question.difficulty === 'easy' || question.difficulty === 'medium' || question.difficulty === 'hard' ? { difficulty: question.difficulty } : {}),
    }))
    : [];

  return {
    courseId: stringValue(value.courseId, `shared-course-${randomToken().slice(0, 8)}`),
    courseName,
    title,
    subtitle: stringValue(value.subtitle, 'Shared Study Pack'),
    fileType: value.fileType === 'pdf' || value.fileType === 'pptx' ? value.fileType : 'demo',
    pageCount: typeof value.pageCount === 'number' ? Math.max(0, value.pageCount) : 0,
    color: stringValue(value.color, '#1678FF'),
    emoji: stringValue(value.emoji, '📚'),
    outline,
    overview: stringValue(value.overview),
    quickReview: stringValue(value.quickReview),
    notes,
    detailedNotes,
    flashcards,
    quiz,
  };
}

export function sharedContentToStudyPack(content: SharedStudyPackContent, token: string): StudyPack {
  return {
    id: `shared-${token}`,
    courseId: content.courseId,
    courseName: content.courseName,
    title: content.title,
    subtitle: content.subtitle,
    fileName: `${content.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'study-pack'}.studybolt`,
    fileType: content.fileType,
    pageCount: content.pageCount,
    createdAt: new Date().toISOString(),
    order: 0,
    color: content.color,
    emoji: content.emoji,
    outline: content.outline,
    overview: content.overview,
    // Shared packs only carry generated quick-review audio, never the original source text.
    originalText: content.quickReview,
    quickReview: content.quickReview,
    notes: content.notes,
    detailedNotes: ensureDistinctNoteLayers(content.notes, content.detailedNotes, content.quickReview, content.outline),
    flashcards: content.flashcards.map((card) => ({ ...card, confidence: 'new' as const })),
    quiz: content.quiz,
    quizAttempts: [],
    testAttempts: [],
    reviewedNoteIds: [],
    audioPosition: 0,
    studyMinutes: 0,
    sharedFromToken: token,
  };
}

export function cloneSharedStudyPack(content: SharedStudyPackContent, token: string, metadata?: SharedStudyPackMetadata): StudyPack {
  return {
    ...sharedContentToStudyPack(content, token),
    id: `shared-copy-${Date.now()}-${randomToken().slice(0, 8)}`,
    ...(metadata?.originalSetId ? { originalSetId: metadata.originalSetId } : {}),
    ...(metadata?.classId ? { communityClassId: metadata.classId } : {}),
  };
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { message?: string; error?: string; hint?: string };
    return payload.message ?? payload.error ?? payload.hint ?? '';
  } catch {
    return '';
  }
}

async function supabaseRequest(path: string, init: RequestInit, accessToken?: string): Promise<Response> {
  return fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken ?? supabaseAnonKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

function backendError(status: number, detail: string): string {
  if (status === 404 || status === 406) return 'That Study Pack link is no longer available.';
  if (status === 401 || status === 403) return 'You need to sign in to manage Study Pack links.';
  return detail || 'Something went wrong. Please try again.';
}

export async function createSharedStudyPack(
  deck: StudyPack,
  accessToken: string,
  visibility: SharedStudyPackVisibility,
  options: { creatorDisplayName?: string; classId?: string } = {},
): Promise<{ link?: SharedStudyPackLink; error?: string }> {
  if (!isSharingBackendConfigured) return { error: 'Link sharing is not connected yet. Add the StudyBolt backend to create a share link.' };
  try {
    const response = await supabaseRequest('/rest/v1/rpc/upsert_shared_study_pack', {
      method: 'POST',
      body: JSON.stringify({
        p_study_pack_id: deck.id,
        p_visibility: visibility,
        p_shared_content: createShareableContent(deck),
        p_creator_display_name: options.creatorDisplayName?.trim() || 'StudyBolt student',
        p_description: deck.subtitle,
        p_subject: deck.courseName,
        p_class_id: visibility === 'public' ? options.classId ?? null : null,
        p_original_set_id: deck.originalSetId ?? deck.id,
      }),
    }, accessToken);
    if (!response.ok) return { error: backendError(response.status, await readError(response)) };
    const payload = await response.json() as Array<{ share_token?: string; visibility?: SharedStudyPackVisibility; created_at?: string; class_id?: string | null }> | { share_token?: string; visibility?: SharedStudyPackVisibility; created_at?: string; class_id?: string | null };
    const row = Array.isArray(payload) ? payload[0] : payload;
    if (!row?.share_token) return { error: 'StudyBolt could not finish creating that link. Please try again.' };
    return {
      link: {
        deckId: deck.id,
        token: row.share_token,
        url: shareUrlForToken(row.share_token),
        visibility: row.visibility === 'public' ? 'public' : row.visibility === 'private' ? 'private' : 'link',
        createdAt: row.created_at ?? new Date().toISOString(),
        ...(row.class_id ? { classId: row.class_id } : {}),
      },
    };
  } catch {
    return { error: 'Could not create a share link. Check your connection and try again.' };
  }
}

function parseMetadata(value: unknown, token: string): SharedStudyPackMetadata {
  const metadata = isRecord(value) ? value : {};
  return {
    token: stringValue(metadata.token, token),
    creatorDisplayName: stringValue(metadata.creatorDisplayName, 'StudyBolt student'),
    description: stringValue(metadata.description),
    itemCount: typeof metadata.itemCount === 'number' ? Math.max(0, metadata.itemCount) : 0,
    saveCount: typeof metadata.saveCount === 'number' ? Math.max(0, metadata.saveCount) : 0,
    shareCount: typeof metadata.shareCount === 'number' ? Math.max(0, metadata.shareCount) : 0,
    visibility: metadata.visibility === 'public' ? 'public' : 'link',
    ...(typeof metadata.classId === 'string' ? { classId: metadata.classId } : {}),
    ...(typeof metadata.originalSetId === 'string' ? { originalSetId: metadata.originalSetId } : {}),
  };
}

export async function fetchSharedStudyPack(token: string): Promise<{ preview?: SharedStudyPackPreview; content?: SharedStudyPackContent; error?: string }> {
  if (!isSharingBackendConfigured) return { error: 'This share link is not connected to a StudyBolt backend yet.' };
  try {
    const response = await supabaseRequest('/rest/v1/rpc/get_shared_study_pack', {
      method: 'POST',
      body: JSON.stringify({ p_share_token: token }),
    });
    if (!response.ok) return { error: backendError(response.status, await readError(response)) };
    const payload = await response.json() as { content?: unknown } | Array<{ content?: unknown }>;
    const result = Array.isArray(payload) ? payload[0] : payload;
    if (!result?.content) return { error: 'This Study Pack link is no longer available. It may be expired or disabled.' };
    const content = parseContent(result?.content);
    if (!content) return { error: 'This share link does not contain a readable Study Pack.' };
    const metadata = parseMetadata((result as { metadata?: unknown }).metadata, token);
    return { content, preview: { content, metadata } };
  } catch {
    return { error: 'Could not open this Study Pack. Check your connection and try again.' };
  }
}

export async function revokeSharedStudyPack(token: string, accessToken: string): Promise<{ error?: string }> {
  if (!isSharingBackendConfigured) return { error: 'Link sharing is not connected yet.' };
  try {
    const response = await supabaseRequest('/rest/v1/rpc/revoke_shared_study_pack', {
      method: 'POST',
      body: JSON.stringify({ p_share_token: token }),
    }, accessToken);
    if (!response.ok) return { error: backendError(response.status, await readError(response)) };
    return {};
  } catch {
    return { error: 'Could not stop sharing. Check your connection and try again.' };
  }
}

export async function loadStoredShareLink(deckId: string): Promise<SharedStudyPackLink | null> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_LINKS_KEY);
    if (!raw) return null;
    const links = JSON.parse(raw) as SharedStudyPackLink[];
    const link = links.find((item) => item.deckId === deckId && !item.revokedAt);
    return link ?? null;
  } catch {
    return null;
  }
}

export async function storeShareLink(link: SharedStudyPackLink): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_LINKS_KEY);
    const links = raw ? JSON.parse(raw) as SharedStudyPackLink[] : [];
    await AsyncStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify([link, ...links.filter((item) => item.deckId !== link.deckId)]));
  } catch {
    // The server link remains valid even if local status storage is unavailable.
  }
}

export async function markShareLinkRevoked(link: SharedStudyPackLink): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_LINKS_KEY);
    const links = raw ? JSON.parse(raw) as SharedStudyPackLink[] : [];
    await AsyncStorage.setItem(LOCAL_LINKS_KEY, JSON.stringify(links.map((item) => item.token === link.token ? { ...item, revokedAt: new Date().toISOString() } : item)));
  } catch {
    // The server remains the source of truth.
  }
}

export function shareMessageFor(deck: StudyPack, url: string): string {
  return `Study this with me on StudyBolt: ${deck.courseName} — ${deck.title}\n${url}`;
}
