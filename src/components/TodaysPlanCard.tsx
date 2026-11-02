import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { HomeDashboard } from '../services/homeDashboard';
import { getTodaysPlanFocus, type TodaysPlanFocus } from '../services/todaysPlan';
import type { AppColors } from '../theme';
import { StudyPlanIllustration } from './StudyPlanIllustration';
import { PriorityGlyph } from './StudyBoltGlyphs';

export type HomePriority = 'due' | 'weak' | 'mistakes';
type Props = {
  dashboard: HomeDashboard;
  colors: AppColors;
  onStartSession: () => void | Promise<void>;
  onOpenPriority: (kind: HomePriority) => void;
  onOpenPlan: () => void;
};
function PlanIcon({ name, color, size = 18 }: { name: keyof typeof MaterialCommunityIcons.glyphMap; color: string; size?: number }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><MaterialCommunityIcons name={name} color={color} size={size} accessible={false} /></View>;
}

export function TodaysPlanCard({ dashboard, colors, onStartSession, onOpenPriority, onOpenPlan }: Props) {
  const reducedMotion = useReducedMotion();
  const { width, fontScale } = useWindowDimensions();
  const [cardWidth, setCardWidth] = useState(0);
  const [opening, setOpening] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const arrival = useRef(new Animated.Value(1)).current;
  const float = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(0)).current;
  const availableWidth = cardWidth || width - 40;
  const stacked = availableWidth < 330 || fontScale >= 1.3;
  const wide = availableWidth >= 500 && fontScale < 1.3;
  const dark = colors.mode === 'dark';
  const body = colors.textSecondary;
  const actionBackground = dark ? colors.primary : '#1268D9';
  const focus = getTodaysPlanFocus(dashboard);
  const hasMaterials = dashboard.decks.length > 0;
  const animationKey = `${dashboard.recommendation.kind}:${dashboard.recommendation.deckId}:${focus.count}`;

  useEffect(() => {
    mounted.current = true;
    arrival.setValue(reducedMotion ? 1 : 0);
    const animation = Animated.timing(arrival, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    if (!reducedMotion) animation.start();
    return () => { mounted.current = false; animation.stop(); press.stopAnimation(); };
  }, [arrival, press, reducedMotion]);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    const stop = () => { animation?.stop(); float.setValue(0); };
    const start = () => {
      stop();
      if (reducedMotion || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      // A few gentle cycles on arrival; decorative work rests afterward and in the background.
      animation = Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.timing(float, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      ]), { iterations: 3 });
      animation.start();
    };
    start();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') start(); else stop(); });
    return () => { subscription.remove(); stop(); };
  }, [animationKey, float, reducedMotion]);

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
    { kind: 'due' as const, value: dashboard.dueCount, label: 'Due reviews', tint: dark ? colors.mint : '#187D68', soft: colors.mintSoft, detail: dashboard.due.length ? [...new Set(dashboard.due.map((group) => group.deck.courseName))].join(' · ') : 'No scheduled reviews are due' },
    { kind: 'weak' as const, value: dashboard.weak.length, label: 'Weak topics', tint: colors.purple, soft: colors.purpleSoft, detail: 'Topics needing practice, based on repeated recorded answers' },
    { kind: 'mistakes' as const, value: dashboard.mistakeIds.length, label: 'Missed questions', tint: colors.primary, soft: colors.primarySoft, detail: 'Distinct questions missed repeatedly and not yet corrected' },
  ];

  return (
    <Animated.View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={[styles.frame, { shadowColor: colors.shadow, opacity: arrival, transform: reducedMotion ? [] : [{ translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }]}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <LinearGradient colors={[colors.primarySoft, colors.card, colors.card]} locations={[0, 0.36, 1]} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 1 }} style={[styles.surface, wide && styles.surfaceWide]}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Today’s Plan. Open your study planner" onPress={onOpenPlan} onFocus={() => setFocused('planner')} onBlur={() => setFocused(null)} style={({ pressed }) => [styles.badgeClip, { opacity: pressed ? 0.7 : 1, borderColor: focused === 'planner' ? colors.primary : 'transparent' }]}>
              <View style={styles.planBadge}>
                <View style={[styles.planMark, { backgroundColor: colors.goldSoft }]}><PlanIcon name="calendar-check-outline" size={17} color={colors.goldText} /></View>
                <Text style={[styles.badgeText, { color: colors.text }]}>Today’s plan</Text>
                <PlanIcon name="chevron-right" size={15} color={body} />
              </View>
            </Pressable>
            {dashboard.recommendation.minutes !== null ? <View style={styles.timeBadge}><PlanIcon name="clock-outline" size={14} color={body} /><Text style={[styles.estimate, { color: body }]}>About {dashboard.recommendation.minutes} min</Text></View> : null}
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCopy}>
              <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide, { color: colors.text }]}>Study{'\u2002'}<Text style={{ color: colors.primary }}>Now</Text></Text>
              <Text style={[styles.encouragement, { color: body }]}>{hasMaterials ? 'A clear next step. A little more confidence.' : 'Build your routine from what you’re learning.'}</Text>
            </View>
            {fontScale < 1.6 ? <PlanArtwork colors={colors} motion={float} wide={wide} compact={availableWidth < 350 || fontScale >= 1.3} /> : null}
          </View>

          {hasMaterials ? <View style={styles.priorities}>
            <View style={styles.priorityHeading}><Text accessibilityRole="header" style={[styles.priorityTitle, { color: colors.text }]}>Your study priorities</Text><Text style={[styles.priorityHint, { color: body }]}>View details</Text></View>
            <View style={[styles.metrics, stacked && styles.metricsStacked]}>
              {priorities.map((priority) => <Pressable
                key={priority.kind} accessibilityRole="button" accessibilityLabel={`${priority.value} ${priority.label}`} accessibilityHint={`${priority.detail}. View study options.`}
                onPress={() => onOpenPriority(priority.kind)} onFocus={() => setFocused(priority.kind)} onBlur={() => setFocused(null)}
                style={({ pressed }) => [styles.metric, stacked ? styles.metricStacked : styles.metricColumn, { opacity: pressed ? 0.65 : 1, borderColor: focused === priority.kind ? colors.primary : colors.border, backgroundColor: focused === priority.kind ? colors.primarySoft : colors.card }]}
              >
                <View style={[styles.metricTop, stacked && styles.metricTopStacked]}>
                  <View style={[styles.metricIcon, { backgroundColor: priority.soft }]}><PriorityGlyph name={priority.kind} color={priority.tint} accent={colors.gold} size={21} /></View>
                  <Text style={[styles.value, { color: colors.text }]}>{priority.value.toLocaleString()}</Text>
                </View>
                <View style={styles.metricLabelRow}><Text style={[styles.metricLabel, { color: body }]}>{priority.label}</Text><PlanIcon name="chevron-right" color={priority.tint} size={13} /></View>
              </Pressable>)}
            </View>
          </View> : null}

          <View style={[styles.nextFrame, { borderColor: `${colors.primary}26`, backgroundColor: colors.primarySoft }]}>
            <View style={[styles.nextAccent, { backgroundColor: colors.goldBright }]} />
            <View style={styles.nextPanel}>
              <View style={styles.nextHeading}><PlanIcon name="bullseye-arrow" color={colors.primary} size={16} /><Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{focus.medium === 'materials' ? 'YOUR FIRST STEP' : 'NEXT UP'}</Text>{focus.examLabel ? <Text style={[styles.examTag, { color: colors.goldText, backgroundColor: colors.goldSoft }]}>{focus.examLabel}</Text> : null}</View>
              <View style={styles.nextBody}>
                <View style={styles.nextCopy}>
                  <Text accessibilityRole="header" style={[styles.nextTitle, { color: colors.text }]}>{focus.title}</Text>
                  {focus.source ? <Text style={[styles.source, { color: colors.textSecondary }]}>{focus.source}</Text> : null}
                  <Text style={[styles.reason, { color: body }]}>{focus.reason}</Text>
                </View>
                {!stacked ? <SessionSummary focus={focus} colors={colors} /> : null}
              </View>
              <View style={[styles.tip, { borderTopColor: `${colors.primary}26` }]}><PlanIcon name="lightbulb-on-outline" size={14} color={colors.goldText} /><Text style={[styles.tipText, { color: body }]}>{focus.tip}</Text></View>
            </View>
          </View>

          <Animated.View style={{ marginTop: 13, transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }}>
            <Pressable accessibilityRole="button" accessibilityLabel={opening ? 'Opening your next step' : `${focus.actionLabel}${focus.actionDetail ? `. ${focus.actionDetail}` : ''}`} accessibilityHint={focus.reason} accessibilityState={{ busy: opening, disabled: opening }} disabled={opening} onPress={() => { void start(); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} onFocus={() => setFocused('action')} onBlur={() => setFocused(null)} style={[styles.actionClip, { borderColor: focused === 'action' ? colors.text : 'transparent', opacity: opening ? 0.8 : 1 }]}>
              <View style={[styles.action, { backgroundColor: actionBackground }]}>
                <View style={[styles.play, { backgroundColor: `${colors.primaryText}1C` }]}>{opening ? <ActivityIndicator color={colors.primaryText} size="small" /> : <PlanIcon name={focus.medium === 'materials' ? 'plus' : focus.medium === 'notes' ? 'book-open-page-variant-outline' : 'play'} color={colors.primaryText} size={19} />}</View>
                <View style={styles.actionCopy}><Text style={[styles.actionText, { color: colors.primaryText }]}>{opening ? 'Opening…' : focus.actionLabel}</Text>{focus.actionDetail && (stacked || availableWidth < 390) ? <Text style={[styles.actionDetail, { color: colors.primaryText }]}>{focus.actionDetail}</Text> : null}</View>
                {focus.actionDetail && !stacked && availableWidth >= 390 ? <Text style={[styles.actionDetail, { color: colors.primaryText }]}>{focus.actionDetail}</Text> : null}
                <PlanIcon name="arrow-right" color={colors.primaryText} size={20} />
              </View>
            </Pressable>
          </Animated.View>
          <Text style={[styles.footer, { color: body }]}>Progress over perfection. One useful step at a time.</Text>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

function SessionSummary({ focus, colors }: { focus: TodaysPlanFocus; colors: AppColors }) {
  return <View accessible accessibilityLabel={focus.count === null ? focus.countLabel : `${focus.count} ${focus.countLabel}`} style={[styles.summary, { backgroundColor: colors.card, borderColor: `${colors.primary}26` }]}>
    {focus.count === null
      ? <PlanIcon name={focus.medium === 'audio' ? 'headphones' : focus.medium === 'materials' ? 'sprout-outline' : 'book-open-page-variant-outline'} size={25} color={colors.primary} />
      : <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.summaryValue, { color: colors.primary }]}>{focus.count.toLocaleString()}</Text>}
    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{focus.countLabel}</Text>
  </View>;
}

function PlanArtwork({ colors, motion, wide, compact }: { colors: AppColors; motion: Animated.Value; wide: boolean; compact: boolean }) {
  return <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[styles.art, wide && styles.artWide, compact && styles.artCompact]}>
    <Svg width="100%" height="100%" viewBox="0 0 190 145" style={StyleSheet.absoluteFill} accessible={false}>
      <Ellipse cx="105" cy="80" rx="76" ry="53" fill={colors.primarySoft} />
      <Ellipse cx="136" cy="44" rx="25" ry="25" fill={colors.goldSoft} opacity="0.65" />
    </Svg>
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-1deg', '1deg'] }) }] }]}><StudyPlanIllustration dark={colors.mode === 'dark'} /></Animated.View>
    <Animated.View style={[styles.sparkle, { top: '17%', left: '8%', opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.95] }), transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.05] }) }] }]}><PlanIcon name="star-four-points" color={colors.goldBright} size={15} /></Animated.View>
    <View style={[styles.sparkle, { top: '44%', right: '2%', opacity: 0.45 }]}><PlanIcon name="star-four-points" color={colors.primary} size={10} /></View>
  </View>;
}

const styles = StyleSheet.create({
  frame: { borderRadius: 24, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 12, elevation: 1 },
  card: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  surface: { padding: 16 },
  surfaceWide: { padding: 20 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  badgeClip: { borderRadius: 12, borderWidth: 1 },
  planBadge: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 3, paddingVertical: 4 },
  planMark: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  estimate: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, minHeight: 104 },
  heroCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 32, lineHeight: 40, fontWeight: '900', letterSpacing: -1 },
  titleWide: { fontSize: 38, lineHeight: 46, letterSpacing: -1.2 },
  encouragement: { fontSize: 13, lineHeight: 20, marginTop: 5, maxWidth: 310 },
  art: { width: 108, height: 100, flexShrink: 0 },
  artWide: { width: 150, height: 124 },
  artCompact: { width: 82, height: 80 },
  sparkle: { position: 'absolute' },
  priorities: { marginTop: 12 },
  priorityHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  priorityTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
  priorityHint: { fontSize: 10, lineHeight: 16 },
  eyebrow: { fontSize: 9, lineHeight: 15, fontWeight: '800', letterSpacing: 0.9 },
  metrics: { flexDirection: 'row', gap: 7, marginTop: 9 },
  metricsStacked: { flexDirection: 'column', gap: 6 },
  metric: { minHeight: 84, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 14, borderWidth: 1 },
  metricColumn: { flex: 1, minWidth: 0 },
  metricStacked: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingVertical: 8 },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricTopStacked: { minWidth: 80 },
  metricIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 23, lineHeight: 29, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5, flexShrink: 1 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 1, marginTop: 5, flex: 1 },
  metricLabel: { fontSize: 11, lineHeight: 16, fontWeight: '500', flex: 1 },
  nextFrame: { marginTop: 14, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  nextAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  nextPanel: { padding: 14, paddingLeft: 16 },
  nextHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  examTag: { marginLeft: 'auto', fontSize: 9, lineHeight: 14, fontWeight: '700', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  nextBody: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 9 },
  nextCopy: { flex: 1, minWidth: 0 },
  nextTitle: { fontSize: 17, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25 },
  source: { fontSize: 11, lineHeight: 17, fontWeight: '600', marginTop: 3 },
  reason: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 11, paddingTop: 9 },
  tipText: { flex: 1, fontSize: 11, lineHeight: 17 },
  summary: { width: 68, minHeight: 76, borderRadius: 15, borderWidth: 1, flexShrink: 0, alignItems: 'center', justifyContent: 'center', padding: 7, gap: 2 },
  summaryValue: { fontSize: 26, lineHeight: 32, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.8 },
  summaryLabel: { fontSize: 9, lineHeight: 13, textAlign: 'center', fontWeight: '500' },
  actionClip: { borderRadius: 17, borderWidth: 2, overflow: 'hidden' },
  action: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10 },
  play: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionCopy: { flex: 1, minWidth: 0 },
  actionText: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  actionDetail: { fontSize: 11, lineHeight: 16, fontWeight: '500', opacity: 0.85, flexShrink: 1 },
  footer: { fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 8 },
});
