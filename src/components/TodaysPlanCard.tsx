import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { HomeDashboard } from '../services/homeDashboard';
import { getTodaysPlanFocus, getTodaysPlanStatus } from '../services/todaysPlan';
import type { AppColors } from '../theme';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = {
  dashboard: HomeDashboard;
  colors: AppColors;
  onStartSession: () => void | Promise<void>;
  onOpenPriority: (kind: HomePriority) => void;
  onOpenPlan: () => void;
};
type PlanIconName = keyof typeof MaterialCommunityIcons.glyphMap;
function PlanIcon({ name, color, size = 20 }: { name: PlanIconName; color: string; size?: number }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><MaterialCommunityIcons name={name} color={color} size={size} accessible={false} /></View>;
}

/** Local evidence and existing destinations only; no network or saved-state writes. */
export function TodaysPlanCard({ dashboard, colors, onStartSession, onOpenPriority, onOpenPlan }: Props) {
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(0);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [optionsExpanded, setOptionsExpanded] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const arrival = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;
  const acknowledgment = useRef(new Animated.Value(1)).current;
  const focus = getTodaysPlanFocus(dashboard);
  const status = getTodaysPlanStatus(dashboard);
  const hasMaterials = dashboard.decks.length > 0;
  const compact = (cardWidth || width - 40) < 360 || fontScale >= 1.3;
  const blue = colors.mode === 'dark' ? colors.primary : '#075BC6';
  const actionBackground = colors.mode === 'dark' ? colors.primary : '#1268D9';
  const green = colors.mode === 'dark' ? colors.mint : '#187D68';

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
    const animation = Animated.timing(acknowledgment, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [acknowledgment, reducedMotion, status.complete]);

  const animatePress = (down: boolean) => {
    press.stopAnimation();
    Animated.timing(press, { toValue: down && !reducedMotion ? 1 : 0, duration: reducedMotion ? 0 : 110, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    setError(null);
    try { await onStartSession(); }
    catch { if (mounted.current) setError('Couldn’t open this step. Please try again.'); }
    finally { inFlight.current = false; if (mounted.current) setOpening(false); }
  };
  const priorities = [
    { kind: 'weak' as const, value: dashboard.weak.length, label: 'Weak topics', empty: 'None identified', detail: 'Based on repeated quiz answers', icon: 'lightning-bolt-outline' as const },
    { kind: 'due' as const, value: dashboard.dueCount, label: 'Due reviews', empty: 'Nothing due', detail: 'Recorded reviews scheduled for now', icon: 'cards-outline' as const },
    { kind: 'mistakes' as const, value: dashboard.mistakeIds.length, label: 'Missed questions', empty: 'Nothing repeated', detail: 'Repeated misses not yet corrected', icon: 'book-alert-outline' as const },
  ];
  const taskIcon: PlanIconName = focus.medium === 'audio' ? 'headphones' : focus.medium === 'notes' ? 'book-open-page-variant-outline' : focus.medium === 'pack' ? 'file-document-outline' : focus.medium === 'materials' ? 'sprout-outline' : 'cards-outline';

  return (
    <Animated.View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, opacity: arrival, transform: reducedMotion ? [] : [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>
      <View style={styles.heading}>
        <View style={styles.headingLabel}><View style={[styles.calendar, { backgroundColor: colors.goldSoft }]}><PlanIcon name="calendar-check-outline" color={colors.goldText} size={18} /></View><Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>Today’s plan</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open study planner" onPress={onOpenPlan} onFocus={() => setFocused('planner')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.plannerLink, { backgroundColor: colors.cardStrong, borderColor: focused === 'planner' ? blue : 'transparent', opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.linkText, { color: blue }]}>Planner</Text><PlanIcon name="chevron-right" color={blue} size={17} /></Pressable>
      </View>

      <View style={[styles.taskLabel, { marginTop: hasMaterials ? 20 : 16 }]}>
        <PlanIcon name={taskIcon} color={blue} size={18} />
        <Text style={[styles.eyebrow, { color: blue }]}>{!hasMaterials ? 'YOUR FIRST STEP' : status.complete ? 'OPTIONAL NEXT STEP' : 'RECOMMENDED FOR YOU'}</Text>
      </View>
      <Text accessibilityRole="header" style={[styles.taskTitle, { color: colors.text }]}>{focus.title}</Text>
      {focus.source ? <Text style={[styles.source, { color: colors.textSecondary }]}>{focus.source}</Text> : null}
      <Text style={[styles.reason, { color: colors.textSecondary }]}>{focus.reason}</Text>
      {focus.examLabel || dashboard.recommendation.minutes !== null || focus.actionDetail ? <View style={styles.taskDetails}>
        {focus.examLabel ? <View style={[styles.examTag, { backgroundColor: colors.goldSoft }]}><PlanIcon name="calendar-outline" color={colors.goldText} size={15} /><Text style={[styles.detailText, { color: colors.goldText }]}>{focus.examLabel}</Text></View> : null}
        {dashboard.recommendation.minutes !== null ? <View style={styles.detail}><PlanIcon name="clock-outline" color={colors.textSecondary} size={16} /><Text style={[styles.detailText, { color: colors.textSecondary }]}>About {dashboard.recommendation.minutes} min</Text></View> : null}
        {focus.actionDetail ? <View style={styles.detail}><Text style={[styles.detailText, { color: colors.textSecondary }]}>{focus.actionDetail}</Text></View> : null}
      </View> : null}

      <Animated.View style={{ marginTop: 18, transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={opening ? 'Opening your next step' : focus.actionLabel} accessibilityHint={focus.reason} accessibilityState={{ busy: opening, disabled: opening }} disabled={opening} onPress={() => { void start(); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} onFocus={() => setFocused('action')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.action, !hasMaterials && styles.firstAction, { backgroundColor: hasMaterials ? actionBackground : colors.primarySoft, borderColor: focused === 'action' ? colors.text : 'transparent', opacity: opening || pressed ? 0.8 : 1 }]}>
          {opening ? <ActivityIndicator color={hasMaterials ? colors.primaryText : blue} /> : <PlanIcon name={focus.medium === 'materials' ? 'plus' : focus.medium === 'notes' ? 'book-open-page-variant-outline' : focus.medium === 'pack' ? 'file-document-outline' : 'play'} color={hasMaterials ? colors.primaryText : blue} />}
          <Text style={[styles.actionText, { color: hasMaterials ? colors.primaryText : blue }]}>{opening ? 'Opening…' : focus.actionLabel}</Text>
          <PlanIcon name="arrow-right" color={hasMaterials ? colors.primaryText : blue} />
        </Pressable>
      </Animated.View>
      {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {hasMaterials ? <>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: optionsExpanded }} accessibilityLabel={optionsExpanded ? 'Hide study priority details' : 'Show study priority details'} onPress={() => setOptionsExpanded((value) => !value)} style={[styles.optionsToggle, { borderBottomColor: colors.border }]}><Text style={[styles.linkText, { color: blue }]}>Study priorities</Text><Text style={[styles.optionsSummary, { color: colors.textSecondary }]}>{dashboard.dueCount} due · {dashboard.weak.length} weak {dashboard.weak.length === 1 ? 'topic' : 'topics'}</Text><PlanIcon name={optionsExpanded ? 'chevron-up' : 'chevron-down'} color={blue} size={18} /></Pressable>
        {optionsExpanded ? <>
        <View style={[styles.tip, { borderBottomColor: colors.border }]}><PlanIcon name="lightbulb-on-outline" size={16} color={colors.goldText} /><Text style={[styles.tipText, { color: colors.textSecondary }]}>{focus.tip}</Text></View>
        <View style={[styles.priorities, compact && styles.prioritiesStacked]}>
          {priorities.map((priority) => <Pressable key={priority.kind} accessibilityRole="button" accessibilityLabel={priority.value + ' ' + priority.label} accessibilityHint={priority.detail + '. View study options.'} onPress={() => onOpenPriority(priority.kind)} onFocus={() => setFocused(priority.kind)} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.priority, compact && styles.priorityStacked, { borderColor: focused === priority.kind ? blue : 'transparent', backgroundColor: focused === priority.kind ? colors.primarySoft : 'transparent', opacity: pressed ? 0.65 : 1 }]}>
            <View style={styles.priorityTitle}><PlanIcon name={priority.icon} color={colors.textSecondary} size={17} /><Text style={[styles.priorityValue, { color: colors.text }]}>{priority.value > 0 ? priority.value.toLocaleString() : '—'}</Text>{compact ? <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>{priority.label}</Text> : null}</View>
            {!compact ? <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>{priority.label}</Text> : null}
            <View style={[styles.priorityStatus, compact && { marginLeft: 'auto' }]}><Text style={[styles.priorityHint, { color: colors.textSecondary }]}>{priority.value > 0 ? 'View details' : priority.empty}</Text><PlanIcon name="chevron-right" color={blue} size={15} /></View>
          </Pressable>)}
        </View>
        </> : null}
      </> : null}
      {hasMaterials ? <Animated.View accessibilityLiveRegion="polite" style={[styles.status, { backgroundColor: status.complete ? colors.mintSoft : colors.cardStrong, opacity: acknowledgment }]}>
        <PlanIcon name={status.complete || status.hasActivity ? 'check-circle-outline' : 'sprout-outline'} color={status.complete || status.hasActivity ? green : blue} size={20} />
        <View style={styles.statusCopy}><Text style={[styles.statusTitle, { color: colors.text }]}>{status.title}</Text><Text style={[styles.statusDetail, { color: colors.textSecondary }]}>{status.detail}</Text></View>
        {dashboard.today.planTotal > 0 ? <View accessible accessibilityRole="progressbar" accessibilityLabel="Today's study plan tasks marked complete" accessibilityValue={{ min: 0, max: dashboard.today.planTotal, now: dashboard.today.planCompleted, text: status.detail }} style={[styles.completionTrack, { backgroundColor: colors.border }]}><View style={{ height: '100%', width: `${dashboard.today.planCompleted / dashboard.today.planTotal * 100}%`, backgroundColor: green, borderRadius: 3 }} /></View> : null}
      </Animated.View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 22, borderWidth: 1, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.035, shadowRadius: 14, elevation: 1 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingLabel: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  calendar: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  plannerLink: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkText: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  taskLabel: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  eyebrow: { fontSize: 11, lineHeight: 17, letterSpacing: 0.65, fontWeight: '700', flexShrink: 1 },
  taskTitle: { fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: -0.55, marginTop: 8 },
  source: { fontSize: 14, lineHeight: 21, fontWeight: '600', marginTop: 7 },
  reason: { fontSize: 15, lineHeight: 23, marginTop: 8 },
  taskDetails: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 7, marginTop: 12 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  examTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  action: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 15, borderWidth: 2 },
  firstAction: { minHeight: 48 },
  actionText: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 23, fontWeight: '700' },
  error: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 13, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  optionsToggle: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 7, paddingVertical: 6 },
  optionsSummary: { fontSize: 12, lineHeight: 19, marginLeft: 'auto', flexShrink: 1 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 20 },
  priorities: { flexDirection: 'row', gap: 6, marginTop: 10 },
  prioritiesStacked: { flexDirection: 'column', gap: 2 },
  priority: { flex: 1, minWidth: 0, minHeight: 94, paddingVertical: 9, paddingHorizontal: 5, borderWidth: 1, borderRadius: 10 },
  priorityStacked: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flex: 0, minHeight: 48 },
  priorityTitle: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  priorityValue: { fontSize: 18, lineHeight: 25, fontWeight: '700', fontVariant: ['tabular-nums'] },
  priorityLabel: { fontSize: 12, lineHeight: 18, fontWeight: '500', marginTop: 2 },
  priorityStatus: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 },
  priorityHint: { flexShrink: 1, fontSize: 11, lineHeight: 17 },
  status: { marginTop: 8, padding: 12, borderRadius: 13, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 },
  statusCopy: { flex: 1, minWidth: 150 },
  statusTitle: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  statusDetail: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  completionTrack: { height: 5, width: '100%', borderRadius: 3, overflow: 'hidden' },
});
