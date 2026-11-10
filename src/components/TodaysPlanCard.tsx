import { LoadingArtwork } from './StudyBoltLoading';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StudyPack, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import type { HomeDashboard } from '../services/homeDashboard';
import { buildLearningMastery } from '../services/learningMastery';
import type { LearningMasteryGroup } from '../services/learningMastery';
import { getTodaysPlanFocus, getTodaysPlanStatus } from '../services/todaysPlan';
import type { AppColors } from '../theme';
import { SubjectIcon } from './SubjectIcon';
import { PlanBook, PlanBorderHighlight, PlanClassSurface, PlanReadinessRing } from './TodaysPlanArtwork';
import { planToolReady, samePlanRecommendation, todaysPlanCourse } from './todaysPlanPresentation';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = {
  dashboard: HomeDashboard;
  colors: AppColors;
  onStartSession: () => void | Promise<void>;
  onOpenPriority: (kind: HomePriority) => void;
  onOpenPlan: () => void;
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onStartStudy: (mode: SmartStudyMode, focus?: { deckId: string; sectionIds?: string[] }) => void;
  onOpenMistakes: (itemIds?: string[]) => void;
  onOpenLibrary: () => void;
  onAddMaterial: () => void | Promise<void>;
};
type PlanIconName = keyof typeof MaterialCommunityIcons.glyphMap;
function PlanIcon({ name, color, size = 20 }: { name: PlanIconName; color: string; size?: number }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><MaterialCommunityIcons name={name} color={color} size={size} accessible={false} /></View>;
}

/** Today's Plan owns only local selection/presentation; all destinations remain Home's existing actions. */
export function TodaysPlanCard({ dashboard, colors, onStartSession, onOpenPriority, onOpenPlan, onOpenDeck, onStartStudy, onOpenMistakes, onOpenLibrary, onAddMaterial }: Props) {
  const { state, hydrated } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const groups = useMemo(() => buildLearningMastery(state), [state, dashboard]);
  const recommendedDeckId = dashboard.recommendation.deckId ?? dashboard.weak[0]?.deck.id ?? dashboard.decks.find(deck => dashboard.mistakeIds.some(id => id.startsWith(deck.id + ':')))?.id;
  const defaultGroup = groups.find(group => group.packs.some(pack => pack.id === recommendedDeckId)) ?? groups[0]!;
  const [selectedId, setSelectedId] = useState(defaultGroup.id);
  const selectedRef = useRef(selectedId);
  const selectedIndex = Math.max(0, groups.findIndex(group => group.id === selectedId));
  const selected = groups[selectedIndex]!;
  const [cardWidth, setCardWidth] = useState(0);
  const [selectorWidth, setSelectorWidth] = useState(0);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const list = useRef<FlatList<LearningMasteryGroup>>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const arrival = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;
  const acknowledgment = useRef(new Animated.Value(1)).current;
  const content = useRef(new Animated.Value(1)).current;
  const selectedCourse = useMemo(() => todaysPlanCourse(state, selected), [state, selected, dashboard]);
  const hasClass = selected.kind === 'class' || selected.packs.length > 0;
  const hasMaterials = selected.packs.length > 0;
  const focus = getTodaysPlanFocus(selectedCourse.dashboard);
  const status = getTodaysPlanStatus(dashboard);
  const compact = (cardWidth || width - 40) < 340 || fontScale >= 1.3;
  const blue = colors.mode === 'dark' ? colors.primary : '#075BC6';
  const green = colors.mode === 'dark' ? colors.mint : '#187D68';
  const ids = groups.map(group => group.id).join('|');

  useEffect(() => {
    const existing = groups.findIndex(group => group.id === selectedRef.current);
    const index = existing >= 0 ? existing : Math.max(0, groups.findIndex(group => group.id === defaultGroup.id));
    selectedRef.current = groups[index]!.id;
    setSelectedId(groups[index]!.id);
    if (selectorWidth) list.current?.scrollToOffset({ offset: index * selectorWidth, animated: false });
  }, [ids, selectorWidth]);

  useEffect(() => {
    mounted.current = true;
    arrival.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(arrival, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!reducedMotion) animation.start();
    return () => { mounted.current = false; animation.stop(); press.stopAnimation(); };
  }, [arrival, press, reducedMotion]);

  useEffect(() => {
    acknowledgment.setValue(1);
    if (reducedMotion || !status.complete) return;
    acknowledgment.setValue(0);
    const animation = Animated.timing(acknowledgment, { toValue: 1, duration: 280, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [acknowledgment, reducedMotion, status.complete]);

  useEffect(() => {
    content.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(content, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!reducedMotion) animation.start();
    return () => animation.stop();
  }, [content, reducedMotion, selected.id]);

  const select = (index: number, announce = false) => {
    const group = groups[index];
    if (!group || inFlight.current) return;
    if (selectedRef.current !== group.id) { selectedRef.current = group.id; setSelectedId(group.id); setError(null); }
    if (announce) AccessibilityInfo.announceForAccessibility(group.name + ', ' + (index + 1) + ' of ' + groups.length);
  };
  const navigateClass = (index: number) => {
    if (index < 0 || index >= groups.length) return;
    select(index, true);
    list.current?.scrollToOffset({ offset: index * selectorWidth, animated: !reducedMotion });
  };
  const animatePress = (down: boolean) => {
    press.stopAnimation();
    Animated.timing(press, { toValue: down && !reducedMotion ? 1 : 0, duration: reducedMotion ? 0 : 110, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const start = async (action: () => void | Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true); setError(null);
    try { await action(); }
    catch { if (mounted.current) setError('Couldn’t open this step. Please try again.'); }
    finally { inFlight.current = false; if (mounted.current) setOpening(false); }
  };
  const startSelected = () => {
    const scoped = selectedCourse.dashboard;
    // Reuse the original callback for the original recommendation, including the exact upload flow.
    if (scoped.recommendation.kind === 'materials') return dashboard.recommendation.kind === 'materials' ? onStartSession() : onAddMaterial();
    if (samePlanRecommendation(dashboard, scoped)) return onStartSession();
    const next = scoped.recommendation;
    const deck = state.decks.find(item => item.id === next.deckId && selected.packs.some(pack => pack.id === item.id));
    if (next.kind === 'mistakes') return onOpenMistakes(scoped.mistakeIds);
    if (!deck) return onOpenLibrary();
    if (next.kind === 'pack') return onOpenDeck(deck);
    if (next.kind === 'resume') return onOpenDeck(deck, 'audio');
    if (next.kind === 'due') return onOpenDeck(deck, 'flashcards', next.cardIds);
    if (next.kind === 'weak' && next.sectionId) {
      if (!next.cardIds?.length) return onOpenDeck(deck, 'notes');
      return onStartStudy('smart', { deckId: deck.id, sectionIds: [next.sectionId] });
    }
    return deck.flashcards.length ? onStartStudy('smart', { deckId: deck.id }) : onOpenDeck(deck, 'notes');
  };
  const priorities = [
    { kind: 'weak' as const, value: dashboard.weak.length, label: 'Weak topics', empty: 'None identified', detail: 'Based on repeated quiz answers', icon: 'lightning-bolt-outline' as const },
    { kind: 'due' as const, value: dashboard.dueCount, label: 'Due reviews', empty: 'Nothing due', detail: 'Recorded reviews scheduled for now', icon: 'cards-outline' as const },
    { kind: 'mistakes' as const, value: dashboard.mistakeIds.length, label: 'Missed questions', empty: 'Nothing repeated', detail: 'Repeated misses not yet corrected', icon: 'book-alert-outline' as const },
  ];
  const taskTitle = hasClass && !hasMaterials ? 'Let’s get your class ready' : selectedCourse.dashboard.recommendation.kind === 'practice' ? 'Build your practice' : focus.title;
  const reason = hasClass && !hasMaterials ? 'Add your first lecture or notes to start studying.' : selectedCourse.dashboard.recommendation.kind === 'practice' ? 'Try recalling the answer before you check it.' : focus.reason;
  const actionColor = colors.primaryText;

  const courseCard = (group: LearningMasteryGroup, pageWidth?: number) => {
    const course = state.classes.find(item => 'class:' + item.id === group.id);
    const packs = dashboard.decks.filter(deck => group.packs.some(pack => pack.id === deck.id));
    const materialCount = packs.reduce((sum, pack) => sum + (pack.sourceFileNames?.length ? new Set(pack.sourceFileNames).size : 1), 0);
    const active = group.id === selected.id;
    const stacked = fontScale > 1.4 || (compact && group.name.length > 28);
    const icon = <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><SubjectIcon subject={group.name} emoji={course?.emoji ?? packs[0]?.emoji} size={compact ? 36 : 40} animated={false} /></View>;
    const name = <Text accessibilityRole="header" style={[styles.courseName, { color: colors.text }]}>{group.name}</Text>;
    const details = <>
      <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{materialCount} {materialCount === 1 ? 'material' : 'materials'}{group.mastery === null ? ' · Not assessed yet' : ''}</Text>
      {group.mastery !== null ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{group.supportedTopics} of {group.topicCount} {group.topicCount === 1 ? 'topic' : 'topics'} recalled consistently</Text> : null}
    </>;
    const score = <View style={styles.courseScore}><PlanReadinessRing value={group.mastery} colors={colors} still={reducedMotion || !active} /><Text aria-hidden accessible={false} style={[styles.scoreCaption, { color: colors.textSecondary }]}>Knowledge</Text></View>;
    return <View style={{ width: pageWidth, paddingHorizontal: 1 }}>
      <PlanClassSurface active={active} still={reducedMotion}>
        <View aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'} style={[styles.courseCard, { backgroundColor: active ? colors.primarySoft : colors.cardStrong, borderColor: active ? colors.mode === 'dark' ? '#8F7C43' : '#E1C46F' : colors.border }, compact && styles.courseCompact, stacked && styles.courseStacked]}>
          {stacked ? <>
            <View style={styles.courseHeading}>{icon}<View style={styles.flex}>{name}</View></View>
            <View style={[styles.courseMetrics, fontScale > 1.4 && styles.courseMetricsStacked]}><View style={styles.courseCopy}>{details}</View>{score}</View>
          </> : <>{icon}<View style={styles.courseCopy}>{name}{details}</View>{score}</>}
        </View>
      </PlanClassSurface>
    </View>;
  };

  return <Animated.View onLayout={event => setCardWidth(event.nativeEvent.layout.width)} style={[styles.card, { shadowColor: colors.shadow, opacity: arrival.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }), transform: reducedMotion ? [] : [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
    <LinearGradient colors={colors.mode === 'dark' ? ['#456B9D', '#786A3F', '#314561'] : ['#92B9F1', '#EEDA9A', '#B4CFF5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}>
      <View style={[styles.surface, { backgroundColor: colors.card }]}>
        <LinearGradient pointerEvents="none" colors={[colors.primarySoft, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.wash} />
        <View style={styles.heading}>
          <PlanBook colors={colors} still={reducedMotion} compact={compact} />
          <View style={styles.headingCopy}><Text accessibilityRole="header" style={[styles.sectionTitle, compact && { fontSize: 16, lineHeight: 22 }, { color: colors.text }]}>Today’s Plan</Text>{!compact ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Small steps. Stronger recall.</Text> : null}</View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open study planner" onPress={onOpenPlan} onFocus={() => setFocused('planner')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.plannerLink, { backgroundColor: colors.card, borderColor: focused === 'planner' ? blue : colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.linkText, { color: blue }]}>Planner</Text><PlanIcon name="chevron-right" color={blue} size={16} /></Pressable>
        </View>
        {!hydrated ? <View accessibilityState={{ busy: true }} style={styles.loading}><LoadingArtwork compact colors={colors} /><Text style={[styles.smallCopy, { color: colors.textSecondary }]}>Loading your plan…</Text></View> : <>
          {hasClass ? <View style={styles.selector} onLayout={event => setSelectorWidth(event.nativeEvent.layout.width)}>
            {groups.length > 1 && selectorWidth > 0 ? <FlatList
              ref={list} data={groups} keyExtractor={group => group.id} horizontal pagingEnabled directionalLockEnabled
              scrollEnabled={!opening} decelerationRate="fast" showsHorizontalScrollIndicator={false}
              initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3} extraData={selected.id}
              getItemLayout={(_, index) => ({ length: selectorWidth, offset: selectorWidth * index, index })}
              onScroll={event => select(Math.max(0, Math.min(groups.length - 1, Math.round(event.nativeEvent.contentOffset.x / selectorWidth))))}
              onMomentumScrollEnd={() => AccessibilityInfo.announceForAccessibility('Selected ' + (groups.find(group => group.id === selectedRef.current)?.name ?? 'class'))}
              scrollEventThrottle={32} renderItem={({ item }) => courseCard(item, selectorWidth)}
            /> : courseCard(selected)}
            {groups.length > 1 ? <View style={styles.selectorControls}>
              <View style={[styles.selectorPosition, styles.flex]}><View aria-hidden accessible={false} style={[styles.selectedMarker, { backgroundColor: colors.goldBright }]} /><Text style={[styles.smallCopy, styles.flex, { color: colors.textSecondary }]}>{selectedIndex + 1} of {groups.length} · Swipe classes</Text></View>
              {(['left', 'right'] as const).map(direction => {
                const disabled = opening || (direction === 'left' ? selectedIndex === 0 : selectedIndex === groups.length - 1);
                return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction === 'left' ? 'Previous plan class' : 'Next plan class'} disabled={disabled} accessibilityState={{ disabled }} onPress={() => navigateClass(selectedIndex + (direction === 'left' ? -1 : 1))} onFocus={() => setFocused(direction)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.classArrow, { backgroundColor: pressed ? colors.primarySoft : 'transparent', borderColor: focused === direction ? blue : 'transparent', opacity: disabled ? 0.4 : 1 }]}><PlanIcon name={direction === 'left' ? 'chevron-left' : 'chevron-right'} color={blue} size={20} /></Pressable>;
              })}
            </View> : null}
          </View> : null}
          <Animated.View style={{ opacity: content.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: reducedMotion ? [] : [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [2, 0] }) }] }}>
            <View style={styles.taskLabel}><PlanIcon name={hasClass ? 'compass-outline' : 'lightning-bolt-outline'} color={blue} size={16} /><Text style={[styles.eyebrow, { color: blue }]}>{!hasMaterials ? 'YOUR FIRST STEP' : status.complete ? 'OPTIONAL NEXT STEP' : 'YOUR NEXT STEP'}</Text></View>
            <Text accessibilityRole="header" style={[styles.taskTitle, { color: colors.text }]}>{taskTitle}</Text>
            {focus.source ? <Text style={[styles.source, { color: colors.textSecondary }]}>{selectedCourse.dashboard.decks.find(deck => deck.id === selectedCourse.dashboard.recommendation.deckId)?.title ?? focus.source}{focus.actionDetail ? ' · ' + focus.actionDetail : ''}</Text> : null}
            <Text style={[styles.reason, { color: colors.textSecondary }]}>{reason}</Text>
            {focus.examLabel || (!focus.source && focus.actionDetail) ? <View style={styles.taskDetails}>
              {focus.examLabel ? <View style={[styles.examTag, { backgroundColor: colors.goldSoft }]}><PlanIcon name="calendar-outline" color={colors.goldText} size={14} /><Text style={[styles.smallCopy, { color: colors.goldText }]}>{focus.examLabel}</Text></View> : null}
              {!focus.source && focus.actionDetail ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{focus.actionDetail}</Text> : null}
            </View> : null}
            <Animated.View style={{ marginTop: 14, transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }] }}>
              <Pressable accessibilityRole="button" accessibilityLabel={opening ? 'Opening your next step' : focus.actionLabel} accessibilityHint={reason} accessibilityState={{ busy: opening, disabled: opening }} disabled={opening} onPress={() => { void start(startSelected); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} onFocus={() => setFocused('action')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.action, { backgroundColor: colors.primary, borderColor: focused === 'action' ? colors.text : 'transparent', opacity: opening || pressed ? 0.8 : 1 }]}>
                {opening ? <LoadingArtwork compact colors={{ ...colors, primary: actionColor }} /> : <PlanIcon name={!hasMaterials ? 'plus' : focus.medium === 'pack' ? 'file-document-outline' : focus.medium === 'notes' ? 'book-open-page-variant-outline' : 'play'} color={actionColor} />}
                <Text style={[styles.actionText, { color: actionColor }]}>{opening ? 'Opening…' : focus.actionLabel}</Text><PlanIcon name="arrow-right" color={actionColor} size={18} />
              </Pressable>
            </Animated.View>
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            {selectedCourse.tasks.length ? <View style={styles.tasks}>{selectedCourse.tasks.map(task => <Pressable key={task.tool} accessibilityRole="button" accessibilityLabel={task.title + ' · ' + task.detail} disabled={opening} accessibilityState={{ disabled: opening }} onPress={() => { void start(() => {
              const deck = state.decks.find(item => item.id === task.deckId && selected.packs.some(pack => pack.id === item.id));
              if (!deck || !planToolReady(deck, task.tool)) throw new Error('Study material is no longer ready');
              onOpenDeck(deck, task.tool);
            }); }} onFocus={() => setFocused(task.tool)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.taskRow, compact && styles.taskRowCompact, { borderColor: focused === task.tool ? blue : colors.border, backgroundColor: pressed ? colors.primarySoft : colors.card, opacity: opening ? 0.65 : 1, transform: [{ scale: pressed && !reducedMotion ? 0.985 : 1 }] }]}>
              <View style={[styles.taskIcon, { backgroundColor: task.tool === 'quiz' ? colors.goldSoft : colors.primarySoft }]}><PlanIcon name={task.tool === 'quiz' ? 'clipboard-check-outline' : task.tool === 'notes' ? 'note-text-outline' : 'cards-outline'} color={task.tool === 'quiz' ? colors.goldText : blue} size={18} /></View>
              <View style={styles.flex}><Text style={[styles.taskRowTitle, { color: colors.text }]}>{task.title}</Text><Text style={[styles.taskRowDetail, { color: colors.textSecondary }]}>{task.detail}</Text></View>{compact ? <PlanIcon name="chevron-right" color={blue} size={16} /> : null}
            </Pressable>)}</View> : null}
          </Animated.View>
          {dashboard.decks.length ? <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: optionsExpanded }} aria-expanded={optionsExpanded} accessibilityLabel={optionsExpanded ? 'Hide study priority details' : 'Show study priority details'} onPress={() => setOptionsExpanded(value => !value)} onFocus={() => setFocused('priorities')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.optionsToggle, { borderBottomColor: colors.border, borderColor: focused === 'priorities' ? blue : 'transparent', backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}><Text style={[styles.linkText, { color: blue }]}>Study priorities</Text><Text style={[styles.optionsSummary, { color: colors.textSecondary }]}>{groups.length > 1 ? 'All classes · ' : ''}{dashboard.dueCount} due · {dashboard.weak.length} weak</Text><PlanIcon name={optionsExpanded ? 'chevron-up' : 'chevron-down'} color={blue} size={16} /></Pressable>
            {optionsExpanded ? <View>
              <View style={styles.tip}><PlanIcon name="lightbulb-on-outline" size={16} color={colors.goldText} /><Text style={[styles.tipText, { color: colors.textSecondary }]}>{focus.tip}</Text></View>
              {priorities.map(priority => <Pressable key={priority.kind} accessibilityRole="button" accessibilityLabel={priority.value + ' ' + priority.label} accessibilityHint={priority.detail + '. View study options for all classes.'} onPress={() => onOpenPriority(priority.kind)} onFocus={() => setFocused(priority.kind)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.priority, { borderColor: focused === priority.kind ? blue : 'transparent', backgroundColor: focused === priority.kind ? colors.primarySoft : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
                <PlanIcon name={priority.icon} color={colors.textSecondary} size={17} /><Text style={[styles.priorityValue, { color: colors.text }]}>{priority.value > 0 ? priority.value.toLocaleString() : '—'}</Text><Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>{priority.label}</Text><Text style={[styles.priorityHint, { color: colors.textSecondary }]}>{priority.value > 0 ? 'View details' : priority.empty}</Text><PlanIcon name="chevron-right" color={blue} size={15} />
              </Pressable>)}
            </View> : null}
            {status.hasActivity || dashboard.today.planTotal > 0 ? <Animated.View accessibilityLiveRegion="polite" style={[styles.status, { backgroundColor: status.complete ? colors.mintSoft : colors.cardStrong, opacity: acknowledgment.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: reducedMotion ? [] : [{ scale: acknowledgment.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.98, 1.01, 1] }) }] }]}>
              <PlanIcon name={status.complete || status.hasActivity ? 'check-circle-outline' : 'sprout-outline'} color={status.complete || status.hasActivity ? green : blue} size={18} />
              <View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.text }]}>{status.title}{groups.length > 1 && dashboard.today.planTotal > 0 ? ' · All classes' : ''}</Text><Text style={[styles.statusDetail, { color: colors.textSecondary }]}>{status.detail}</Text></View>
              {dashboard.today.planTotal > 0 ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Today's study plan tasks marked complete" accessibilityValue={{ min: 0, max: dashboard.today.planTotal, now: dashboard.today.planCompleted, text: status.detail }} style={[styles.completionTrack, { backgroundColor: colors.border }]}><View style={{ height: '100%', width: `${dashboard.today.planCompleted / dashboard.today.planTotal * 100}%`, backgroundColor: green, borderRadius: 3 }} /></View> : null}
            </Animated.View> : null}
          </> : null}
        </>}
      </View>
    </LinearGradient>
    <PlanBorderHighlight width={cardWidth} still={reducedMotion} selection={selected.id} colors={colors} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.055, shadowRadius: 16, elevation: 2 },
  frame: { padding: 1, borderRadius: 24 },
  surface: { padding: 16, borderRadius: 23, overflow: 'hidden' },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 145, opacity: 0.55 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  headingCopy: { flex: 1, flexBasis: 0, minWidth: 88 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', letterSpacing: -0.25 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  plannerLink: { minHeight: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 1 },
  linkText: { fontSize: 12, lineHeight: 19, fontWeight: '600' },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  selector: { marginTop: 16 },
  courseCard: { borderRadius: 17, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 90 },
  courseCompact: { padding: 10, gap: 8 },
  courseStacked: { flexDirection: 'column', alignItems: 'stretch' },
  courseHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseMetrics: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courseMetricsStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  courseScore: { alignItems: 'center', gap: 1, flexShrink: 0 },
  scoreCaption: { fontSize: 11, lineHeight: 17, fontWeight: '600' },
  courseCopy: { flex: 1, minWidth: 0 },
  courseName: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  smallCopy: { fontSize: 12, lineHeight: 18 },
  selectorControls: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  selectorPosition: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectedMarker: { width: 5, height: 5, borderRadius: 3 },
  classArrow: { width: 44, height: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  taskLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 0.8, fontWeight: '700', flexShrink: 1 },
  taskTitle: { fontSize: 22, lineHeight: 29, fontWeight: '700', letterSpacing: -0.4, marginTop: 6 },
  source: { fontSize: 12, lineHeight: 19, fontWeight: '600', marginTop: 4 },
  reason: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  taskDetails: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 9 },
  examTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8 },
  action: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 2 },
  actionText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  tasks: { gap: 7, marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' },
  taskRow: { minHeight: 62, borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, flexBasis: 140, flexGrow: 1 },
  taskRowCompact: { flexBasis: '100%' },
  taskRowDetail: { fontSize: 12, lineHeight: 18, marginTop: 1 },
  taskIcon: { width: 30, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  taskRowTitle: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  error: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  optionsToggle: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 7, marginTop: 7, paddingVertical: 6, paddingHorizontal: 2 },
  optionsSummary: { fontSize: 11, lineHeight: 18, marginLeft: 'auto', flexShrink: 1 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10, marginBottom: 5 },
  tipText: { flex: 1, fontSize: 12, lineHeight: 19 },
  priority: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, minHeight: 44, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
  priorityValue: { fontSize: 15, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priorityLabel: { fontSize: 12, lineHeight: 18 },
  priorityHint: { fontSize: 11, lineHeight: 17, marginLeft: 'auto' },
  status: { marginTop: 8, padding: 10, borderRadius: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  statusCopy: { flex: 1, minWidth: 150 },
  statusTitle: { fontSize: 12, lineHeight: 19, fontWeight: '600' },
  statusDetail: { fontSize: 11, lineHeight: 18, marginTop: 2 },
  completionTrack: { height: 4, width: '100%', borderRadius: 3, overflow: 'hidden' },
});
