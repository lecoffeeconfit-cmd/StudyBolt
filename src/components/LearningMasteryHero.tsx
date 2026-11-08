import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, Icon } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StatDetail } from '../data/statExplanations';
import { buildLearningMastery } from '../services/learningMastery';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { radius, typography } from '../theme';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function materialSummary(group: LearningMasteryGroup): string[] {
  return [
    group.powerpoints ? plural(group.powerpoints, 'PowerPoint') : '',
    group.pdfs ? plural(group.pdfs, 'PDF') : '',
    group.noteSets ? plural(group.noteSets, 'note set') : '',
  ].filter(Boolean);
}

function classBreakdown(group: LearningMasteryGroup): StatDetail {
  return {
    label: `${group.name} · learning breakdown`,
    value: group.mastery === null ? 'Not assessed yet' : `${group.mastery}%`,
    supporting: `${materialSummary(group).join(' · ')} across ${plural(group.packs.length, 'Study Pack')}. ${group.explanation}`,
    description: group.packs.map((pack) => `${pack.title}: ${pack.practiced ? 'practice recorded' : 'no recorded practice'}, ${plural(pack.topics, 'identified topic')}.`).join('\n\n'),
    calculation: 'This hero uses your saved material only; bundled samples and seeded history are excluded. Material practiced is the share of Study Packs with a recorded quiz answer or flashcard review, not the share learned. Quiz accuracy counts fully correct first answers once per source question. A mastery estimate is shown only when all identified topics have at least two distinct practice items and every current item has recall evidence on separate days at least 24 hours apart within the last 30 days. A topic shows consistent recall when each item’s two latest daily responses succeed, including a successful spaced response, with no latest topic-item failure. The estimate is the unweighted share of those topics. Repeated same-day attempts do not increase it. This conservative reporting rule is not a validated assessment of the full course syllabus.',
    insight: `${plural(group.assessedTopics, 'topic')} assessed out of ${group.topicCount}. ${plural(group.supportedTopics, 'topic')} showing consistent recall.\n\n${group.focusTopics.length ? `Focus next:\n${group.focusTopics.map((topic) => `${topic.title} — ${topic.packTitle}`).join('\n')}` : 'Practice a quiz or review flashcards on different days to find what needs attention.'}`,
    whyItMatters: 'Use this breakdown to choose a Study Pack to practice from your Library. Uploading, reading, or listening alone does not establish mastery. Missing or older evidence remains unassessed; this is not an exam prediction.',
  };
}

/** Self-contained Stats hero. Selection and scrolling never affect the sections below. */
export function LearningMasteryHero({ onExplore }: { onExplore: (detail: StatDetail) => void }) {
  const { state, colors, hydrated } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const [asOf, setAsOf] = useState(() => new Date());
  const groups = useMemo(() => buildLearningMastery(state, asOf), [asOf, state]);
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const [width, setWidth] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const list = useRef<FlatList<LearningMasteryGroup>>(null);
  const ids = groups.map((group) => group.id).join('|');
  const selectedIndex = Math.max(0, groups.findIndex((group) => group.id === selectedId));
  const selected = groups[selectedIndex]!;
  const onlyClasses = groups.every((group) => group.kind === 'class');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') setAsOf(new Date()); });
    return () => subscription.remove();
  }, []);

  const select = (index: number, announce = true) => {
    const group = groups[index];
    if (!group || group.id === selectedRef.current) return;
    const hadSelection = selectedRef.current !== null;
    selectedRef.current = group.id;
    setSelectedId(group.id);
    if (announce && hadSelection) AccessibilityInfo.announceForAccessibility(`${group.name}, ${index + 1} of ${groups.length}`);
  };

  useEffect(() => {
    const current = groupsRef.current;
    const index = Math.max(0, current.findIndex((group) => group.id === selectedRef.current));
    selectedRef.current = current[index]!.id;
    setSelectedId(current[index]!.id);
    if (width) list.current?.scrollToOffset({ offset: index * width, animated: false });
    // Reposition only after size or identity changes, never during a swipe.
  }, [ids, width]);

  const navigate = (index: number) => {
    if (index < 0 || index >= groups.length) return;
    if (width) list.current?.scrollToOffset({ offset: index * width, animated: !reducedMotion });
    if (!width || reducedMotion) select(index);
  };

  if (!hydrated) return (
    <Card style={styles.card}>
      <View accessibilityState={{ busy: true }} style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.copy, { color: colors.textSecondary }]}>Loading your learning progress…</Text>
      </View>
    </Card>
  );

  return (
    <Card style={styles.card}>
      <View style={[styles.headingRow, fontScale > 1.3 && styles.stackedHeading]}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR LEARNING PROGRESS</Text>
        <Text style={[styles.position, { color: colors.textMuted }]}>{groups.length === 1 && selected.kind === 'overview' ? 'Personal overview' : `${selectedIndex + 1} of ${groups.length} ${onlyClasses ? groups.length === 1 ? 'class' : 'classes' : 'views'}`}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Learning Mastery</Text>

      <View style={styles.classSelector}>
        <ClassArrow direction="left" disabled={selectedIndex === 0} onPress={() => navigate(selectedIndex - 1)} />
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.className, { color: colors.text }]}>{selected.name}</Text>
        <ClassArrow direction="right" disabled={selectedIndex === groups.length - 1} onPress={() => navigate(selectedIndex + 1)} />
      </View>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <FlatList
            ref={list}
            data={groups}
            keyExtractor={(group) => group.id}
            horizontal
            pagingEnabled
            directionalLockEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            scrollEnabled={groups.length > 1}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            extraData={selectedId}
            onScroll={(event) => select(Math.max(0, Math.min(groups.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
            scrollEventThrottle={32}
            renderItem={({ item }) => <MasteryPage group={item} width={width} active={item.id === selected.id} reducedMotion={reducedMotion} />}
          />
        ) : <MasteryPage group={selected} width={undefined} active reducedMotion={reducedMotion} />}
      </View>

      {groups.length > 1 ? (
        <View style={styles.pager}>
          {groups.length <= 7 ? groups.map((group, index) => (
            <View key={group.id} accessible={false} style={[styles.dot, { backgroundColor: index === selectedIndex ? colors.primary : colors.border, width: index === selectedIndex ? 20 : 6 }]} />
          )) : <Text style={[styles.smallCopy, { color: colors.textMuted }]}>Swipe or use the arrows to switch classes</Text>}
        </View>
      ) : null}

      {selected.packs.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityHint="Opens the existing Stats detail sheet with this class’s material and practice evidence" onPress={() => onExplore(classBreakdown(selected))} style={({ pressed }) => [styles.explore, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.exploreText, { color: colors.primaryText }]}>{selected.kind === 'class' ? 'Explore class breakdown' : 'Explore material breakdown'}</Text>
          <Icon name="arrow-right" size={18} color={colors.primaryText} />
        </Pressable>
      ) : null}
      <Text style={[styles.scope, { color: colors.textMuted }]}>Your saved material only · sample statistics stay separate</Text>
    </Card>
  );
}

function ClassArrow({ direction, disabled, onPress }: { direction: 'left' | 'right'; disabled: boolean; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={direction === 'left' ? 'Previous class' : 'Next class'} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.arrow, { backgroundColor: colors.cardStrong, opacity: disabled ? 0.35 : pressed ? 0.65 : 1 }]}>
      <Icon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} color={colors.text} size={23} />
    </Pressable>
  );
}

function MasteryPage({ group, width, active, reducedMotion }: { group: LearningMasteryGroup; width: number | undefined; active: boolean; reducedMotion: boolean }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(1)).current;
  const wide = (width ?? 0) >= 310 && fontScale <= 1.2;
  const summary = materialSummary(group);
  useEffect(() => {
    opacity.stopAnimation();
    if (!active || reducedMotion) { opacity.setValue(1); return; }
    opacity.setValue(0.82);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [active, opacity, reducedMotion]);

  return (
    <Animated.View aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'} style={[styles.page, { width, opacity }]}>
      <View style={[styles.main, wide && styles.mainWide]}>
        <MasteryRing value={group.mastery} />
        <View style={[styles.material, wide && styles.materialWide]}>
          <Text style={[styles.smallCopy, { color: colors.textMuted }]}>{group.kind === 'class' ? 'Your class material' : 'Your study material'}</Text>
          <Text style={[styles.materialCount, { color: colors.text }]}>{summary[0] ?? 'No material yet'}</Text>
          {summary.length > 1 ? <Text style={[styles.copy, { color: colors.textSecondary }]}>{summary.slice(1).join(' · ')}</Text> : null}
          {group.packs.length ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{plural(group.packs.length, 'Study Pack')} · {group.topicCount ? `${group.assessedTopics} of ${group.topicCount} topics assessed` : 'Topics not mapped yet'}</Text> : null}
          <View style={[styles.evidenceBadge, { backgroundColor: colors.primarySoft }]}>
            <Icon name={group.mastery === null ? 'progress-clock' : 'check-decagram-outline'} color={colors.primary} size={15} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>{group.mastery === null ? 'Building evidence' : 'Repeated recall'}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.explanation, { color: colors.textSecondary }]}>{group.explanation}</Text>

      <View style={[styles.metrics, { borderColor: colors.border }, fontScale > 1.4 && styles.stackedMetrics]}>
        <HeroMetric label="Material practiced" value={group.materialPracticed} detail={group.packs.length ? `${group.practicedPacks} of ${plural(group.packs.length, 'Study Pack')} · recorded practice` : 'Add your first Study Pack'} />
        <HeroMetric label="Quiz accuracy" value={group.quizAccuracy} detail={group.quizQuestions ? `${plural(group.quizQuestions, 'unique question')} · first answers` : 'No recorded quiz answers'} />
      </View>

      <View style={[styles.focus, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.focusHeading}>
          <Icon name="compass-outline" color={colors.primary} size={18} />
          <Text style={[styles.focusTitle, { color: colors.text }]}>Focus next</Text>
        </View>
        {group.focusTopics.length ? group.focusTopics.slice(0, 2).map((topic) => (
          <View key={topic.id} style={styles.focusRow}>
            <View style={[styles.focusDot, { backgroundColor: colors.primary }]} />
            <View style={styles.focusCopy}>
              <Text style={[styles.copy, { color: colors.text }]}>{topic.title}</Text>
              <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{topic.packTitle}</Text>
            </View>
          </View>
        )) : <Text style={[styles.copy, { color: colors.textSecondary }]}>{!group.packs.length ? 'Add a Study Pack from Home to begin.' : group.mastery === null ? 'Practice a quiz to discover which topics need review.' : 'Keep using spaced recall to check that your learning stays strong.'}</Text>}
      </View>
    </Animated.View>
  );
}

function MasteryRing({ value }: { value: number | null }) {
  const { colors } = useStudyBolt();
  const { fontScale } = useWindowDimensions();
  const size = Math.min(208, 136 * Math.max(1, fontScale));
  const radius = 57;
  const circumference = 2 * Math.PI * radius;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={value === null ? 'Learning mastery is unassessed. Not enough spaced practice yet.' : `${value} percent mastery estimate, based on repeated recall across identified topics.`} style={styles.ringColumn}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox="0 0 136 136" accessible={false}>
          <Circle cx={68} cy={68} r={radius} stroke={colors.cardStrong} strokeWidth={10} fill="none" />
          {value !== null && value > 0 ? <Circle cx={68} cy={68} r={radius} stroke={colors.primary} strokeWidth={10} strokeLinecap="round" fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - value / 100)} rotation={-90} origin="68,68" /> : null}
        </Svg>
        <View pointerEvents="none" style={styles.ringCenter}>
          <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.ringValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : `${value}%`}</Text>
        </View>
      </View>
      <Text style={[styles.ringCaption, { color: colors.textSecondary }]}>{value === null ? 'Not assessed yet' : 'Mastery estimate'}</Text>
    </View>
  );
}

function HeroMetric({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  const { colors } = useStudyBolt();
  return (
    <View accessible accessibilityLabel={`${label}: ${value === null ? 'unavailable' : `${value} percent`}. ${detail}`} style={styles.metric}>
      <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: value === null ? colors.textMuted : colors.text }]}>{value === null ? '—' : `${value}%`}</Text>
      <Text style={[styles.smallCopy, { color: colors.textMuted }]}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 18, overflow: 'hidden' },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  stackedHeading: { flexDirection: 'column', alignItems: 'flex-start' },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: '700', letterSpacing: 0.9 },
  position: { ...typography.caption, fontVariant: ['tabular-nums'] },
  title: { fontSize: 25, lineHeight: 33, fontWeight: '800', letterSpacing: -0.65, marginTop: 4 },
  classSelector: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 16 },
  className: { flex: 1, textAlign: 'center', fontSize: 19, lineHeight: 27, fontWeight: '700', letterSpacing: -0.3 },
  arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  page: { paddingBottom: 2 },
  main: { alignItems: 'center', gap: 20 },
  mainWide: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ringColumn: { alignItems: 'center', flexShrink: 0 },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  ringValue: { fontSize: 35, lineHeight: 45, fontWeight: '800', letterSpacing: -1.1, fontVariant: ['tabular-nums'] },
  ringCaption: { fontSize: 12, lineHeight: 18, marginTop: 3, textAlign: 'center' },
  material: { alignSelf: 'stretch', justifyContent: 'center', gap: 6 },
  materialWide: { flex: 1 },
  materialCount: { fontSize: 20, lineHeight: 27, fontWeight: '800', letterSpacing: -0.45 },
  copy: { ...typography.secondary },
  smallCopy: { ...typography.caption },
  evidenceBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, paddingHorizontal: 9, paddingVertical: 7, marginTop: 3 },
  badgeText: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  explanation: { ...typography.secondary, marginTop: 18 },
  metrics: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 18, paddingTop: 18, marginTop: 18 },
  stackedMetrics: { flexDirection: 'column' },
  metric: { flex: 1, gap: 4 },
  metricValue: { ...typography.metric, fontVariant: ['tabular-nums'], fontSize: 26, lineHeight: 34 },
  focus: { borderRadius: radius.md, padding: 14, marginTop: 18, gap: 10 },
  focusHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  focusTitle: { ...typography.cardTitle },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  focusDot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  focusCopy: { flex: 1, gap: 2 },
  pager: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
  explore: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 13, marginTop: 18 },
  exploreText: { ...typography.control, flexShrink: 1, textAlign: 'center' },
  scope: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 12 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 20 },
});
