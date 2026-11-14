import { LoadingArtwork } from './StudyBoltLoading';
import { SubjectIcon } from './SubjectIcon';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, Icon, PrimaryButton } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StatDetail } from '../data/statExplanations';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { radius, spacing, typography } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const plural = (count: number, word: string) => count + ' ' + word + (count === 1 ? '' : 's');
const materialSummary = (group: LearningMasteryGroup) => [
  group.powerpoints ? plural(group.powerpoints, 'presentation') : '',
  group.pdfs ? plural(group.pdfs, 'PDF') : '',
  group.noteSets ? plural(group.noteSets, 'note set') : '',
].filter(Boolean).join(' · ');

export function classKnowledgeDetail(group: LearningMasteryGroup): StatDetail {
  return {
    label: group.name + ' · course evidence',
    value: group.mastery === null ? '—' : group.mastery + '%',
    supporting: (materialSummary(group) || 'No material added') + '. ' + group.explanation,
    description: group.packs.map(pack => pack.title + ': ' + (pack.practiced ? 'practice recorded' : 'no recorded practice') + ', ' + plural(pack.topics, 'identified topic') + '.').join('\n\n'),
    calculation: 'Readiness here means the share of identified topics showing consistent, spaced recall in your saved material. It is shown only when every pack has complete topic mapping, every topic has at least two distinct practice items, and every current item has responses on separate days at least 24 hours apart within the last 30 days. Each item’s two latest daily responses must succeed, including a successful spaced response, for a topic to count as consistent. Same-day retries cannot replace the first response. Quiz accuracy separately counts fully correct first answers once per source question. Practice coverage counts packs with a quiz answer or flashcard review. Uploads, reading time, and listening do not establish recall. Bundled examples and seeded history are excluded.',
    insight: group.assessedTopics + ' of ' + plural(group.topicCount, 'topic') + ' assessed. ' + plural(group.supportedTopics, 'topic') + ' showing consistent recall.' + (group.focusTopics.length ? '\n\nFocus next:\n' + group.focusTopics.map(topic => topic.title + ' — ' + topic.packTitle).join('\n') : ''),
    whyItMatters: 'Use the results to choose your next practice. Flashcard ratings are self-reported recall outcomes. This conservative reporting rule is not a validated prediction of an exam grade or knowledge of the full course syllabus. Older or incomplete evidence stays unassessed.',
  };
}

export function LearningMasteryHero({ groups, selectedId, onSelect, onExplore, onAddMaterial, compact = false }: {
  groups: LearningMasteryGroup[]; selectedId: string; onSelect: (id: string) => void;
  onExplore: (detail: StatDetail) => void;
  onAddMaterial: () => void;
  compact?: boolean;
}) {
  const { colors, hydrated } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const selectedRef = useRef(selectedId);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const list = useRef<FlatList<LearningMasteryGroup>>(null);
  const ids = groups.map(group => group.id).join('|');
  const selectedIndex = Math.max(0, groups.findIndex(group => group.id === selectedId));
  const selected = groups[selectedIndex]!;

  const select = (index: number, announce = false) => {
    const group = groups[index];
    if (!group) return;
    if (group.id !== selectedRef.current) { selectedRef.current = group.id; onSelect(group.id); }
    if (announce) AccessibilityInfo.announceForAccessibility(group.name + ', ' + (index + 1) + ' of ' + groups.length);
  };
  useEffect(() => {
    const current = groupsRef.current;
    const index = Math.max(0, current.findIndex(group => group.id === selectedRef.current));
    selectedRef.current = current[index]!.id;
    if (width) list.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [ids, width]);
  useEffect(() => {
    if (selectedId === selectedRef.current) return;
    selectedRef.current = selectedId;
    const index = Math.max(0, groupsRef.current.findIndex(group => group.id === selectedId));
    if (width) list.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [selectedId, width]);
  const navigate = (index: number) => {
    if (index < 0 || index >= groups.length) return;
    select(index, true);
    list.current?.scrollToOffset({ offset: index * width, animated: !reducedMotion });
  };
  if (!hydrated) return <Card style={styles.card}><View accessibilityState={{ busy: true }} style={styles.loading}><LoadingArtwork colors={colors} /><Text style={[styles.copy, { color: colors.textSecondary }]}>Loading your course progress…</Text></View></Card>;
  return <Card style={styles.card}>
    <View style={styles.topRow}>
      <View style={styles.heading}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>Class knowledge</Text>
        {groups.length > 1 ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{selectedIndex + 1} of {groups.length} · Swipe to change class</Text> : null}
      </View>
      {groups.length > 1 ? <View style={styles.arrows}><ClassArrow direction="left" disabled={selectedIndex === 0} onPress={() => navigate(selectedIndex - 1)} /><ClassArrow direction="right" disabled={selectedIndex === groups.length - 1} onPress={() => navigate(selectedIndex + 1)} /></View> : null}
    </View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? <FlatList ref={list} data={groups} keyExtractor={group => group.id} horizontal pagingEnabled directionalLockEnabled decelerationRate="fast" showsHorizontalScrollIndicator={false}
        scrollEnabled={groups.length > 1} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} extraData={selectedId}
        onMomentumScrollEnd={event => select(Math.max(0, Math.min(groups.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))), true)}
        onScrollEndDrag={event => { if (reducedMotion) select(Math.max(0, Math.min(groups.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))), true); }}
        renderItem={({ item }) => <CoursePage group={item} width={width} active={item.id === selected.id} compact={compact} />} />
        : <CoursePage group={selected} width={undefined} active compact={compact} />}
    </View>
    {!compact && !selected.packs.length ? (
      <View style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
        <View aria-hidden style={[styles.emptyIcon, { backgroundColor: colors.goldSoft }]}><Icon name="school-outline" size={23} color={colors.goldText} /></View>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.statusTitle, { color: colors.text }]}>Ready when you are</Text>
          <Text style={[styles.copy, { color: colors.textSecondary }]}>Add notes, a PDF, or a presentation, then practice to start building recall evidence.</Text>
        </View>
        <PrimaryButton label="Add study material" icon="plus" onPress={onAddMaterial} style={styles.primaryAction} />
      </View>
    ) : null}
    <Pressable accessibilityRole="button" onPress={() => onExplore(classKnowledgeDetail(selected))} style={({ pressed }) => [styles.evidenceLink, { opacity: pressed ? 0.65 : 1 }]}>
      <Icon name="information-outline" size={16} color={colors.primary} />
      <Text style={[styles.linkText, { color: colors.primary }]}>Evidence and material details</Text>
      <Icon name="chevron-right" size={17} color={colors.primary} />
    </Pressable>
  </Card>;
}

function ClassArrow({ direction, disabled, onPress }: { direction: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" accessibilityLabel={direction === 'left' ? 'Previous course' : 'Next course'} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.arrow, { backgroundColor: colors.cardStrong, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}><Icon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} color={colors.text} size={24} /></Pressable>;
}

function CoursePage({ group, width, active, compact }: { group: LearningMasteryGroup; width: number | undefined; active: boolean; compact: boolean }) {
  const { colors, state } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const course = state.classes.find(course => group.id === `class:${course.id}`);
  const hasPacks = group.packs.length > 0;
  return (
    <View aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'} style={{ width }}>
      <View style={styles.courseRow}>
        <SubjectIcon subject={group.name} emoji={course?.emoji} size={36} animated={false} />
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.courseName, { color: colors.text }]}>{group.name}</Text>
          {hasPacks ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{materialSummary(group) || plural(group.packs.length, 'Study Pack')}</Text> : null}
        </View>
      </View>
      {!compact && hasPacks ? (
        <View style={styles.courseDetails}>
          <View style={[styles.main, fontScale > 1.4 && styles.stacked]}>
            <View style={styles.heading}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{group.mastery === null ? 'Not assessed yet' : 'Knowledge readiness'}</Text>
              <Text style={[styles.copy, { color: colors.textSecondary }]}>{group.mastery === null ? 'Practice again on different days to build recall evidence.' : `${group.supportedTopics} of ${group.topicCount} topics show consistent recall.`}</Text>
              {group.topicCount ? <Text style={[styles.smallCopy, { color: colors.textMuted }]}>{group.assessedTopics} of {group.topicCount} topics assessed across days</Text> : null}
            </View>
            {group.mastery !== null ? <RecallRing value={group.mastery} /> : null}
          </View>
          {group.pendingPacks ? <Text style={[styles.smallCopy, { color: group.failedPacks ? colors.warning : colors.textSecondary }]}>{group.failedPacks ? 'Some tools need attention. Check their Study Pack in Library.' : 'Some practice tools are still being prepared.'}</Text> : null}
          <Text style={[styles.smallCopy, { color: colors.textMuted }]}>{group.flashcards} flashcards · {group.completedQuizzes} quizzes recorded</Text>
        </View>
      ) : null}
    </View>
  );
}

function RecallRing({ value }: { value: number }) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const size = Math.min(140, 76 * Math.max(1, fontScale));
  const radius = 49;
  const circumference = 2 * Math.PI * radius;
  const progress = useRef(new Animated.Value(value)).current;
  const previous = useRef(value);
  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion || Platform.OS === 'web') progress.setValue(value);
    else if (previous.current !== value) Animated.timing(progress, { toValue: value, duration: 300, useNativeDriver: false, isInteraction: false }).start();
    previous.current = value;
    return () => progress.stopAnimation();
  }, [progress, reducedMotion, value]);
  return <View accessible accessibilityRole="image" accessibilityLabel={value + ' percent of identified topics show consistent spaced recall.'} style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 120 120" {...(Platform.OS === 'web' ? { 'aria-hidden': true, focusable: false } : { accessible: false })}>
      <Circle cx={60} cy={60} r={radius} stroke={colors.border} strokeWidth={8} fill="none" />
      {value > 0 ? Platform.OS === 'web' ? <Circle cx={60} cy={60} r={radius} stroke={colors.primary} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={circumference + ' ' + circumference} strokeDashoffset={circumference * (1 - value / 100)} transform="rotate(-90 60 60)" /> : <AnimatedCircle cx={60} cy={60} r={radius} stroke={colors.primary} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={circumference + ' ' + circumference} strokeDashoffset={progress.interpolate({ inputRange: [0, 100], outputRange: [circumference, 0] })} transform="rotate(-90 60 60)" /> : null}
    </Svg>
    <View aria-hidden style={styles.ringCenter}><Text style={[styles.ringValue, { color: colors.text }]}>{value}%</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, overflow: 'hidden' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  heading: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: { ...typography.caption, fontWeight: '700' },
  arrows: { flexDirection: 'row', gap: spacing.xs },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  courseName: { ...typography.sectionTitle },
  copy: { ...typography.secondary },
  smallCopy: { ...typography.caption },
  courseDetails: { gap: spacing.sm, marginTop: spacing.md },
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  statusTitle: { ...typography.cardTitle },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 18, lineHeight: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  empty: { borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm },
  emptyIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { width: '100%', minHeight: 46, marginTop: spacing.xs },
  evidenceLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs, marginTop: spacing.xs },
  linkText: { ...typography.caption, fontWeight: '700', flexShrink: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
});
