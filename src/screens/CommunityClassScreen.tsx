import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../AuthContext';
import { CommunitySetCard } from '../components/CommunitySetCard';
import { Card, Header, Icon, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import type { CommunityClass, DiscoverStudySet } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { getCommunityClass, joinCommunityClass, leaveCommunityClass, listPublicStudySets } from '../services/community';

export function CommunityClassScreen({
  classId,
  onBack,
  onPreviewSet,
  onRequireAuth,
}: {
  classId: string;
  onBack: () => void;
  onPreviewSet: (token: string) => void;
  onRequireAuth: () => void;
}) {
  const { colors } = useStudyBolt();
  const { user } = useAuth();
  const [studyClass, setStudyClass] = useState<CommunityClass | null>(null);
  const [sets, setSets] = useState<DiscoverStudySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'saved' | 'newest'>('saved');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [classResult, setsResult] = await Promise.all([
      getCommunityClass(classId),
      listPublicStudySets({ classId, sort }),
    ]);
    setStudyClass(classResult.data);
    setSets(setsResult.data);
    setError(classResult.error ?? setsResult.error ?? (!classResult.data ? 'That class is no longer available.' : null));
    setLoading(false);
  }, [classId, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleJoined = async () => {
    if (!studyClass || busy) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    setBusy(true);
    setError(null);
    const result = studyClass.joined
      ? await leaveCommunityClass(studyClass.id)
      : await joinCommunityClass(studyClass.id);
    if (result.error) setError(result.error);
    else setStudyClass((current) => current ? {
      ...current,
      joined: !current.joined,
      memberCount: Math.max(0, current.memberCount + (current.joined ? -1 : 1)),
    } : current);
    setBusy(false);
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Class" onBack={onBack} />
        <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.loadingText, { color: colors.textSecondary }]}>Opening class…</Text></View>
      </Screen>
    );
  }

  if (!studyClass) {
    return (
      <Screen>
        <Header title="Class" onBack={onBack} />
        <Card style={styles.errorCard}><Icon name="school-outline" size={38} color={colors.textMuted} /><Text style={[styles.errorTitle, { color: colors.text }]}>Class unavailable</Text><Text style={[styles.errorText, { color: colors.textSecondary }]}>{error ?? 'That class could not be found.'}</Text><PrimaryButton label="Try again" icon="refresh" onPress={() => void load()} style={styles.retry} /></Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={studyClass.courseCode} subtitle={studyClass.schoolName} onBack={onBack} right={studyClass.joined ? <Pill label="Joined" tone="mint" /> : undefined} />
      <Card style={[styles.hero, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}33` }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.card }]}><Icon name="school-outline" size={30} color={colors.primary} /></View>
        <View style={styles.heroCopy}>
          <Text style={[styles.code, { color: colors.primary }]}>{studyClass.courseCode}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{studyClass.courseName}</Text>
          <Text style={[styles.school, { color: colors.textSecondary }]}>{studyClass.schoolName}</Text>
          {studyClass.instructorName || studyClass.term ? <Text style={[styles.detail, { color: colors.textMuted }]}>{[studyClass.instructorName, studyClass.term].filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </Card>

      <View style={styles.stats}>
        <MiniStat icon="bookshelf" value={studyClass.setCount} label="public sets" />
        <MiniStat icon="account-group-outline" value={studyClass.memberCount} label="students" />
        <MiniStat icon="tag-outline" value={studyClass.subject} label="subject" textValue />
      </View>

      <PrimaryButton
        label={!user ? 'Sign in to join class' : studyClass.joined ? 'Leave class' : 'Join class'}
        icon={!user ? 'login' : studyClass.joined ? 'check' : 'plus'}
        onPress={() => void toggleJoined()}
        loading={busy}
        style={styles.joinButton}
      />
      {error ? <View style={[styles.notice, { backgroundColor: `${colors.danger}14` }]}><Icon name="alert-circle-outline" size={18} color={colors.danger} /><Text style={[styles.noticeText, { color: colors.danger }]}>{error}</Text></View> : null}

      <SectionHeader title="Study Sets" action={`${sets.length} available`} />
      <View style={styles.sortRow}>
        {([{ id: 'saved', label: 'Popular' }, { id: 'newest', label: 'Recent' }] as const).map((item) => {
          const selected = sort === item.id;
          return <Pressable key={item.id} onPress={() => setSort(item.id)} style={[styles.sort, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.sortText, { color: selected ? colors.primary : colors.textMuted }]}>{item.label}</Text></Pressable>;
        })}
      </View>
      <View style={styles.list}>
        {sets.length ? sets.map((item) => <CommunitySetCard key={item.token} set={item} onPress={() => onPreviewSet(item.token)} />) : (
          <Card style={styles.empty}><View style={[styles.emptyIcon, { backgroundColor: colors.cardStrong }]}><Icon name="book-plus-outline" size={28} color={colors.textMuted} /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>No study sets shared yet</Text><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Public Study Packs associated with this class will appear here.</Text></Card>
        )}
      </View>
    </Screen>
  );
}

function MiniStat({ icon, value, label, textValue = false }: { icon: 'bookshelf' | 'account-group-outline' | 'tag-outline'; value: number | string; label: string; textValue?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.miniStat, { backgroundColor: colors.card }]}>
      <Icon name={icon} size={18} color={colors.primary} />
      <Text numberOfLines={1} style={[textValue ? styles.statTextValue : styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 12, fontWeight: '700' },
  errorCard: { alignItems: 'center', paddingVertical: 30, marginTop: 20 },
  errorTitle: { fontSize: 17, fontWeight: '900', marginTop: 12 },
  errorText: { maxWidth: 300, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 5 },
  retry: { minWidth: 170, marginTop: 17 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 17 },
  heroIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  code: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  name: { fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 3 },
  school: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  detail: { fontSize: 9, marginTop: 5 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  miniStat: { flex: 1, alignItems: 'center', borderRadius: 15, paddingVertical: 12, paddingHorizontal: 5 },
  statValue: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  statTextValue: { maxWidth: '100%', fontSize: 10, fontWeight: '900', marginTop: 5 },
  statLabel: { fontSize: 8, marginTop: 2 },
  joinButton: { marginTop: 13 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, padding: 11, marginTop: 10 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  sortRow: { flexDirection: 'row', gap: 8, marginTop: -4, marginBottom: 10 },
  sort: { minHeight: 34, minWidth: 84, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  sortText: { fontSize: 9, fontWeight: '900' },
  list: { gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 27 },
  emptyIcon: { width: 55, height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '900', marginTop: 11 },
  emptyText: { maxWidth: 290, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },
});
