import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CommunitySetCard } from '../components/CommunitySetCard';
import { Card, Header, Icon, Pill, Screen } from '../components/ui';
import type { CommunityClass, DiscoverSort, DiscoverStudySet, StudyPack } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { isCommunityConfigured, listCommunityClasses, listPublicStudySets } from '../services/community';

type DiscoverTab = 'for-you' | 'classes' | 'sets' | 'shared';

const TABS: Array<{ id: DiscoverTab; label: string }> = [
  { id: 'for-you', label: 'For You' },
  { id: 'classes', label: 'Classes' },
  { id: 'sets', label: 'Sets' },
  { id: 'shared', label: 'Shared' },
];

const SORTS: Array<{ id: DiscoverSort; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Popular' },
  { id: 'saved', label: 'Most saved' },
];

export function DiscoverScreen({
  onPreviewSet,
  onOpenClass,
  onOpenDeck,
}: {
  onPreviewSet: (token: string) => void;
  onOpenClass: (classId: string) => void;
  onOpenDeck: (deck: StudyPack) => void;
}) {
  const { colors, state } = useStudyBolt();
  const [tab, setTab] = useState<DiscoverTab>('for-you');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sort, setSort] = useState<DiscoverSort>('newest');
  const [sets, setSets] = useState<DiscoverStudySet[]>([]);
  const [classes, setClasses] = useState<CommunityClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const subjects = useMemo(() => Array.from(new Set(state.decks.map((deck) => deck.courseName.toLowerCase()))), [state.decks]);
  const sharedDecks = useMemo(() => state.decks.filter((deck) => Boolean(deck.sharedFromToken)), [state.decks]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (offset = 0) => {
    if (tab === 'shared') return;
    offset ? setLoadingMore(true) : setLoading(true);
    setError(null);
    if (tab === 'classes') {
      const result = await listCommunityClasses({ search: debouncedQuery, offset });
      setClasses((current) => offset ? [...current, ...result.data] : result.data);
      setHasMore(Boolean(result.hasMore));
      setError(result.error ?? null);
    } else {
      const result = await listPublicStudySets({ search: debouncedQuery, sort: tab === 'sets' ? sort : 'saved', offset });
      const ranked = tab === 'for-you' && subjects.length
        ? [...result.data].sort((a, b) => Number(subjects.some((subject) => `${b.subject} ${b.courseName}`.toLowerCase().includes(subject))) - Number(subjects.some((subject) => `${a.subject} ${a.courseName}`.toLowerCase().includes(subject))))
        : result.data;
      setSets((current) => offset ? [...current, ...ranked] : ranked);
      setHasMore(Boolean(result.hasMore));
      setError(result.error ?? null);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [debouncedQuery, sort, subjects, tab]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const retry = () => setRefreshKey((value) => value + 1);
  const loadMore = () => void load(tab === 'classes' ? classes.length : sets.length);

  return (
    <Screen>
      <Header title="Discover" />
      <View style={styles.pageIntro}>
        <Text style={[styles.title, { color: colors.text }]}>Discover</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Find useful study material from other students.</Text>
      </View>

      <View style={[styles.search, { backgroundColor: colors.cardStrong }]}> 
        <Icon name="magnify" size={21} color={colors.textMuted} />
        <TextInput
          accessibilityLabel="Search Discover"
          value={query}
          onChangeText={setQuery}
          placeholder="Search classes, subjects, or study sets"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}><Icon name="close-circle" size={19} color={colors.textMuted} /></Pressable> : null}
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(item.id)}
              style={[styles.tab, { backgroundColor: selected ? colors.primarySoft : 'transparent' }]}
            >
              <Text style={[styles.tabText, { color: selected ? colors.primary : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'sets' ? (
        <View style={styles.sorts}>
          {SORTS.map((item) => {
            const selected = sort === item.id;
            return (
              <Pressable key={item.id} onPress={() => setSort(item.id)} style={[styles.sort, { borderColor: selected ? colors.primary : 'transparent', backgroundColor: selected ? colors.primarySoft : colors.cardStrong }]}> 
                <Text style={[styles.sortText, { color: selected ? colors.primary : colors.textMuted }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {tab === 'shared' ? (
        <SharedList decks={sharedDecks} query={debouncedQuery} onOpenDeck={onOpenDeck} />
      ) : loading ? (
        <LoadingState />
      ) : error && !isCommunityConfigured ? (
        <StateCard icon="cloud-off-outline" title="Discover isn’t connected yet" message={error} action="Try again" onAction={retry} />
      ) : error && !(tab === 'classes' ? classes.length : sets.length) ? (
        <StateCard icon="cloud-alert-outline" title="Couldn’t load Discover" message={error} action="Try again" onAction={retry} />
      ) : tab === 'classes' ? (
        <View style={styles.list}>
          {classes.length ? classes.map((item) => <ClassCard key={item.id} studyClass={item} onPress={() => onOpenClass(item.id)} />) : (
            <StateCard icon="school-outline" title="No classes found" message={debouncedQuery ? 'Try a course code, school, subject, or instructor.' : 'Classes will appear here as students add them.'} />
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {tab === 'for-you' && !state.decks.length ? (
            <View style={[styles.prompt, { backgroundColor: colors.primarySoft }]}>
              <Icon name="school-outline" size={21} color={colors.primary} />
              <View style={styles.promptCopy}><Text style={[styles.promptTitle, { color: colors.text }]}>Find study sets from your classes</Text><Text style={[styles.promptText, { color: colors.textSecondary }]}>Search by school or course whenever you’re ready.</Text></View>
            </View>
          ) : null}
          {sets.length ? sets.map((item) => <CommunitySetCard key={item.token} set={item} onPress={() => onPreviewSet(item.token)} />) : (
            <StateCard icon="bookshelf" title="No public sets here yet" message={debouncedQuery ? 'Try a broader class, subject, or set name.' : 'Be the first to share something useful.'} />
          )}
        </View>
      )}

      {hasMore && !loading ? (
        <Pressable accessibilityRole="button" disabled={loadingMore} onPress={loadMore} style={[styles.moreButton, { backgroundColor: colors.cardStrong }]}>
          {loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="chevron-down" size={19} color={colors.primary} />}
          <Text style={[styles.moreText, { color: colors.primary }]}>{loadingMore ? 'Loading…' : 'Show more'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function LoadingState() {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.loadingList}>
      {[0, 1, 2].map((item) => <View key={item} style={[styles.skeleton, { backgroundColor: colors.cardStrong }]} />)}
    </View>
  );
}

function StateCard({ icon, title, message, action, onAction }: { icon: 'bookshelf' | 'cloud-alert-outline' | 'cloud-off-outline' | 'school-outline'; title: string; message: string; action?: string; onAction?: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Card style={[styles.stateCard, styles.flatCard]}>
      <View style={[styles.stateIcon, { backgroundColor: colors.cardStrong }]}><Icon name={icon} size={27} color={colors.textMuted} /></View>
      <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.stateText, { color: colors.textSecondary }]}>{message}</Text>
      {action && onAction ? <Pressable onPress={onAction} style={[styles.retry, { backgroundColor: colors.primarySoft }]}><Text style={[styles.retryText, { color: colors.primary }]}>{action}</Text></Pressable> : null}
    </Card>
  );
}

function ClassCard({ studyClass, onPress }: { studyClass: CommunityClass; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Card onPress={onPress} style={[styles.classCard, styles.flatCard]}>
      <View style={[styles.classIcon, { backgroundColor: colors.mintSoft }]}><Icon name="school-outline" size={24} color={colors.mint} /></View>
      <View style={styles.classCopy}>
        <View style={styles.classTitleRow}><Text style={[styles.classCode, { color: colors.text }]}>{studyClass.courseCode}</Text>{studyClass.joined ? <Pill label="Joined" tone="mint" /> : null}</View>
        <Text style={[styles.className, { color: colors.textSecondary }]}>{studyClass.courseName}</Text>
        <Text numberOfLines={1} style={[styles.classSchool, { color: colors.textMuted }]}>{studyClass.schoolName}{studyClass.instructorName ? ` · ${studyClass.instructorName}` : ''}</Text>
        <Text style={[styles.classMeta, { color: colors.textMuted }]}>{studyClass.setCount} public {studyClass.setCount === 1 ? 'set' : 'sets'}</Text>
      </View>
      <Icon name="chevron-right" color={colors.textMuted} />
    </Card>
  );
}

function SharedList({ decks, query, onOpenDeck }: { decks: StudyPack[]; query: string; onOpenDeck: (deck: StudyPack) => void }) {
  const { colors } = useStudyBolt();
  const filtered = decks.filter((deck) => `${deck.title} ${deck.courseName}`.toLowerCase().includes(query.toLowerCase()));
  if (!filtered.length) return <StateCard icon="bookshelf" title="Nothing shared yet" message="Study sets you add through a share link will appear here." />;
  return (
    <View style={styles.list}>
      {filtered.map((deck) => (
        <Card key={deck.id} onPress={() => onOpenDeck(deck)} style={[styles.sharedCard, styles.flatCard]}>
          <View style={[styles.sharedIcon, { backgroundColor: colors.purpleSoft }]}><Text style={styles.sharedEmoji}>{deck.emoji}</Text></View>
          <View style={styles.classCopy}><Text numberOfLines={1} style={[styles.classCode, { color: colors.text }]}>{deck.title}</Text><Text style={[styles.className, { color: colors.textSecondary }]}>{deck.courseName}</Text><Text style={[styles.classMeta, { color: colors.textMuted }]}>{deck.flashcards.length + deck.notes.length} items · Your own copy</Text></View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pageIntro: { marginTop: 13 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  search: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, marginTop: 16 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 12, paddingVertical: 12 },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 10 },
  tab: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabText: { fontSize: 10, fontWeight: '800' },
  sorts: { flexDirection: 'row', gap: 7, marginTop: 12 },
  sort: { minHeight: 34, borderRadius: 17, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 12 },
  sortText: { fontSize: 9, fontWeight: '800' },
  list: { gap: 8, marginTop: 14 },
  loadingList: { gap: 10, marginTop: 16 },
  skeleton: { height: 112, borderRadius: 18 },
  stateCard: { alignItems: 'center', marginTop: 16, paddingVertical: 26 },
  stateIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 15, fontWeight: '900', marginTop: 12 },
  stateText: { maxWidth: 300, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  retry: { minHeight: 38, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 15, marginTop: 13 },
  retryText: { fontSize: 10, fontWeight: '900' },
  classCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  classIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  classCopy: { flex: 1, minWidth: 0 },
  classTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  classCode: { flexShrink: 1, fontSize: 14, fontWeight: '900' },
  className: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  classSchool: { fontSize: 9, marginTop: 4 },
  classMeta: { fontSize: 9, fontWeight: '700', marginTop: 5 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, padding: 13 },
  promptCopy: { flex: 1 },
  promptTitle: { fontSize: 11, fontWeight: '900' },
  promptText: { fontSize: 9, lineHeight: 13, marginTop: 2 },
  moreButton: { alignSelf: 'center', minHeight: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 17, marginTop: 15 },
  moreText: { fontSize: 11, fontWeight: '900' },
  sharedCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  sharedIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sharedEmoji: { fontSize: 23 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
});
