import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { HomeDashboard } from '../services/homeDashboard';
import type { AppColors } from '../theme';
import { StudyPlanIllustration } from './StudyPlanIllustration';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = { dashboard: HomeDashboard; colors: AppColors; onStartSession: () => void | Promise<void>; onOpenPriority: (kind: HomePriority) => void };
function PlanIcon({ name, color, size = 18 }: { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string; size?: number }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><MaterialCommunityIcons name={name} color={color} size={size} accessible={false} /></View>;
}

export function TodaysPlanCard({ dashboard, colors, onStartSession, onOpenPriority }: Props) {
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(0);
  const [opening, setOpening] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const arrival = useRef(new Animated.Value(1)).current;
  const press = useRef(new Animated.Value(0)).current;
  const stacked = (cardWidth || width - 40) < 350 || fontScale >= 1.3;
  const wide = (cardWidth || width - 40) >= 560 && fontScale < 1.4;
  const dark = colors.mode === 'dark';
  const body = dark ? '#BECBE0' : '#526180';
  const panel = dark ? '#19273C' : '#FFFFFFDC';
  const { recommendation } = dashboard;
  useEffect(() => {
    mounted.current = true;
    arrival.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(arrival, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!reducedMotion) animation.start();
    return () => { mounted.current = false; animation.stop(); press.stopAnimation(); };
  }, [arrival, press, reducedMotion]);
  const animatePress = (down: boolean) => {
    press.stopAnimation();
    Animated.timing(press, { toValue: down && !reducedMotion ? 1 : 0, duration: reducedMotion ? 0 : 130, useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const start = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    try { await onStartSession(); }
    catch { Alert.alert('Couldn’t open your next step', 'Please try again. Your learning data is saved.'); }
    finally { inFlight.current = false; if (mounted.current) setOpening(false); }
  };
  const priorities = [
    { kind: 'due' as const, value: dashboard.dueCount, label: 'Due reviews', icon: 'book-clock-outline' as const, tint: dark ? '#8BD9C2' : '#187D68', soft: dark ? '#213F3E' : '#E4F5EF', detail: dashboard.due.length ? [...new Set(dashboard.due.map((group) => group.deck.courseName))].join(' · ') : 'None scheduled right now' },
    { kind: 'weak' as const, value: dashboard.weak.length, label: 'Weak topics', icon: 'brain' as const, tint: dark ? '#C1AEFF' : '#7951C5', soft: dark ? '#372E50' : '#F0E9FF', detail: dashboard.weak.length ? 'Based on repeated practice' : dashboard.accuracy.total ? 'No low-performance pattern yet' : 'Practice to build evidence' },
    { kind: 'mistakes' as const, value: dashboard.mistakeIds.length, label: 'Mistakes to revisit', icon: 'target' as const, tint: dark ? '#F4BB95' : '#A65A3C', soft: dark ? '#453632' : '#FFF0E6', detail: 'Distinct, repeatedly missed questions' },
  ];
  return (
    <Animated.View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={[styles.frame, { borderColor: dark ? '#3A4B64' : '#DBE3F5', opacity: arrival, transform: reducedMotion ? [] : [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [5, 0] }) }] }]}>
      <LinearGradient colors={dark ? ['#1A283D', '#252B42'] : ['#FCFDFF', '#EDF3FF', '#F7F2FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.surface, wide && { padding: 24 }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: dark ? '#263D43' : '#E5F3ED' }]}><PlanIcon name="calendar-blank-outline" size={15} color={dark ? '#B6E6DA' : '#246957'} /><Text style={[styles.badgeText, { color: dark ? '#B6E6DA' : '#246957' }]}>Today’s Plan</Text></View>
          {recommendation.minutes !== null ? <View style={[styles.badge, { backgroundColor: panel }]}><PlanIcon name="clock-outline" size={15} color={body} /><Text style={[styles.estimate, { color: body }]}>About {recommendation.minutes} min</Text></View> : null}
        </View>
        <View style={[styles.hero, fontScale >= 1.8 && { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <View style={styles.heroCopy}><Text accessibilityRole="header" style={[styles.title, wide && { fontSize: 44, lineHeight: 52 }, { color: colors.text }]}>Study <Text style={{ color: dark ? '#B7AEFF' : '#5D4CC8' }}>Now</Text></Text></View>
          <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.art, wide && { width: 170, height: 130 }, fontScale >= 1.4 && { width: 75, height: 70 }]}><StudyPlanIllustration dark={dark} /></View>
        </View>
        <Text style={[styles.encouragement, { color: body }]}>{dashboard.decks.length ? 'One focused step toward understanding.' : 'Bring your course material. Find your first focus.'}</Text>
        <View style={[styles.priorities, { backgroundColor: panel }]}>
          <Text accessibilityRole="header" style={[styles.eyebrow, { color: body }]}>YOUR STUDY PRIORITIES</Text>
          <View style={[styles.metrics, stacked && { flexDirection: 'column' }]}>
            {priorities.map((priority, index) => <Pressable key={priority.kind} accessibilityRole="button" accessibilityLabel={`${priority.value} ${priority.label}`} accessibilityHint={`${priority.detail}. Opens the source and study options.`} onPress={() => onOpenPriority(priority.kind)} style={({ pressed }) => [styles.metric, stacked ? styles.metricStacked : { flex: 1 }, index > 0 && (stacked ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }), { opacity: pressed ? 0.65 : 1 }]}>
              <View style={[styles.metricIcon, { backgroundColor: priority.soft }]}><PlanIcon name={priority.icon} color={priority.tint} size={18} /></View>
              <Text style={[styles.value, { color: colors.text }]}>{priority.value.toLocaleString()}</Text>
              <View style={[styles.metricCopy, !stacked && { flexBasis: '100%', marginTop: 4 }]}><Text style={[styles.metricLabel, { color: body }]}>{priority.label}</Text>{stacked ? <Text style={[styles.metricDetail, { color: body }]}>{priority.detail}</Text> : null}</View>
              {stacked ? <PlanIcon name="chevron-right" color={body} size={16} /> : null}
            </Pressable>)}
          </View>
          {!stacked && dashboard.due.length ? <Text style={[styles.metricDetail, { color: body, marginTop: 8 }]}>Due in: {[...new Set(dashboard.due.map((group) => group.deck.courseName))].join(' · ')}</Text> : null}
        </View>
        <View style={[styles.next, { backgroundColor: panel }]}>
          <View style={styles.nextLabel}><PlanIcon name="compass-outline" color={dark ? '#B8B1FF' : '#6651BA'} size={16} /><Text style={[styles.eyebrow, { color: dark ? '#B8B1FF' : '#6651BA' }]}>RECOMMENDED NEXT STEP</Text></View>
          <Text style={[styles.nextTitle, { color: colors.text }]}>{recommendation.title}</Text>
          <Text style={[styles.why, { color: body }]}>{recommendation.why}</Text>
        </View>
        <Animated.View style={{ marginTop: 12, transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }}>
          <Pressable accessibilityRole="button" accessibilityLabel={opening ? 'Opening your next step' : recommendation.actionLabel} accessibilityHint={recommendation.why} accessibilityState={{ busy: opening, disabled: opening }} disabled={opening} onPress={() => { void start(); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} style={styles.actionClip}>
            <LinearGradient colors={['#2763D9', '#5944CD', '#7541CD']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={styles.action}>
              {opening ? <ActivityIndicator color="#FFFFFF" size="small" /> : <PlanIcon name={recommendation.kind === 'materials' ? 'plus' : 'play'} color="#FFFFFF" size={22} />}
              <Text style={styles.actionText}>{opening ? 'Opening…' : recommendation.actionLabel}</Text><PlanIcon name="arrow-right" color="#FFFFFF" size={19} />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  frame: { borderRadius: 28, borderWidth: 1, overflow: 'hidden' }, surface: { padding: 16 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, gap: 6, borderRadius: 30 }, badgeText: { fontSize: 11, lineHeight: 16, fontWeight: '800' }, estimate: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 }, heroCopy: { flex: 1, minWidth: 0 }, title: { fontSize: 34, lineHeight: 41, fontWeight: '900', letterSpacing: -1.1 }, art: { width: 108, height: 94, flexShrink: 0 }, encouragement: { fontSize: 13, lineHeight: 20, marginTop: 5 },
  priorities: { borderRadius: 20, padding: 12, marginTop: 18 }, eyebrow: { fontSize: 9, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, flexShrink: 1 }, metrics: { flexDirection: 'row', marginTop: 10 }, metric: { minHeight: 58, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 7, paddingVertical: 7 }, metricStacked: { flexWrap: 'nowrap', paddingHorizontal: 0, gap: 10 }, metricIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, value: { fontSize: 24, lineHeight: 31, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.6 }, metricCopy: { flex: 1, minWidth: 0 }, metricLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' }, metricDetail: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  next: { borderRadius: 17, padding: 13, marginTop: 12 }, nextLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 }, nextTitle: { fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 7 }, why: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  actionClip: { borderRadius: 17, overflow: 'hidden' }, action: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 14 }, actionText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 21, fontWeight: '800', color: '#FFFFFF' },
});
