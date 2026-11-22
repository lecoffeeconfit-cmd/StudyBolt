import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { AppColors } from '../theme';
import { typography } from '../theme';
import { Card, Icon } from './ui';
import { GuideAnchor } from './StudyGuidance';
import type { IconName } from './ui';

interface PlannerRouteCardProps {
  colors: AppColors;
  sample: boolean;
  title: string;
  packCount: string;
  windowLabel: string | null;
  testDate: string | null;
  totalTime: string;
  dailyTime: string;
  mastery: number;
  progress: number;
  complete: boolean;
  reducedMotion: boolean;
}

const masteryExplanation = 'Based on note review, flashcards, and practice scores.';

export function PlannerRouteCard({
  colors, sample, title, packCount, windowLabel, testDate, totalTime, dailyTime, mastery, progress, complete, reducedMotion,
}: PlannerRouteCardProps) {
  const { fontScale } = useWindowDimensions();
  const light = colors.mode === 'light';
  const edge = light ? '#BED6F7' : colors.neon?.edge ?? colors.border;
  const insetEdge = light ? '#D9E6F7' : colors.border;
  const routeAccent = light ? '#0E5FC9' : colors.primary;
  const routeStatus = testDate ? `Test ${testDate}` : windowLabel ?? 'No test date';
  const isScheduled = Boolean(testDate || windowLabel);
  const statusColor = isScheduled ? colors.primary : colors.textSecondary;
  const tileBasis = 120 * Math.max(1, fontScale);

  return (
    <Card style={[styles.card, { backgroundColor: colors.primarySoft, borderColor: edge }]}>
      <LinearGradient
        colors={light ? ['#EFF6FF', '#DFEDFF'] : colors.neon?.hero ?? colors.night?.hero ?? [colors.primarySoft, colors.cardStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backdrop}
      />
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={[styles.routeIcon, { backgroundColor: colors.card, borderColor: insetEdge }]}>
            <Icon name="map-marker-path" size={22} color={routeAccent} />
          </View>
          <Text style={[styles.routeLabel, { color: routeAccent }]}>{sample ? 'Sample route' : 'Your route'}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: colors.card, borderColor: insetEdge }]}>
          <Icon name="calendar-blank-outline" size={15} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{routeStatus}</Text>
        </View>
      </View>

      <View style={styles.subject}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.metadata, { color: colors.textSecondary }]}>
          {packCount}{testDate && windowLabel ? ` · ${windowLabel}` : ''}
        </Text>
      </View>

      <View style={styles.metrics}>
        <TimeMetric label="Total study time" spokenLabel="Estimated total study time" value={totalTime} icon="clock-outline" colors={colors} borderColor={insetEdge} basis={tileBasis} />
        <TimeMetric label="Per study day" value={dailyTime} icon="calendar-month-outline" colors={colors} borderColor={insetEdge} basis={tileBasis} />
      </View>

      <GuideAnchor id="planner-progress" style={[styles.progressPanel, { backgroundColor: colors.card, borderColor: insetEdge }]}>
        <View accessible accessibilityLabel={`Mastery estimate, ${mastery} percent. ${masteryExplanation}`} style={styles.mastery}>
          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Icon name="chart-bar" size={17} color={colors.goldText} />
              <Text style={[styles.panelLabel, { color: colors.text }]}>Mastery estimate</Text>
            </View>
            <Text style={[styles.panelValue, { color: colors.text }]}>{mastery}%</Text>
          </View>
          <Text style={[styles.explanation, { color: colors.textSecondary }]}>{masteryExplanation}</Text>
        </View>
        <View style={[styles.completion, { borderColor: insetEdge }]}>
          <PlanCompletion progress={progress} complete={complete} reducedMotion={reducedMotion} colors={colors} />
          {complete ? (
            <View style={styles.completeNotice} accessibilityLiveRegion="polite">
              <Icon name="check-circle-outline" size={17} color={colors.goldText} />
              <Text style={[styles.panelLabel, { color: colors.goldText }]}>Route complete</Text>
            </View>
          ) : null}
        </View>
      </GuideAnchor>
    </Card>
  );
}

function TimeMetric({ label, spokenLabel = label, value, icon, colors, borderColor, basis }: {
  label: string; spokenLabel?: string; value: string; icon: IconName; colors: AppColors; borderColor: string; basis: number;
}) {
  return (
    <View accessible accessibilityLabel={`${spokenLabel}, ${value}`} style={[styles.metric, { backgroundColor: colors.card, borderColor, flexBasis: basis }]}>
      <View style={styles.metricHeading}>
        <Icon name={icon} size={17} color={colors.primary} />
        <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function PlanCompletion({ progress, complete, reducedMotion, colors }: {
  progress: number; complete: boolean; reducedMotion: boolean; colors: AppColors;
}) {
  const fill = useRef(new Animated.Value(progress / 100)).current;
  useEffect(() => {
    if (reducedMotion) {
      fill.setValue(progress / 100);
      return;
    }
    const animation = Animated.timing(fill, {
      toValue: progress / 100,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, progress, reducedMotion]);

  const start = colors.neon?.progressFill ?? colors.primary;
  const end = complete ? colors.goldBright : colors.neon?.progressEnd ?? (colors.night ? colors.primary : '#4587E8');

  return (
    <View
      accessible
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      accessibilityRole="progressbar"
      accessibilityLabel="Plan completion"
      accessibilityValue={{ min: 0, max: 100, now: progress }}
      style={styles.progress}
    >
      <View style={styles.detailRow}>
        <Text style={[styles.panelLabel, { color: colors.textSecondary }]}>Plan completion</Text>
        <Text style={[styles.progressValue, { color: colors.primary }]}>{progress}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.neon?.progressTrack ?? (colors.mode === 'light' ? '#E0EBF9' : colors.border) }]}>
        <Animated.View style={[styles.fill, { transform: [{ scaleX: fill }] }]}>
          <LinearGradient colors={[start, end]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 16, borderRadius: 24, borderWidth: 1, shadowOpacity: 0.065, shadowRadius: 12 },
  backdrop: { ...StyleSheet.absoluteFill, borderRadius: 23, pointerEvents: 'none' },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1, maxWidth: '100%' },
  routeIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  routeLabel: { ...typography.secondary, fontWeight: '800', flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, flexShrink: 1, maxWidth: '100%' },
  statusText: { ...typography.caption, fontWeight: '700', flexShrink: 1 },
  subject: { marginTop: 13, gap: 3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.35 },
  metadata: typography.secondary,
  metrics: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flexGrow: 1, flexShrink: 1, minWidth: 0, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 9, gap: 5, justifyContent: 'space-between' },
  metricHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricLabel: { ...typography.caption, flexShrink: 1, fontWeight: '600' },
  metricValue: { fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.35, fontVariant: ['tabular-nums'] },
  progressPanel: { borderWidth: 1, borderRadius: 15, marginTop: 8, paddingHorizontal: 11 },
  mastery: { paddingVertical: 9, gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 10, rowGap: 2 },
  detailLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, maxWidth: '100%' },
  panelLabel: { ...typography.secondary, flexShrink: 1, fontWeight: '700' },
  panelValue: { fontSize: 20, lineHeight: 26, fontWeight: '800', fontVariant: ['tabular-nums'] },
  explanation: typography.caption,
  completion: { borderTopWidth: 1, paddingVertical: 9, gap: 8 },
  progress: { gap: 6 },
  progressValue: { fontSize: 16, lineHeight: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  track: { height: 9, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', width: '100%', borderRadius: 5, overflow: 'hidden', transformOrigin: 'left center' },
  completeNotice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
