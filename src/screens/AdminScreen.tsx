import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../AuthContext';
import { Card, Header, Icon, Pill, PrimaryButton, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { AdminAccessError, fetchAdminFeedback, fetchAdminOverview, fetchAdminUsers, performAdminUserAction, updateAdminFeedback } from '../services/admin';
import type { AdminDirectory, AdminFeedback, AdminOverview, AdminRange, AdminUser, AdminUserAction, FeedbackPriority, FeedbackReport, FeedbackStatus } from '../services/admin';

const RANGES: Array<{ id: AdminRange; label: string }> = [{ id: 'today', label: 'Today' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'all', label: 'All time' }];
const STATUSES: FeedbackStatus[] = ['new', 'reviewing', 'resolved', 'closed'];
const PRIORITIES: FeedbackPriority[] = ['low', 'normal', 'high', 'critical'];
const ACTION_LABELS: Record<AdminUserAction, string> = { reset_ai_quota: 'Reset monthly AI quota', grant_complimentary: 'Give 30 days of cloud AI', revoke_complimentary: 'End complimentary AI access' };
const ACTION_DETAILS: Record<AdminUserAction, string> = {
  reset_ai_quota: 'Reset this learner’s monthly interaction and cost allowance. In-flight requests, daily rate limits, and historical usage reports are preserved.',
  grant_complimentary: 'Give this learner premium cloud AI limits for 30 days. An existing complimentary period is extended by 30 days. Paid subscription access is preserved.',
  revoke_complimentary: 'End the complimentary cloud AI period now. Any paid premium subscription remains active.',
};
const SCREEN_LABELS: Record<string, string> = { home: 'Home', library: 'Library', planner: 'Study plan', discover: 'Discover', stats: 'Progress', profile: 'Settings', 'study-pack': 'Study Packs', exam: 'Exam Mode', 'smart-study': 'Smart Study', 'speed-review': 'Speed Review', visuals: 'Visuals', shared: 'Shared pack preview', 'community-class': 'Classes', processing: 'Document import', flagged: 'Flagged review', mistakes: 'Mistake notebook' };
const number = (value: number) => new Intl.NumberFormat().format(Number(value) || 0);
const money = (value: number) => `$${Number(value || 0).toFixed(4)}`;
const date = (value: string) => new Date(value).toLocaleDateString();
function duration(seconds: number) { const minutes = Math.round(seconds / 60); return seconds > 0 && minutes < 1 ? '<1m' : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }

export function AdminScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useStudyBolt();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<'overview' | 'users' | 'feedback'>('overview');
  const [range, setRange] = useState<AdminRange>('30d');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [directory, setDirectory] = useState<AdminDirectory | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [allLeaders, setAllLeaders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<{ user: AdminUser; action: AdminUserAction } | null>(null);
  const [editingReport, setEditingReport] = useState<FeedbackReport | null>(null);
  const [reply, setReply] = useState('');
  const [draftStatus, setDraftStatus] = useState<FeedbackStatus>('new');
  const [priority, setPriority] = useState<FeedbackPriority>('normal');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const version = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    const current = ++version.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextDirectory, nextFeedback] = await Promise.all([
        fetchAdminOverview(range),
        section === 'users' ? fetchAdminUsers(page, search) : Promise.resolve(null),
        section === 'feedback' ? fetchAdminFeedback(page, status) : Promise.resolve(null),
      ]);
      if (current !== version.current) return;
      setOverview(nextOverview);
      if (nextDirectory) { setDirectory(nextDirectory); if (nextDirectory.page !== page) setPage(nextDirectory.page); }
      if (nextFeedback) {
        setFeedback(nextFeedback);
        if (page > nextFeedback.totalPages) setPage(nextFeedback.totalPages);
      }
    } catch (reason) {
      if (current !== version.current) return;
      if (reason instanceof AdminAccessError) { setDenied(true); setOverview(null); setDirectory(null); setFeedback(null); setAction(null); setEditingReport(null); }
      setError(reason instanceof Error ? reason.message : 'Admin data could not be loaded.');
    } finally {
      if (current === version.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page, range, search, section, status, user]);

  useEffect(() => { void load(); return () => { version.current += 1; }; }, [load]);

  const runAction = async () => {
    setBusy(true); setActionError(null);
    try {
      if (action) await performAdminUserAction(action.user.id, action.action);
      else if (editingReport) await updateAdminFeedback(editingReport.id, draftStatus, priority, reply);
      setNotice(action ? 'Account action completed and recorded.' : 'Support request updated. The learner can see your reply in Help & support.');
      setAction(null); setEditingReport(null); setExpandedId(null);
      await load(true);
    } catch (reason) {
      if (reason instanceof AdminAccessError) { setDenied(true); setAction(null); setEditingReport(null); }
      setActionError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally { setBusy(false); }
  };

  const changeSection = (next: typeof section) => { setSection(next); setPage(1); setExpandedId(null); setError(null); setNotice(null); };
  const openAction = (target: AdminUser, next: AdminUserAction) => { setAction({ user: target, action: next }); setActionError(null); };
  const closeModal = () => { if (!busy) { setAction(null); setEditingReport(null); } };
  const feedbackCount = feedback?.unresolvedCount ?? overview?.metrics.openFeedback ?? 0;
  const metrics = overview?.metrics;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
        <Header title="Admin Center" subtitle="StudyBolt" onBack={onBack} right={<Pill label="Admin" tone="purple" />} />
        <Card style={{ backgroundColor: colors.primarySoft }}>
          <View style={styles.row}>
            <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}><Icon name="shield-account-outline" size={27} color={colors.primaryText} /></View>
            <View style={styles.flex}><Text style={[styles.eyebrow, { color: colors.primary }]}>PRIVATE OPERATIONS</Text><Text style={[styles.heroTitle, { color: colors.text }]}>StudyBolt Admin Center</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Learner health, product signals, and account controls.</Text></View>
          </View>
        </Card>
        {!user || denied ? <Card><Text style={[styles.title, { color: colors.text }]}>Admin access required</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{error ?? 'Sign in with an authorized StudyBolt admin account.'}</Text><PrimaryButton label="Back to settings" onPress={onBack} style={styles.gap} /></Card> : <>
          <View style={[styles.tabs, { backgroundColor: colors.cardStrong }]}>
            {(['overview', 'users', 'feedback'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => changeSection(item)} style={[styles.tab, { backgroundColor: section === item ? colors.card : 'transparent' }]}><Text style={[styles.tabText, { color: section === item ? colors.primary : colors.textSecondary }]}>{item[0]!.toUpperCase() + item.slice(1)}{item === 'feedback' && feedbackCount ? ` (${feedbackCount > 99 ? '99+' : feedbackCount})` : ''}</Text></Pressable>)}
          </View>
          {notice ? <Card><Text style={[styles.copy, { color: colors.mint }]}>{notice}</Text></Card> : null}
          {error ? <Card><Text style={[styles.title, { color: colors.danger }]}>Admin data is unavailable</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{error}</Text><ActionButton label="Retry" icon="refresh" onPress={() => void load()} /></Card> : null}
          {section === 'overview' ? <>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>REPORTING RANGE · UTC</Text>
            <Choices options={RANGES.map(item => item.id)} selected={range} label={id => RANGES.find(item => item.id === id)!.label} onSelect={id => setRange(id as AdminRange)} />
            {loading ? <Loading /> : metrics && overview ? <>
              <View style={styles.grid}>
                <Metric icon="account-group-outline" label="Total users" value={number(metrics.totalUsers)} />
                <Metric icon="pulse" label="Active in range" value={number(metrics.activeUsers)} mint />
                <Metric icon="account-plus-outline" label="New in range" value={number(metrics.newUsers)} />
                <Metric icon="check-circle-outline" label="Quiz accuracy" value={metrics.quizAccuracy === null ? '—' : `${metrics.quizAccuracy}%`} mint />
              </View>
              <SectionHeader title="What to improve next" />
              {metrics.openFeedback > 0 ? <Card onPress={() => changeSection('feedback')}><View style={styles.row}><Icon name="message-alert-outline" color={colors.warning} /><View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>Review learner feedback</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{number(metrics.openFeedback)} {metrics.openFeedback === 1 ? 'request is' : 'requests are'} waiting for a response.</Text></View><Icon name="chevron-right" color={colors.textMuted} /></View></Card> : <Card><Text style={[styles.copy, { color: colors.textSecondary }]}>The support inbox is clear. Watch practice activity and quiz accuracy as learners use this version.</Text></Card>}
              {metrics.quizAccuracy !== null && metrics.quizAccuracy < 60 ? <Card><Text style={[styles.title, { color: colors.warning }]}>Quiz accuracy needs attention</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Learners answered {metrics.quizAccuracy}% of recorded questions correctly in this range. Review feedback for confusing material or difficult questions.</Text></Card> : null}
              <SectionHeader title="Learning activity" />
              <Card><DataRow label="Study Packs created" value={number(metrics.packsCreated)} /><DataRow label="Completed quizzes" value={number(metrics.quizAttempts)} /><DataRow label="Flashcard reviews" value={number(metrics.cardReviews)} /><DataRow label="Completed practice time" value={duration(metrics.learningSeconds)} /><Text style={[styles.note, { color: colors.textMuted }]}>Activity starts with this version for signed-in learners. Practice time uses recorded quiz and flashcard durations.</Text></Card>
              <SectionHeader title="Cloud AI" action={`${number(metrics.premiumUsers)} premium accounts`} />
              <Card>{overview.capabilities.cloudUsage ? <><DataRow label="Cloud requests" value={number(metrics.cloudRequests)} /><DataRow label="Recorded provider cost" value={money(metrics.cloudCostUsd)} /><DataRow label="Input / output tokens" value={`${number(metrics.inputTokens)} / ${number(metrics.outputTokens)}`} />{overview.cloudActions.map(item => <DataRow key={item.action} label={item.action.replace(/-/g, ' ')} value={`${number(item.requests)} · ${money(item.cost)}`} />)}<Text style={[styles.note, { color: colors.textMuted }]}>Costs come from the server ledger. On-device AI uses no cloud quota and is excluded.</Text></> : <Empty text="Cloud AI reporting is not connected to this backend yet. Usage appears after the AI ledger is configured." />}</Card>
              <SectionHeader title="Discover & classes" action="Current totals" />
              <Card>{overview.capabilities.community ? <><DataRow label="Public Study Packs" value={number(metrics.publicPacks)} /><DataRow label="Classes" value={number(metrics.classes)} /><DataRow label="Class memberships" value={number(metrics.classMembers)} />{overview.topPacks.map((pack, index) => <DataRow key={pack.id} label={`${index + 1}. ${pack.title || 'Untitled pack'}`} detail={pack.subject} value={`${number(pack.saves)} saves`} />)}{!overview.topPacks.length ? <Text style={[styles.note, { color: colors.textMuted }]}>Popular packs appear after learners publish to Discover.</Text> : null}</> : <Empty text="Community reporting appears after Discover and Classes are connected to this backend." />}</Card>
              <SectionHeader title="Where learners spend time" />
              <Card>{overview.screenTime.length ? overview.screenTime.map(item => <View key={item.screen} style={styles.timeRow}><DataRow label={SCREEN_LABELS[item.screen] ?? item.screen} value={duration(item.seconds)} /><View style={[styles.track, { backgroundColor: colors.cardStrong }]}><View style={[styles.bar, { backgroundColor: colors.primary, width: `${Math.max(2, item.seconds / Math.max(1, overview.screenTime[0]!.seconds) * 100)}%` }]} /></View></View>) : <Empty text="Foreground screen time begins collecting with this version." />}<Text style={[styles.note, { color: colors.textMuted }]}>Foreground time is an estimate of time with the app visible. Background and admin screens are excluded.</Text></Card>
              <SectionHeader title="Most active learners" action="Top 20" />
              <Card>{overview.topLearners.length ? overview.topLearners.slice(0, allLeaders ? 20 : 5).map((learner, index) => <DataRow key={learner.id} label={`${index + 1}. ${learner.name}`} detail={`${learner.packs} packs · ${learner.quizzes} quizzes · ${learner.reviews} reviews`} value={number(learner.actions)} />) : <Empty text="Learning activity will appear after signed-in learners study with this version." />}{overview.topLearners.length > 5 ? <ActionButton label={allLeaders ? 'Show top 5' : 'Show all learners'} onPress={() => setAllLeaders(value => !value)} /> : null}</Card>
              <SectionHeader title="Recent admin actions" />
              <Card>{overview.recentActions.length ? overview.recentActions.map(item => <DataRow key={item.id} label={item.action.replace(/_/g, ' ')} detail={`${item.email || 'Support request'} · ${date(item.created_at)}`} value={item.outcome} />) : <Empty text="Account and support actions will be recorded here." />}</Card>
              <Text style={[styles.note, { color: colors.textMuted }]}>Updated {new Date(overview.generatedAt).toLocaleString()}</Text>
            </> : null}
          </> : null}
          {section === 'users' ? <>
            <SectionHeader title="User directory" action={directory ? `${number(directory.total)} ${directory.total === 1 ? 'user' : 'users'}` : undefined} />
            <TextInput accessibilityLabel="Search all learners" value={query} onChangeText={setQuery} placeholder="Search all learners by name or email" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} maxLength={120} style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} />
            {loading ? <Loading /> : directory ? <>
              {directory.users.map(learner => {
                const expanded = expandedId === learner.id;
                const complimentary = Boolean(learner.complimentary_until && Date.parse(learner.complimentary_until) > Date.now());
                const protectedAccount = learner.is_admin || learner.id === user.id;
                return <Card key={learner.id}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedId(expanded ? null : learner.id)} style={styles.row}><View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>{learner.name}</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>{learner.email || learner.id}</Text></View><Pill label={learner.is_admin ? 'Admin' : learner.subscription_tier === 'premium' ? 'Premium' : complimentary ? 'Complimentary' : 'Free'} tone={learner.is_admin ? 'purple' : complimentary || learner.subscription_tier === 'premium' ? 'mint' : 'neutral'} /><Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.textMuted} /></Pressable>
                  {expanded ? <View style={styles.gap}><Text style={[styles.note, { color: colors.textMuted }]}>Joined {date(learner.created_at)} · Last seen in StudyBolt {learner.last_sign_in_at ? date(learner.last_sign_in_at) : 'never'}</Text><DataRow label="Recorded packs / quizzes / reviews" value={`${learner.packs} / ${learner.quizzes} / ${learner.reviews}`} />{!overview?.capabilities.quotaControls ? <Text style={[styles.note, { color: colors.textMuted }]}>Cloud AI controls become available after the AI backend is configured.</Text> : null}<DataRow label="Cloud requests this period" value={learner.ai_used === null ? '—' : number(learner.ai_used)} />{complimentary ? <Text style={[styles.note, { color: colors.mint }]}>Complimentary AI through {date(learner.complimentary_until!)}</Text> : null}{protectedAccount ? <Text style={[styles.note, { color: colors.textMuted }]}>Admin accounts are protected from directory actions.</Text> : <><ActionButton label={ACTION_LABELS.reset_ai_quota} icon="refresh" disabled={!overview?.capabilities.quotaControls} onPress={() => openAction(learner, 'reset_ai_quota')} /><ActionButton label={ACTION_LABELS.grant_complimentary} icon="gift-outline" disabled={!overview?.capabilities.quotaControls} onPress={() => openAction(learner, 'grant_complimentary')} />{complimentary ? <ActionButton label={ACTION_LABELS.revoke_complimentary} onPress={() => openAction(learner, 'revoke_complimentary')} /> : null}</>}</View> : null}
                </Card>;
              })}
              {!directory.users.length ? <Card><Empty text="No learners match that search." /></Card> : null}
              <Pagination page={directory.page} total={directory.totalPages} onChange={setPage} />
            </> : null}
          </> : null}
          {section === 'feedback' ? <>
            <SectionHeader title="Learner feedback" action={`${feedbackCount} open`} />
            <Choices options={['all', ...STATUSES]} selected={status} onSelect={value => { setStatus(value as typeof status); setPage(1); }} />
            {loading ? <Loading /> : feedback ? <>
              {feedback.reports.map(report => <Card key={report.id}><View style={styles.row}><Pill label={report.category} tone="blue" /><Pill label={report.status} tone={report.status === 'resolved' ? 'mint' : 'neutral'} /><Text style={[styles.note, { color: report.priority === 'critical' || report.priority === 'high' ? colors.danger : colors.textMuted }]}>{report.priority}</Text></View><Text style={[styles.title, styles.gap, { color: colors.text }]}>{report.subject}</Text><Text style={[styles.note, { color: colors.textMuted }]}>{report.userName} · {report.userEmail} · {date(report.created_at)}</Text><Text style={[styles.copy, styles.gap, { color: colors.textSecondary }]}>{report.message}</Text>{report.admin_reply ? <View style={[styles.replyBox, { backgroundColor: colors.primarySoft }]}><Text style={[styles.eyebrow, { color: colors.primary }]}>ADMIN REPLY</Text><Text style={[styles.copy, { color: colors.text }]}>{report.admin_reply}</Text></View> : null}<ActionButton label="Reply & manage" icon="message-reply-text-outline" onPress={() => { setEditingReport(report); setReply(report.admin_reply ?? ''); setDraftStatus(report.status); setPriority(report.priority); setActionError(null); }} /></Card>)}
              {!feedback.reports.length ? <Card><Empty text="No support requests in this view." /></Card> : null}
              <Pagination page={feedback.page} total={feedback.totalPages} onChange={setPage} />
            </> : null}
          </> : null}
        </>}
      </ScrollView>
      <Modal visible={Boolean(action || editingReport) && !denied && Boolean(user)} transparent animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable accessibilityLabel="Close admin action" onPress={closeModal} style={StyleSheet.absoluteFill} />
          <View accessibilityViewIsModal style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.heroTitle, { color: colors.text }]}>{action ? ACTION_LABELS[action.action] : 'Reply & manage feedback'}</Text>
              {action ? <><Text style={[styles.copy, styles.gap, { color: colors.textSecondary }]}>{action.user.email || action.user.id}</Text><Text style={[styles.copy, styles.gap, { color: colors.textSecondary }]}>{ACTION_DETAILS[action.action]}</Text></> : editingReport ? <><Text style={[styles.copy, styles.gap, { color: colors.textSecondary }]}>{editingReport.subject}</Text><Text style={[styles.eyebrow, styles.gap, { color: colors.textMuted }]}>STATUS</Text><Choices options={STATUSES} selected={draftStatus} onSelect={value => setDraftStatus(value as FeedbackStatus)} /><Text style={[styles.eyebrow, styles.gap, { color: colors.textMuted }]}>PRIORITY</Text><Choices options={PRIORITIES} selected={priority} onSelect={value => setPriority(value as FeedbackPriority)} /><TextInput accessibilityLabel="Reply to learner" value={reply} onChangeText={setReply} placeholder="Reply to the learner…" placeholderTextColor={colors.textMuted} multiline maxLength={3000} textAlignVertical="top" style={[styles.input, styles.replyInput, { color: colors.text, borderColor: colors.border }]} /></> : null}
              {actionError ? <Text accessibilityRole="alert" style={[styles.copy, styles.gap, { color: colors.danger }]}>{actionError}</Text> : null}
              <PrimaryButton label={busy ? 'Saving…' : 'Confirm & save'} loading={busy} onPress={() => void runAction()} style={styles.gap} />
              <ActionButton label="Cancel" disabled={busy} onPress={closeModal} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Metric({ label, value, icon, mint = false }: { label: string; value: string; icon: IconName; mint?: boolean }) {
  const { colors } = useStudyBolt();
  return <Card style={styles.metric}><Icon name={icon} color={mint ? colors.mint : colors.primary} /><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text><Text style={[styles.note, { color: colors.textSecondary }]}>{label}</Text></Card>;
}
function DataRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.dataRow}><View style={styles.flex}><Text style={[styles.copy, { color: colors.text }]}>{label}</Text>{detail ? <Text style={[styles.note, { color: colors.textMuted }]}>{detail}</Text> : null}</View><Text style={[styles.dataValue, { color: colors.text }]}>{value}</Text></View>;
}
function Empty({ text }: { text: string }) { const { colors } = useStudyBolt(); return <Text style={[styles.copy, { color: colors.textMuted }]}>{text}</Text>; }
function Loading() { const { colors } = useStudyBolt(); return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.copy, { color: colors.textMuted }]}>Loading secure workspace…</Text></View>; }
function ActionButton({ label, onPress, icon, danger = false, disabled = false }: { label: string; onPress: () => void; icon?: IconName; danger?: boolean; disabled?: boolean }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.cardStrong, borderColor: colors.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>{icon ? <Icon name={icon} size={18} color={danger ? colors.danger : colors.primary} /> : null}<Text style={[styles.actionText, { color: danger ? colors.danger : colors.primary }]}>{label}</Text></Pressable>;
}
function Choices({ options, selected, onSelect, label = value => value[0]!.toUpperCase() + value.slice(1) }: { options: string[]; selected: string; onSelect: (value: string) => void; label?: (value: string) => string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.choices}>{options.map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => onSelect(value)} style={[styles.choice, { backgroundColor: selected === value ? colors.primary : colors.card, borderColor: selected === value ? colors.primary : colors.border }]}><Text style={[styles.choiceText, { color: selected === value ? colors.primaryText : colors.textSecondary }]}>{label(value)}</Text></Pressable>)}</View>;
}
function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const { colors } = useStudyBolt();
  if (total <= 1) return null;
  return <View style={styles.pagination}><ActionButton label="Previous" disabled={page <= 1} onPress={() => onChange(page - 1)} /><Text style={[styles.note, { color: colors.textMuted }]}>{page} / {total}</Text><ActionButton label="Next" disabled={page >= total} onPress={() => onChange(page + 1)} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, content: { paddingHorizontal: 20, gap: 12 }, flex: { flex: 1, minWidth: 0 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, heroTitle: { fontSize: 20, fontWeight: '900', lineHeight: 27 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 21 }, eyebrow: { fontSize: 10, letterSpacing: 1, fontWeight: '800', marginBottom: 5 }, copy: { fontSize: 13, lineHeight: 20 }, note: { fontSize: 11, lineHeight: 17 }, gap: { marginTop: 12 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 14 }, tab: { flex: 1, borderRadius: 11, alignItems: 'center', paddingVertical: 12 }, tabText: { fontSize: 12, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { flexBasis: '47%', flexGrow: 1, gap: 6 }, metricValue: { fontSize: 30, fontWeight: '900' },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 9 }, dataValue: { fontSize: 12, fontWeight: '800', maxWidth: '43%', textAlign: 'right' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, choice: { paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, borderWidth: 1 }, choiceText: { fontSize: 11, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, padding: 13, fontSize: 14, marginTop: 8 }, actionButton: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, actionText: { fontSize: 12, fontWeight: '800', flexShrink: 1, textAlign: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, loading: { paddingVertical: 35, alignItems: 'center', gap: 12 },
  timeRow: { marginBottom: 10 }, track: { height: 5, borderRadius: 5, overflow: 'hidden' }, bar: { height: 5, borderRadius: 5 }, replyBox: { borderRadius: 12, padding: 12, marginTop: 12 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 20 }, modal: { maxHeight: '85%', borderRadius: 22, borderWidth: 1, padding: 20, width: '100%', maxWidth: 560, alignSelf: 'center' }, replyInput: { minHeight: 120 },
});
