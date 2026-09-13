import type { CommunityClass, DiscoverSort, DiscoverStudySet } from '../models';
import { isAuthConfigured, supabase } from './auth';

export const isCommunityConfigured = isAuthConfigured && Boolean(supabase);

export interface CommunityResult<T> {
  data: T;
  hasMore?: boolean;
  error?: string;
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function discoverSet(row: Record<string, unknown>): DiscoverStudySet | null {
  const token = text(row.token);
  const title = text(row.title);
  if (!token || !title) return null;
  return {
    token,
    title,
    courseName: text(row.course_name, text(row.subject, 'General study')),
    subject: text(row.subject, 'General'),
    description: text(row.description),
    creatorDisplayName: text(row.creator_display_name, 'StudyBolt student'),
    itemCount: number(row.item_count),
    pageCount: number(row.page_count),
    saveCount: number(row.save_count),
    shareCount: number(row.share_count),
    updatedAt: text(row.updated_at, new Date(0).toISOString()),
    ...(text(row.class_id) ? { classId: text(row.class_id) } : {}),
    ...(text(row.class_label) ? { classLabel: text(row.class_label) } : {}),
  };
}

function communityClass(row: Record<string, unknown>): CommunityClass | null {
  const id = text(row.id);
  const courseCode = text(row.course_code);
  const courseName = text(row.course_name);
  if (!id || !courseCode || !courseName) return null;
  return {
    id,
    schoolName: text(row.school_name),
    courseCode,
    courseName,
    subject: text(row.subject),
    ...(text(row.instructor_name) ? { instructorName: text(row.instructor_name) } : {}),
    ...(text(row.term) ? { term: text(row.term) } : {}),
    memberCount: number(row.member_count),
    setCount: number(row.set_count),
    joined: row.joined === true,
  };
}

function unavailable<T>(data: T): CommunityResult<T> {
  return { data, error: 'Connect StudyBolt to Supabase to browse community study material.' };
}

export async function listPublicStudySets({
  search = '',
  subject = '',
  classId,
  sort = 'newest',
  limit = 12,
  offset = 0,
}: {
  search?: string;
  subject?: string;
  classId?: string;
  sort?: DiscoverSort;
  limit?: number;
  offset?: number;
} = {}): Promise<CommunityResult<DiscoverStudySet[]>> {
  if (!supabase) return unavailable([]);
  try {
    const { data, error } = await supabase.rpc('list_public_study_packs', {
      p_search: search.trim().slice(0, 120),
      p_subject: subject.trim().slice(0, 80),
      p_class_id: classId ?? null,
      p_sort: sort,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return { data: [], error: 'Study sets couldn’t be loaded right now.' };
    const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    return { data: rows.map(discoverSet).filter((item): item is DiscoverStudySet => Boolean(item)), hasMore: rows.length >= limit };
  } catch {
    return { data: [], error: 'Discover is unavailable offline. Your saved Study Packs still work.' };
  }
}

export async function listCommunityClasses({
  search = '',
  limit = 16,
  offset = 0,
}: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<CommunityResult<CommunityClass[]>> {
  if (!supabase) return unavailable([]);
  try {
    const { data, error } = await supabase.rpc('list_community_classes', {
      p_search: search.trim().slice(0, 120),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) return { data: [], error: 'Classes couldn’t be loaded right now.' };
    const rows = Array.isArray(data) ? data as Record<string, unknown>[] : [];
    return { data: rows.map(communityClass).filter((item): item is CommunityClass => Boolean(item)), hasMore: rows.length >= limit };
  } catch {
    return { data: [], error: 'Classes are unavailable offline.' };
  }
}

export async function getCommunityClass(classId: string): Promise<CommunityResult<CommunityClass | null>> {
  if (!supabase) return unavailable(null);
  try {
    const { data, error } = await supabase.rpc('get_community_class', { p_class_id: classId });
    if (error) return { data: null, error: 'That class couldn’t be loaded right now.' };
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row && typeof row === 'object' ? communityClass(row as Record<string, unknown>) : null };
  } catch {
    return { data: null, error: 'That class is unavailable offline.' };
  }
}

export async function joinCommunityClass(classId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Connect StudyBolt to Supabase to join a class.' };
  try {
    const { error } = await supabase.rpc('join_community_class', { p_class_id: classId });
    return error ? { error: 'That class couldn’t be joined right now.' } : {};
  } catch {
    return { error: 'That class couldn’t be joined while offline.' };
  }
}

export async function leaveCommunityClass(classId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Connect StudyBolt to Supabase to manage classes.' };
  try {
    const { error } = await supabase.rpc('leave_community_class', { p_class_id: classId });
    return error ? { error: 'That class couldn’t be left right now.' } : {};
  } catch {
    return { error: 'That class couldn’t be updated while offline.' };
  }
}

export async function incrementSharedPackSave(token: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('increment_shared_pack_save', { p_share_token: token });
  } catch {
    // Saving the local copy matters more than its non-essential aggregate count.
  }
}
