import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, ProgressBar, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { calculateCourseMastery, calculateMastery } from '../services/mastery';

const WEEK = [24, 46, 68, 88, 55, 34, 72];

export function StatsScreen() {
  const { colors, state } = useStudyBolt();
  const allMastery = calculateCourseMastery(state.decks);
  const quizScores = state.decks.flatMap((deck) => deck.quizAttempts);
  const quizAverage = quizScores.length ? Math.round(quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length) : 0;
  const masteredCards = state.decks.flatMap((deck) => deck.flashcards).filter((card) => card.confidence === 'known').length;
  const courses = useMemo(() => {
    const map = new Map<string, typeof state.decks>();
    state.decks.forEach((deck) => map.set(deck.courseId, [...(map.get(deck.courseId) ?? []), deck]));
    return [...map.values()];
  }, [state.decks]);

  return (
    <Screen>
      <Header title="Stats" right={<Pill label="This week" tone="purple" />} />
      <Text style={[styles.title, { color: colors.text }]}>Your progress</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>A useful estimate based on your StudyBolt activity—not a guarantee of test performance.</Text>

      <Card style={[styles.heroCard, { backgroundColor: colors.mode === 'dark' ? colors.purpleSoft : '#151A37' }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>ESTIMATED MASTERY</Text>
            <Text style={styles.heroValue}>{allMastery}%</Text>
          </View>
          <View style={[styles.ring, { borderColor: colors.purple }]}>
            <Icon name="star-four-points" color="#F9D76B" size={25} />
          </View>
        </View>
        <ProgressBar progress={allMastery} color={colors.purple} />
        <Text style={styles.heroHint}>You’re building a strong base. Review learning cards next.</Text>
      </Card>

      <View style={styles.metricGrid}>
        <Metric icon="timer-outline" label="Focus time" value={formatMinutes(state.focusMinutes)} tone="blue" />
        <Metric icon="clipboard-check-outline" label="Quiz average" value={`${quizAverage}%`} tone="mint" />
        <Metric icon="cards-outline" label="Cards mastered" value={`${masteredCards}`} tone="purple" />
        <Metric icon="fire" label="Day streak" value={`${state.streakDays}`} tone="orange" />
      </View>

      <SectionHeader title="Study rhythm" action="7 days" />
      <Card>
        <View style={styles.chart}>
          {WEEK.map((height, index) => (
            <View key={`${height}-${index}`} style={styles.chartColumn}>
              <View style={[styles.barTrack, { backgroundColor: colors.cardStrong }]}>
                <View style={[styles.bar, { height: `${height}%`, backgroundColor: index === 3 ? colors.purple : colors.primary }]} />
              </View>
              <Text style={[styles.dayLabel, { color: colors.textMuted }]}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.chartNote, { borderTopColor: colors.border }]}>
          <Icon name="lightning-bolt" size={18} color={colors.primary} />
          <Text style={[styles.chartNoteText, { color: colors.textSecondary }]}>4 focused days this week · strongest session on Thursday</Text>
        </View>
      </Card>

      <SectionHeader title="By course" />
      <View style={styles.courseList}>
        {courses.map((decks) => {
          const first = decks[0];
          if (!first) return null;
          const mastery = calculateCourseMastery(decks);
          const weak = decks.reduce((sum, deck) => sum + calculateMastery(deck).weakCount, 0);
          return (
            <Card key={first.courseId} style={styles.courseCard}>
              <View style={[styles.courseIcon, { backgroundColor: `${first.color}24` }]}><Text style={styles.emoji}>{first.emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={styles.courseTitleRow}>
                  <Text style={[styles.courseTitle, { color: colors.text }]}>{first.courseName}</Text>
                  <Text style={[styles.coursePercent, { color: first.color }]}>{mastery}%</Text>
                </View>
                <ProgressBar progress={mastery} color={first.color} />
                <Text style={[styles.courseMeta, { color: colors.textMuted }]}>{decks.length} decks · {weak} cards to review</Text>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

function Metric({ icon, label, value, tone }: { icon: 'timer-outline' | 'clipboard-check-outline' | 'cards-outline' | 'fire'; label: string; value: string; tone: 'blue' | 'mint' | 'purple' | 'orange' }) {
  const { colors } = useStudyBolt();
  const foreground = tone === 'mint' ? colors.mint : tone === 'purple' ? colors.purple : tone === 'orange' ? colors.warning : colors.primary;
  const background = tone === 'mint' ? colors.mintSoft : tone === 'purple' ? colors.purpleSoft : colors.primarySoft;
  return (
    <Card style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: background }]}><Icon name={icon} color={foreground} size={20} /></View>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}

const styles = StyleSheet.create({
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 18 },
  heroCard: { padding: 20 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heroLabel: { color: '#AEB5D6', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heroValue: { color: '#FFFFFF', fontSize: 43, lineHeight: 49, fontWeight: '800', letterSpacing: -1.4, marginTop: 4 },
  ring: { width: 61, height: 61, borderRadius: 31, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  heroHint: { color: '#C3C8DF', fontSize: 11, marginTop: 10 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  metricCard: { width: '48.5%', minHeight: 120 },
  metricIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 10 },
  metricLabel: { fontSize: 11, marginTop: 1 },
  chart: { height: 170, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 6 },
  chartColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 8 },
  barTrack: { width: 21, height: 130, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7 },
  dayLabel: { fontSize: 10, fontWeight: '700' },
  chartNote: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chartNoteText: { fontSize: 10, flex: 1 },
  courseList: { gap: 9 },
  courseCard: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  courseIcon: { width: 45, height: 45, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 23 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  courseTitle: { fontSize: 13, fontWeight: '800' },
  coursePercent: { fontSize: 13, fontWeight: '900' },
  courseMeta: { fontSize: 10, marginTop: 7 },
});
