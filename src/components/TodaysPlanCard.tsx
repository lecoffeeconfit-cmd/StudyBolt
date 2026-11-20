import { LoadingArtwork } from './StudyBoltLoading';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StudyPack, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import type { HomeDashboard } from '../services/homeDashboard';
import { buildLearningMastery } from '../services/learningMastery';
import { buildStudyMaterialHistory } from '../services/studyMaterialHistory';
import { getTodaysPlanFocus, getTodaysPlanStatus } from '../services/todaysPlan';
import type { AppColors } from '../theme';
import { SubjectIcon } from './SubjectIcon';
import { PlanBook, PlanReadinessRing } from './TodaysPlanArtwork';
import { StudyMaterialHistorySheet } from './StudyMaterialHistorySheet';
import { todaysPlanCourse, type TodaysPlanAction, type TodaysPlanCourse } from './todaysPlanPresentation';
import type { ImportClass } from '../hooks/useStudyMaterialPicker';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = {
  dashboard: HomeDashboard;
  colors: AppColors;
  now: Date;
  selectedId?: string;
  onSelectClass: (id: string) => void;
  onOpenPriority: (kind: HomePriority) => void;
  onOpenPlan: () => void;
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onStartStudy: (mode: SmartStudyMode, focus?: { deckId: string; sectionIds?: string[] }) => void;
  onOpenMistakes: (itemIds?: string[]) => void;
  onShowUpload: (course?: ImportClass) => void;
};
type PlanIconName = keyof typeof MaterialCommunityIcons.glyphMap;
function PlanIcon({ name, color, size = 20 }: { name: PlanIconName; color: string; size?: number }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><MaterialCommunityIcons name={name} color={color} size={size} accessible={false} /></View>;
}

const actionIcons = {
  notes: 'note-text-outline', flashcards: 'cards-outline', quiz: 'clipboard-check-outline',
} as const;

export function TodaysPlanCard({ dashboard, now, colors, selectedId, onSelectClass, onOpenPriority, onOpenPlan, onOpenDeck, onStartStudy, onOpenMistakes, onShowUpload }: Props) {
  const { state, hydrated } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const history = useMemo(() => buildStudyMaterialHistory(state.decks, state.classes), [state.decks, state.classes]);
  const pages = useMemo(() => buildLearningMastery(state, now).map(group => ({
    group,
    course: state.classes.find(item => `class:${item.id}` === group.id),
    plan: todaysPlanCourse(state, group, now),
  })), [state, now]);
  const recommendedDeckId = dashboard.recommendation.deckId
    ?? dashboard.decks.find(deck => dashboard.mistakeIds.some(id => id.startsWith(deck.id + ':')))?.id;
  const preferredIndex = pages.findIndex(({ group }) => group.packs.some(pack => pack.id === recommendedDeckId));
  const savedIndex = pages.findIndex(({ group }) => group.id === selectedId);
  const selectedIndex = savedIndex < 0 ? Math.max(0, preferredIndex) : savedIndex;
  const selected = pages[selectedIndex]!;
  const hasClass = selected.group.kind === 'class' || selected.group.packs.length > 0;
  const [cardWidth, setCardWidth] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const [classesExpanded, setClassesExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const list = useRef<ScrollView>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const visibleId = useRef(selected.group.id);
  const alignedIndex = useRef(selectedIndex);
  const aligning = useRef(false);
  const arrival = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;
  const acknowledgment = useRef(new Animated.Value(1)).current;
  const classReveal = useRef(new Animated.Value(1)).current;
  const status = getTodaysPlanStatus(dashboard);
  const compact = (cardWidth || width - 40) < 340 || fontScale >= 1.3;
  const blue = colors.mode === 'dark' ? colors.primary : '#075BC6';
  const green = colors.mode === 'dark' ? colors.mint : '#187D68';
  const pageIds = pages.map(({ group }) => group.id).join('|');

  useEffect(() => {
    if (!classesExpanded || !pageWidth || pages.length < 2) return;
    aligning.current = true;
    const frame = requestAnimationFrame(() => {
      list.current?.scrollTo({ x: alignedIndex.current * pageWidth, animated: false });
      aligning.current = false;
    });
    return () => { cancelAnimationFrame(frame); aligning.current = false; };
  }, [classesExpanded, pageIds, pageWidth, pages.length]);

  useEffect(() => {
    if (!classesExpanded || reducedMotion) {
      classReveal.setValue(1);
      return;
    }
    const animation = Animated.timing(classReveal, {
      toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [classesExpanded, classReveal, reducedMotion]);

  useEffect(() => {
    visibleId.current = selected.group.id;
    alignedIndex.current = selectedIndex;
  }, [selected.group.id, selectedIndex]);

  useEffect(() => {
    if (hydrated && hasClass && savedIndex < 0) onSelectClass(selected.group.id);
  }, [hasClass, hydrated, onSelectClass, savedIndex, selected.group.id]);

  useEffect(() => {
    mounted.current = true;
    arrival.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(arrival, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!reducedMotion) animation.start();
    return () => { mounted.current = false; animation.stop(); press.stopAnimation(); press.setValue(0); };
  }, [arrival, reducedMotion, press, hasClass]);

  useEffect(() => {
    acknowledgment.setValue(1);
    if (reducedMotion || (!status.complete && !status.hasActivity)) return;
    acknowledgment.setValue(0);
    const animation = Animated.timing(acknowledgment, { toValue: 1, duration: 280, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [acknowledgment, reducedMotion, status.complete, status.hasActivity, dashboard.today.latestAt]);

  const select = (index: number) => {
    const group = pages[index]?.group;
    if (!group || inFlight.current || visibleId.current === group.id) return;
    visibleId.current = group.id;
    alignedIndex.current = index;
    onSelectClass(group.id);
    setError(null);
  };
  const navigateClass = (index: number) => {
    const group = pages[index]?.group;
    if (!group || !pageWidth || inFlight.current) return;
    if (reducedMotion) select(index);
    list.current?.scrollTo({ x: index * pageWidth, animated: !reducedMotion });
    AccessibilityInfo.announceForAccessibility(`${group.name}, ${index + 1} of ${pages.length}`);
  };
  const animatePress = (down: boolean) => {
    if (reducedMotion) return;
    press.stopAnimation();
    Animated.timing(press, { toValue: down ? 1 : 0, duration: 110, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const start = async (action: TodaysPlanAction, course?: ImportClass) => {
    if (inFlight.current) return;
    if (action.kind === 'materials') {
      onShowUpload(course);
      return;
    }
    inFlight.current = true;
    setOpening(true);
    setError(null);
    try {
      switch (action.kind) {
        case 'mistakes': onOpenMistakes(action.itemIds); break;
        case 'smart': onStartStudy('smart', { deckId: action.deck.id, sectionIds: action.sectionId ? [action.sectionId] : undefined }); break;
        case 'deck': onOpenDeck(action.deck, action.tool, action.cardIds); break;
      }
    } catch {
      if (mounted.current) setError('Couldn’t open this step. Please try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setOpening(false);
    }
  };
  const priorities = [
    { kind: 'weak' as const, value: dashboard.weak.length, label: 'Weak topics', empty: 'None identified', detail: 'Based on repeated quiz answers', icon: 'lightning-bolt-outline' as const },
    { kind: 'due' as const, value: dashboard.dueCount, label: 'Due reviews', empty: 'Nothing due', detail: 'Recorded reviews scheduled for now', icon: 'cards-outline' as const },
    { kind: 'mistakes' as const, value: dashboard.mistakeIds.length, label: 'Missed questions', empty: 'Nothing repeated', detail: 'Repeated misses not yet corrected', icon: 'book-alert-outline' as const },
  ];
  const renderStep = (plan: TodaysPlanCourse, active: boolean, course?: ImportClass) => {
    const { primary, tasks, examLabel } = plan;
    const action = primary.action;
    const empty = action.kind === 'materials';
    const pack = action.kind === 'deck' && !action.tool;
    const audio = action.kind === 'deck' && action.tool === 'audio';
    const label = empty ? 'Go to upload' : pack ? 'View Study Pack' : audio ? 'Resume StudyCast'
      : action.kind === 'mistakes' ? 'Review mistakes' : action.kind === 'smart' ? 'Start practice'
      : action.tool === 'notes' ? 'Open notes' : action.tool === 'quiz' ? 'Start quiz' : 'Start flashcards';
    const actionColor = empty ? blue : colors.primaryText;
    const reason = empty && course ? 'Add your first lecture or notes to start studying.' : primary.reason;
    const title = empty && course ? 'Add your first study material' : primary.title;
    const disabled = opening || !active;
    return <>
      <View style={styles.taskLabel}><PlanIcon name={empty ? 'lightning-bolt-outline' : 'compass-outline'} color={blue} size={16} /><Text style={[styles.eyebrow, { color: blue }]}>{empty ? 'YOUR FIRST STEP' : 'YOUR NEXT STEP'}</Text></View>
      <Text accessibilityRole="header" style={[styles.taskTitle, { color: colors.text }]}>{title}</Text>
      {'deck' in action ? <Text style={[styles.source, { color: colors.textSecondary }]}>{action.deck.title}</Text> : null}
      <Text style={[styles.reason, { color: colors.textSecondary }]}>{reason}</Text>
      {examLabel ? <View style={styles.taskDetails}><View style={[styles.examTag, { backgroundColor: colors.goldSoft }]}><PlanIcon name="calendar-outline" color={colors.goldText} size={14} /><Text style={[styles.smallCopy, { color: colors.goldText }]}>{examLabel}</Text></View></View> : null}
      {tasks.length ? <View style={styles.tasks}>{tasks.map(task => {
        const tool = task.action.kind === 'deck' ? task.action.tool : 'mistakes';
        return <Pressable key={tool} accessibilityRole="button" accessibilityLabel={task.title + ('deck' in task.action ? ' · ' + task.action.deck.title : '')} disabled={disabled} accessibilityState={{ disabled }} onPress={() => { void start(task.action); }} onFocus={() => setFocused(tool)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.taskRow, { borderColor: focused === tool ? blue : 'transparent', backgroundColor: pressed ? colors.primarySoft : 'transparent', opacity: opening ? 0.65 : 1 }]}>
          <PlanIcon name={tool === 'mistakes' ? 'book-alert-outline' : actionIcons[tool]} color={blue} size={17} />
          <Text style={[styles.taskRowTitle, styles.flex, { color: colors.text }]}>{task.title}</Text>
          <PlanIcon name="chevron-right" color={blue} size={16} />
        </Pressable>;
      })}</View> : null}
      <Animated.View style={{ marginTop: 14, transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={opening && active ? 'Opening your next step' : label} accessibilityHint={empty ? 'Moves to Choose Files on Home.' : audio || pack ? reason : primary.title} accessibilityState={{ busy: opening && active, disabled }} disabled={disabled} onPress={() => { void start(action, course); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} onFocus={() => setFocused('action')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.action, { backgroundColor: empty ? colors.primarySoft : colors.primary, borderColor: focused === 'action' && active ? actionColor : empty ? colors.border : 'transparent', opacity: (opening && active) || pressed ? 0.8 : 1 }]}>
          {opening && active && !reducedMotion ? <LoadingArtwork compact colors={{ ...colors, primary: actionColor }} /> : <PlanIcon name={empty || pack ? 'file-document-outline' : 'play'} color={actionColor} />}
          <Text style={[styles.actionText, { color: actionColor }]}>{opening && active ? 'Opening…' : label}</Text><PlanIcon name={empty ? 'arrow-down' : 'arrow-right'} color={actionColor} size={18} />
        </Pressable>
      </Animated.View>
      {active && error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </>;
  };

  const renderPage = ({ group, course, plan }: typeof selected, index: number, measure: boolean) => {
    const active = index === selectedIndex;
    const color = course?.color ?? plan.decks[0]?.color ?? colors.primary;
    const { materialCount } = plan;
    return <View
      key={group.id}
      aria-hidden={!active}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      onLayout={measure ? event => {
        const height = Math.ceil(event.nativeEvent.layout.height);
        setHeights(current => current[group.id] === height ? current : { ...current, [group.id]: height });
      } : undefined}
      style={measure ? { width: pageWidth } : undefined}
    >
      <View style={[styles.courseCard, { backgroundColor: colors.cardStrong, borderColor: colors.border }, compact && styles.courseCompact]}>
        <View style={styles.courseHeading}>
          <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SubjectIcon subject={group.name} emoji={course?.emoji ?? plan.decks[0]?.emoji} size={compact ? 34 : 40} animated={false} />
          </View>
          <View style={styles.flex}>
            <View style={styles.courseIdentity}><View aria-hidden style={[styles.classDot, { backgroundColor: color }]} /><Text accessibilityRole="header" style={[styles.courseName, styles.flex, { color: colors.text }]}>{group.name}</Text></View>
            <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{materialCount} {materialCount === 1 ? 'material' : 'materials'}</Text>
          </View>
        </View>
        {materialCount > 0 ? <View style={[styles.courseMetrics, fontScale >= 1.45 && styles.courseMetricsStacked]}>
          <View style={styles.courseCopy}>
            <Text style={[styles.smallCopy, { color: colors.text, fontWeight: '600' }]}>Knowledge readiness</Text>
            <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>
              {group.mastery !== null ? `${group.supportedTopics} of ${group.topicCount} topics recalled consistently` : 'Not assessed yet'}
            </Text>
            {group.practicedPacks > 0 ? <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>
              {group.quizAccuracy !== null ? `${group.quizAccuracy}% first-answer quiz accuracy` : `${group.practicedPacks} of ${group.packs.length} packs practiced`}
            </Text> : null}
          </View>
          {group.mastery !== null ? <PlanReadinessRing value={group.mastery} colors={colors} accent={color} still={reducedMotion || !active} /> : null}
        </View> : null}
      </View>
      {renderStep(plan, active, course)}
    </View>;
  };

  const visibleDotsStart = Math.max(0, Math.min(selectedIndex - 2, pages.length - 5));
  const overview = [
    { label: history.classCount === 1 ? 'Class' : 'Classes', value: history.classCount, icon: 'bookshelf', tint: colors.primarySoft, tone: blue },
    { label: history.materialCount === 1 ? 'Material' : 'Materials', value: history.materialCount, icon: 'file-document-multiple-outline', tint: colors.goldSoft, tone: colors.goldText },
    { label: 'Reviews due', value: dashboard.dueCount, icon: 'cards-outline', tint: colors.mintSoft, tone: green },
  ] as const;
  const toggleClasses = () => {
    if (!classesExpanded && !reducedMotion) classReveal.setValue(0);
    setClassesExpanded(!classesExpanded);
  };

  return <Animated.View onLayout={event => setCardWidth(event.nativeEvent.layout.width)} style={[styles.card, { shadowColor: colors.shadow, opacity: arrival.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }), transform: reducedMotion ? [] : [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>
    <LinearGradient
      colors={colors.neon
        ? [colors.neon.edge, colors.border, colors.neon.edge]
        : colors.mode === 'dark' ? ['#698BB5', '#8B764B', '#526A88'] : ['#8FB6E9', '#E7C46F', '#B6D2F3']}
      locations={[0, 0.56, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.frame}
    >
      <View style={[styles.surface, { backgroundColor: colors.card }]}>
        <LinearGradient pointerEvents="none" colors={[colors.primarySoft, colors.card]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.wash} />
        <View style={styles.welcomeTop}>
          <View style={[styles.checkInBadge, { backgroundColor: colors.goldSoft }]}>
            <PlanIcon name="calendar-check-outline" color={colors.goldText} size={15} />
            <Text style={[styles.linkText, { color: colors.goldText }]}>Daily check-in</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open study planner" onPress={onOpenPlan} onFocus={() => setFocused('planner')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.plannerLink, { backgroundColor: colors.card, borderColor: focused === 'planner' ? blue : colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.linkText, { color: blue }]}>Planner</Text><PlanIcon name="chevron-right" color={blue} size={16} /></Pressable>
        </View>
        <View style={styles.heading}>
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Today’s Plan</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>See what’s ready to study and choose your next step.</Text>
          </View>
          <PlanBook colors={colors} still={reducedMotion} compact={compact} />
        </View>
        {!hydrated ? <View accessibilityState={{ busy: true }} style={styles.loading}>{!reducedMotion ? <LoadingArtwork compact colors={colors} /> : null}<Text style={[styles.smallCopy, { color: colors.textSecondary }]}>Loading your plan…</Text></View> : <>
          <View style={styles.overview}>
            {overview.map(metric => <View key={metric.icon} accessible accessibilityLabel={`${metric.value.toLocaleString()} ${metric.label}`} style={[
              styles.metric, fontScale >= 1.4 && styles.metricLarge, { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
              <View style={[styles.metricIcon, { backgroundColor: metric.tint }]}><PlanIcon name={metric.icon} color={metric.tone} size={16} /></View>
              <Text style={[styles.metricValue, { color: colors.text }]}>{metric.value.toLocaleString()}</Text>
              <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>{metric.label}</Text>
            </View>)}
          </View>
          {hasClass ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: classesExpanded }} onPress={toggleClasses}
            onFocus={() => setFocused('classes')} onBlur={() => setFocused(null)}
            style={({ pressed }) => [styles.action, styles.classAction, { backgroundColor: colors.primary, borderColor: focused === 'classes' ? colors.text : 'transparent', opacity: pressed ? 0.8 : 1 }]}
          >
            <PlanIcon name="book-open-page-variant-outline" color={colors.primaryText} />
            <Text style={[styles.actionText, { color: colors.primaryText }]}>{classesExpanded ? 'Hide class plan' : 'Study by class'}</Text>
            <PlanIcon name={classesExpanded ? 'chevron-up' : 'chevron-down'} color={colors.primaryText} />
          </Pressable> : renderStep(selected.plan, true)}
          {hasClass && classesExpanded ? <Animated.View
            style={[styles.selector, { opacity: reducedMotion ? 1 : classReveal }]}
            onLayout={event => setPageWidth(event.nativeEvent.layout.width)}
          >
            {pages.length > 1 && pageWidth > 0 ? <>
              <View style={styles.pagination}>
                <Text style={[styles.smallCopy, styles.flex, { color: colors.textSecondary }]}>{selectedIndex + 1} of {pages.length} · Swipe classes</Text>
                <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
                  {pages.slice(visibleDotsStart, visibleDotsStart + 5).map(({ group }, index) => {
                    const active = index + visibleDotsStart === selectedIndex;
                    return <View key={group.id} style={[styles.dot, { backgroundColor: active ? blue : colors.border }, active && styles.activeDot]} />;
                  })}
                </View>
                {([-1, 1] as const).map(direction => {
                  const disabled = opening || !pages[selectedIndex + direction];
                  const key = direction < 0 ? 'previous' : 'next';
                  return <Pressable key={key} accessibilityRole="button" accessibilityLabel={direction < 0 ? 'Previous class' : 'Next class'} disabled={disabled} accessibilityState={{ disabled }} onPress={() => navigateClass(selectedIndex + direction)} onFocus={() => setFocused(key)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.classArrow, { backgroundColor: pressed ? colors.primarySoft : 'transparent', borderColor: focused === key ? blue : 'transparent', opacity: disabled ? 0.35 : 1 }]}><PlanIcon name={direction < 0 ? 'chevron-left' : 'chevron-right'} color={blue} size={20} /></Pressable>;
                })}
              </View>
              <ScrollView
                ref={list}
                horizontal
                pagingEnabled
                directionalLockEnabled
                scrollEnabled={!opening}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                decelerationRate="fast"
                scrollEventThrottle={16}
                style={heights[selected.group.id] ? { height: heights[selected.group.id] } : undefined}
                contentContainerStyle={styles.pages}
                onScroll={event => {
                  if (aligning.current) return;
                  const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
                  select(Math.max(0, Math.min(index, pages.length - 1)));
                }}
              >
                {pages.map((page, index) => renderPage(page, index, true))}
              </ScrollView>
            </> : renderPage(selected, selectedIndex, false)}
          </Animated.View> : null}
          {history.semesters.length > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Class history" accessibilityHint="Browse saved study materials by semester." onPress={() => setHistoryOpen(true)}
            onFocus={() => setFocused('history')} onBlur={() => setFocused(null)} style={({ pressed }) => [
              styles.historyLink, { borderColor: focused === 'history' ? blue : colors.border, backgroundColor: pressed ? colors.primarySoft : colors.card },
            ]}>
            <View style={[styles.metricIcon, { backgroundColor: colors.primarySoft }]}><PlanIcon name="history" color={blue} size={18} /></View>
            <View style={styles.flex}>
              <Text style={[styles.taskRowTitle, { color: colors.text }]}>Class history</Text>
              <Text style={[styles.smallCopy, { color: colors.textSecondary }]}>Saved materials by semester</Text>
            </View>
            <PlanIcon name="chevron-right" color={blue} size={19} />
          </Pressable> : null}
          {dashboard.decks.length ? <>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: optionsExpanded }} aria-expanded={optionsExpanded} accessibilityLabel={optionsExpanded ? 'Hide study priority details' : 'Show study priority details'} onPress={() => setOptionsExpanded(value => !value)} onFocus={() => setFocused('priorities')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.optionsToggle, { borderBottomColor: colors.border, borderColor: focused === 'priorities' ? blue : 'transparent', backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}><Text style={[styles.linkText, { color: blue }]}>Study priorities</Text><Text style={[styles.optionsSummary, { color: colors.textSecondary }]}>{pages.length > 1 ? 'All classes · ' : ''}{dashboard.dueCount} due · {dashboard.weak.length} weak</Text><PlanIcon name={optionsExpanded ? 'chevron-up' : 'chevron-down'} color={blue} size={16} /></Pressable>
            {optionsExpanded ? <View>
              <View style={styles.tip}><PlanIcon name="lightbulb-on-outline" size={16} color={colors.goldText} /><Text style={[styles.tipText, { color: colors.textSecondary }]}>{getTodaysPlanFocus(dashboard).tip}</Text></View>
              {priorities.map(priority => <Pressable key={priority.kind} accessibilityRole="button" accessibilityLabel={priority.value + ' ' + priority.label} accessibilityHint={priority.detail + '. View study options for all classes.'} onPress={() => onOpenPriority(priority.kind)} onFocus={() => setFocused(priority.kind)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.priority, { borderColor: focused === priority.kind ? blue : 'transparent', backgroundColor: focused === priority.kind ? colors.primarySoft : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
                <PlanIcon name={priority.icon} color={colors.textSecondary} size={17} /><Text style={[styles.priorityValue, { color: colors.text }]}>{priority.value > 0 ? priority.value.toLocaleString() : '—'}</Text><Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>{priority.label}</Text><Text style={[styles.priorityHint, { color: colors.textSecondary }]}>{priority.value > 0 ? 'View details' : priority.empty}</Text><PlanIcon name="chevron-right" color={blue} size={15} />
              </Pressable>)}
            </View> : null}
            {status.hasActivity || dashboard.today.planTotal > 0 ? <Animated.View accessibilityLiveRegion="polite" style={[styles.status, { backgroundColor: status.complete ? colors.mintSoft : colors.cardStrong, opacity: acknowledgment.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: reducedMotion ? [] : [{ scale: acknowledgment.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.98, 1.01, 1] }) }] }]}>
              <PlanIcon name={status.complete || status.hasActivity ? 'check-circle-outline' : 'sprout-outline'} color={status.complete || status.hasActivity ? green : blue} size={18} />
              <View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.text }]}>{status.title}{pages.length > 1 && dashboard.today.planTotal > 0 ? ' · All classes' : ''}</Text><Text style={[styles.statusDetail, { color: colors.textSecondary }]}>{status.detail}</Text></View>
              {dashboard.today.planTotal > 0 ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Today's study plan tasks marked complete" accessibilityValue={{ min: 0, max: dashboard.today.planTotal, now: dashboard.today.planCompleted, text: status.detail }} style={[styles.completionTrack, { backgroundColor: colors.neon?.progressTrack ?? colors.border }]}><View style={{ height: '100%', width: `${dashboard.today.planCompleted / dashboard.today.planTotal * 100}%`, backgroundColor: green, borderRadius: 3 }} /></View> : null}
            </Animated.View> : null}
          </> : null}
        </>}
      </View>
    </LinearGradient>
    {historyOpen && history.semesters.length > 0 ? <StudyMaterialHistorySheet
      semesters={history.semesters} colors={colors} reducedMotion={reducedMotion}
      onClose={() => setHistoryOpen(false)}
      onOpenPack={deck => { setHistoryOpen(false); onOpenDeck(deck); }}
    /> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 2 },
  frame: { padding: 2, borderRadius: 26 },
  surface: { padding: 16, borderRadius: 24, overflow: 'hidden' },
  wash: { position: 'absolute', top: 0, left: 0, right: 0, height: 230, opacity: 0.8 },
  welcomeTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  checkInBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  sectionTitle: { fontSize: 26, lineHeight: 33, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 3 },
  overview: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  metric: { flexGrow: 1, flexBasis: 0, minWidth: 72, borderRadius: 13, borderWidth: 1, padding: 8, gap: 2, alignItems: 'flex-start' },
  metricLarge: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', gap: 9 },
  metricIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 20, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  classAction: { marginTop: 12 },
  historyLink: { marginTop: 10, minHeight: 52, borderRadius: 13, borderWidth: 1, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  plannerLink: { minHeight: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 1 },
  linkText: { fontSize: 12, lineHeight: 19, fontWeight: '600' },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  selector: { marginTop: 12 },
  courseCard: { borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  courseCompact: { padding: 10 },
  courseHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseIdentity: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  classDot: { width: 8, height: 8, borderRadius: 4 },
  courseMetrics: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseMetricsStacked: { flexWrap: 'wrap' },
  courseCopy: { flexGrow: 1, flexShrink: 1, minWidth: 110, gap: 2 },
  courseName: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  smallCopy: { fontSize: 12, lineHeight: 18 },
  pagination: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 4, marginBottom: 4 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  activeDot: { width: 11 },
  classArrow: { width: 44, height: 44, borderWidth: 1, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pages: { alignItems: 'flex-start' },
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
  tasks: { marginTop: 4 },
  taskRow: { minHeight: 44, paddingVertical: 6, paddingHorizontal: 4, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
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
