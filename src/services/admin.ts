import { supabase } from './auth';

export type AdminRange = 'today' | '7d' | '30d' | 'all';
export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'normal' | 'high' | 'critical';
export type AdminUserAction = 'reset_ai_quota' | 'grant_complimentary' | 'revoke_complimentary';

export interface AdminOverview {
  generatedAt: string;
  capabilities: { cloudUsage: boolean; community: boolean; quotaControls: boolean };
  metrics: {
    totalUsers: number; newUsers: number; activeUsers: number; premiumUsers: number;
    packsCreated: number; quizAttempts: number; cardReviews: number; quizAccuracy: number | null;
    learningSeconds: number; cloudRequests: number; cloudCostUsd: number; inputTokens: number; outputTokens: number;
    publicPacks: number; classes: number; classMembers: number; openFeedback: number;
  };
  topLearners: Array<{ id: string; name: string; email: string; packs: number; quizzes: number; reviews: number; actions: number }>;
  screenTime: Array<{ screen: string; seconds: number; segments: number }>;
  topPacks: Array<{ id: string; title: string; subject: string; saves: number; shares: number }>;
  cloudActions: Array<{ action: string; requests: number; cost: number }>;
  recentActions: Array<{ id: string; action: string; outcome: string; email: string | null; created_at: string }>;
}

export interface AdminUser {
  id: string; email: string | null; name: string; created_at: string; last_sign_in_at: string | null;
  is_admin: boolean; subscription_tier: string; complimentary_until: string | null;
  packs: number; quizzes: number; reviews: number; ai_used: number | null;
}

export interface FeedbackReport {
  id: string; user_id: string; category: 'bug' | 'idea' | 'question'; subject: string; message: string;
  status: FeedbackStatus; priority: FeedbackPriority; admin_reply: string | null; created_at: string; updated_at: string;
  userName?: string; userEmail?: string;
}

export interface AdminDirectory { users: AdminUser[]; page: number; total: number; totalPages: number; }
export interface AdminFeedback { reports: FeedbackReport[]; page: number; totalPages: number; unresolvedCount: number; }

export class AdminAccessError extends Error {}

export async function getAdminAccess(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.rpc('studybolt_is_admin');
    return !error && data === true;
  } catch { return false; }
}

async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Connect StudyBolt to Supabase to use the Admin Center.');
  const { data, error } = await supabase.functions.invoke('studybolt-admin', { body });
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    const payload = response ? await response.json().catch(() => null) as { error?: string } | null : null;
    if (response?.status === 401 || response?.status === 403) {
      throw new AdminAccessError(payload?.error ?? 'Please sign in with an authorized admin account.');
    }
    throw new Error(payload?.error ?? 'The Admin Center is unavailable. Check your connection and try again.');
  }
  return data as T;
}

export const fetchAdminOverview = (range: AdminRange) => invokeAdmin<AdminOverview>({ operation: 'overview', range });
export const fetchAdminUsers = (page: number, search: string) => invokeAdmin<AdminDirectory>({ operation: 'users', page, search });
export const fetchAdminFeedback = (page: number, status: FeedbackStatus | 'all') => invokeAdmin<AdminFeedback>({ operation: 'feedback', page, status });
export const performAdminUserAction = (userId: string, action: AdminUserAction) => invokeAdmin({ operation: 'user-action', userId, action });
export const updateAdminFeedback = (reportId: string, status: FeedbackStatus, priority: FeedbackPriority, reply: string) => invokeAdmin({ operation: 'update-feedback', reportId, status, priority, reply });

export async function fetchMyFeedback(): Promise<FeedbackReport[]> {
  if (!supabase) throw new Error('Sign in to see your support requests.');
  const { data, error } = await supabase.from('studybolt_feedback').select('*').order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error('Support requests are unavailable. Please try again later.');
  return data as FeedbackReport[];
}

export async function submitFeedback(category: FeedbackReport['category'], subject: string, message: string): Promise<void> {
  if (!supabase) throw new Error('Sign in to contact StudyBolt support.');
  const { error } = await supabase.rpc('submit_studybolt_feedback', { p_category: category, p_subject: subject.trim(), p_message: message.trim() });
  if (error) throw new Error(error.code === 'P0001' ? error.message : 'Your request could not be sent. Please try again.');
}
