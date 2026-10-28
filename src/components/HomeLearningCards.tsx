import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StudyPack } from '../models';
import type { HomeDashboard, HomeDueReview, HomeWeakTopic } from '../services/homeDashboard';
import { MISTAKE_RULE, WEAK_TOPIC_RULE } from '../services/homeDashboard';
import { Card, Icon, PrimaryButton, ProgressBar } from './ui';
import type { HomePriority } from './TodaysPlanCard';

export function UpcomingExamCard({ exam, onOpenPlan }: { exam: HomeDashboard['exam']; onOpenPlan: () => void }) {
  const { colors } = useStudyBolt();
  return <Card onPress={onOpenPlan} accessibilityLabel={exam ? `${exam.title}, ${exam.course}. ${exam.date}. ${exam.completed} of ${exam.total} plan tasks complete. See plan.` : 'Add an upcoming test in Planner'} style={styles.examCard}>
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Icon name="calendar-check-outline" color={colors.primary} size={23} /></View>
      <View style={styles.copy}>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{exam ? 'UPCOMING EXAM' : 'PLAN AHEAD'}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{exam ? exam.title : 'Have a test coming up?'}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{exam ? `${exam.course} · ${new Date(`${exam.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Set a date in Planner. We’ll pace your selected material.'}</Text>
      </View>
      <Icon name="chevron-right" color={colors.primary} size={21} />
    </View>
    {exam ? <View style={styles.examProgress}>
      <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Text style={[styles.countdown, { color: colors.primary }]}>{exam.daysRemaining === 0 ? 'Test today' : exam.daysRemaining === 1 ? 'Tomorrow' : `${exam.daysRemaining} days to go`}</Text><Text style={[styles.small, { color: colors.textSecondary }]}>{exam.completed} / {exam.total} study tasks complete</Text></View>
      {exam.progress !== null ? <View accessible accessibilityLabel={`${exam.progress}% of study-plan tasks marked complete`} style={{ marginTop: 8 }}><ProgressBar progress={exam.progress} color={colors.primary} /></View> : null}
      {exam.attentionTopics.length ? <Text style={[styles.small, { color: colors.textSecondary, marginTop: 8 }]}>Focus: {exam.attentionTopics.join(' · ')}</Text> : null}
      <Text style={[styles.planLink, { color: colors.primary }]}>See plan →</Text>
    </View> : null}
  </Card>;
}

export function RecentLearningCard({ activity, onOpenStats, onStart }: { activity: HomeDashboard['activity']; onOpenStats: () => void; onStart: () => void }) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const highlight = useRef(new Animated.Value(0)).current;
  const latest = activity[0];
  useEffect(() => {
    highlight.setValue(0);
    if (!latest || Date.now() - Date.parse(latest.at) > 5 * 60000 || reducedMotion) return;
    const animation = Animated.sequence([
      Animated.timing(highlight, { toValue: 0.7, duration: 280, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(highlight, { toValue: 0, duration: 1000, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [highlight, latest?.id, reducedMotion]);
  return <Card style={styles.activityCard}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: colors.mintSoft, opacity: highlight }]} />
    <View style={styles.row}><View style={styles.copy}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Recent activity</Text><Text style={[styles.small, { color: colors.textSecondary }]}>From completed work saved on this device</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open learning statistics" onPress={onOpenStats} style={styles.historyLink}><Text style={[styles.link, { color: colors.primary }]}>See all</Text><Icon name="chevron-right" color={colors.primary} size={18} /></Pressable></View>
    {activity.length ? activity.map((item) => <View key={item.id} style={[styles.activityRow, { borderTopColor: colors.border }]}>
      <View style={[styles.activityDot, { backgroundColor: item.recovered ? colors.mintSoft : colors.primarySoft }]}><Icon name={item.recovered ? 'check' : item.kind === 'quiz' ? 'clipboard-check-outline' : item.kind === 'review' ? 'cards-outline' : item.kind === 'audio' ? 'headphones' : 'timer-outline'} size={17} color={item.recovered ? colors.mint : colors.primary} /></View>
      <View style={styles.copy}><Text style={[styles.activityTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{item.course} · {item.detail}</Text>{item.recovered > 0 ? <Text style={[styles.recovery, { color: colors.mode === 'dark' ? colors.mint : '#187D68' }]}>{item.recovered} previously missed {item.recovered === 1 ? 'question answered' : 'questions answered'} correctly. A useful step forward.</Text> : null}<Text style={[styles.timestamp, { color: colors.textSecondary }]}>{new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(item.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text></View>
    </View>) : <View style={styles.emptyActivity}><Icon name="sprout-outline" color={colors.mint} size={25} /><Text style={[styles.body, { color: colors.textSecondary }]}>Your first completed practice or review will appear here. Start small; every honest attempt helps.</Text><Pressable accessibilityRole="button" onPress={onStart} style={styles.emptyAction}><Text style={[styles.link, { color: colors.primary }]}>Take your first step →</Text></Pressable></View>}
  </Card>;
}

export function HomePrioritySheet({ kind: requestedKind, dashboard, onClose, onDue, onWeak, onMistakes, onFlashcards, onPractice }: {
  kind: HomePriority | 'flashcards' | null; dashboard: HomeDashboard; onClose: () => void;
  onDue: (group: HomeDueReview) => void; onWeak: (topic: HomeWeakTopic) => void;
  onMistakes: () => void; onFlashcards: (deck: StudyPack) => void; onPractice: () => void;
}) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const lastKind = useRef(requestedKind);
  if (requestedKind !== null) lastKind.current = requestedKind;
  const kind = requestedKind ?? lastKind.current;
  const title = kind === 'due' ? 'Due reviews' : kind === 'weak' ? 'Weak topics' : kind === 'mistakes' ? 'Mistakes to revisit' : 'Choose flashcards';
  const explanation = kind === 'due' ? 'Only cards with a recorded review and a scheduled due date are counted. New cards are available in Flashcards.' : kind === 'weak' ? WEAK_TOPIC_RULE : kind === 'mistakes' ? MISTAKE_RULE : 'Choose a Study Pack to practice active recall.';
  const choose = (action: () => void) => { onClose(); action(); };
  return <Modal visible={requestedKind !== null} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
    <View style={styles.modal}>
      <Pressable accessibilityLabel="Close study priorities" onPress={onClose} style={styles.backdrop} />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.row}><Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close study priorities" onPress={onClose} style={[styles.close, { backgroundColor: colors.cardStrong }]}><Icon name="close" color={colors.textSecondary} size={21} /></Pressable></View>
        <Text style={[styles.explanation, { color: colors.textSecondary }]}>{explanation}</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
          {kind === 'due' ? dashboard.due.map((group) => <Choice key={group.deck.id} title={group.deck.courseName} detail={`${group.deck.title} · ${group.cardIds.length} due reviews`} onPress={() => choose(() => onDue(group))} />) : null}
          {kind === 'weak' ? dashboard.weak.map((topic) => <Choice key={`${topic.deck.id}:${topic.sectionId}`} title={topic.title} detail={`${topic.deck.courseName} · ${topic.correct} of ${topic.total} correct across ${topic.sessions} sessions`} onPress={() => choose(() => onWeak(topic))} />) : null}
          {kind === 'flashcards' ? dashboard.decks.filter((deck) => deck.flashcards.length).map((deck) => <Choice key={deck.id} title={deck.title} detail={`${deck.courseName} · ${deck.flashcards.length} cards`} onPress={() => choose(() => onFlashcards(deck))} />) : null}
          {kind === 'mistakes' && dashboard.mistakeIds.length ? <PrimaryButton label={`Review ${dashboard.mistakeIds.length} missed questions`} icon="book-alert-outline" onPress={() => choose(onMistakes)} /> : null}
          {(kind === 'due' && !dashboard.due.length || kind === 'weak' && !dashboard.weak.length || kind === 'mistakes' && !dashboard.mistakeIds.length || kind === 'flashcards' && !dashboard.decks.some((deck) => deck.flashcards.length)) ? <View style={styles.emptySheet}><Text style={[styles.title, { color: colors.text }]}>{kind === 'due' ? 'Nothing scheduled is due' : kind === 'weak' ? 'No confirmed weak topics yet' : kind === 'mistakes' ? 'No repeated misses to revisit' : 'Add material to make flashcards'}</Text><Text style={[styles.body, { color: colors.textSecondary, marginTop: 8 }]}>A short practice session is a useful place to begin. We’ll use your answers to guide future study.</Text><PrimaryButton label={dashboard.decks.length ? 'Choose practice material' : 'Add study material'} icon="plus" onPress={() => choose(onPractice)} style={{ marginTop: 16 }} /></View> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
function Choice({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}><View style={styles.copy}><Text style={[styles.activityTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{detail}</Text></View><Icon name="chevron-right" color={colors.primary} size={20} /></Pressable>;
}
const styles = StyleSheet.create({
  examCard: { marginTop: 16, padding: 16, shadowOpacity: 0, elevation: 0 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, copy: { flex: 1, minWidth: 0 }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 0.8, fontWeight: '800' }, title: { fontSize: 15, lineHeight: 21, fontWeight: '800' }, body: { fontSize: 12, lineHeight: 18, marginTop: 3 }, examProgress: { marginTop: 14 }, countdown: { fontSize: 12, lineHeight: 18, fontWeight: '800' }, small: { fontSize: 10, lineHeight: 16 }, planLink: { fontSize: 12, fontWeight: '800', marginTop: 10 },
  activityCard: { marginTop: 20, padding: 16, overflow: 'hidden', shadowOpacity: 0, elevation: 0 }, historyLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 1, paddingLeft: 8 }, link: { fontSize: 12, lineHeight: 18, fontWeight: '700' }, activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingTop: 12, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth }, activityDot: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, activityTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700' }, recovery: { fontSize: 11, lineHeight: 17, marginTop: 5 }, timestamp: { fontSize: 10, lineHeight: 15, marginTop: 5 }, emptyActivity: { marginTop: 15, alignItems: 'flex-start' }, emptyAction: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  modal: { flex: 1, justifyContent: 'flex-end' }, backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#00000066' }, sheet: { maxHeight: '85%', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 }, sheetTitle: { flex: 1, fontSize: 22, lineHeight: 29, fontWeight: '800' }, close: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, explanation: { fontSize: 12, lineHeight: 19, marginTop: 12, marginBottom: 15 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 70, padding: 13, borderRadius: 15, borderWidth: 1, marginBottom: 9 }, emptySheet: { paddingVertical: 10 },
});
