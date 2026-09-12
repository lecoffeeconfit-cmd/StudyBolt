import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar, Screen, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { StudyModality, StudyPack, StudyPlan, StudyScope } from '../models';
import { calculateCourseMastery } from '../services/mastery';
import { disableStudyReminders, scheduleStudyPlanReminders } from '../services/notifications';
import {
  buildStudyPlan,
  estimateStudyMinutesByModality,
  getPlanProgress,
  MODALITY_LABELS,
  RECOMMENDED_MODALITIES,
} from '../services/studyPlan';

const DURATIONS: Array<{ days: StudyPlan['durationDays']; label: string; detail: string }> = [
  { days: 1, label: '1 day', detail: 'Sprint' },
  { days: 3, label: '3 days', detail: 'Focused' },
  { days: 7, label: '1 week', detail: 'Balanced' },
  { days: 14, label: '2 weeks', detail: 'Spaced' },
];

const MODALITY_ICONS: Record<StudyModality, IconName> = {
  notes: 'note-text-outline',
  audio: 'headphones',
  flashcards: 'cards-outline',
  quiz: 'clipboard-text-outline',
  test: 'school-outline',
};

export function PlannerScreen({ focusDeckId, onFocusApplied }: { focusDeckId?: string; onFocusApplied?: () => void }) {
  const { colors, recordStudyEvent, state, setPlan, setFocusMinutes } = useStudyBolt();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const appliedFocus = useRef<string | undefined>(undefined);
  const entrance = useRef(new Animated.Value(0)).current;

  const decksForScope = useCallback((scope: StudyScope): StudyPack[] => scope.type === 'deck'
    ? state.decks.filter((deck) => deck.id === scope.id)
    : state.decks.filter((deck) => deck.courseId === scope.id), [state.decks]);

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 350,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (!focusDeckId || appliedFocus.current === focusDeckId) return;
    const deck = state.decks.find((item) => item.id === focusDeckId);
    if (!deck) return;
    appliedFocus.current = focusDeckId;
    void disableStudyReminders();
    setPlan(buildStudyPlan([deck], {
      durationDays: state.plan.durationDays,
      scope: { type: 'deck', id: deck.id },
      modalities: state.plan.modalities.length ? state.plan.modalities : RECOMMENDED_MODALITIES,
      quizQuestionCount: state.quizQuestionCount,
      remindersEnabled: false,
    }));
    onFocusApplied?.();
  }, [focusDeckId, onFocusApplied, setPlan, state.decks, state.plan.durationDays, state.plan.modalities, state.quizQuestionCount]);

  const selectedDecks = useMemo(() => decksForScope(state.plan.scope), [decksForScope, state.plan.scope]);
  const subject = state.plan.scope.type === 'deck'
    ? selectedDecks[0]?.title ?? 'your PowerPoint'
    : state.classes.find((item) => item.id === state.plan.scope.id)?.name ?? selectedDecks[0]?.courseName ?? 'your class';
  const estimates = useMemo(
    () => estimateStudyMinutesByModality(selectedDecks, state.quizQuestionCount),
    [selectedDecks, state.quizQuestionCount],
  );
  const totalMinutes = state.plan.days.reduce((sum, day) => sum + day.minutes, 0);
  const activeDayCount = Math.max(1, state.plan.days.filter((day) => day.minutes > 0).length);
  const planProgress = getPlanProgress(state.plan);
  const mastery = calculateCourseMastery(selectedDecks);

  const applyPlan = useCallback((scope: StudyScope, durationDays = state.plan.durationDays, modalities = state.plan.modalities) => {
    const decks = decksForScope(scope);
    if (!decks.length || !modalities.length) return;
    const next = buildStudyPlan(decks, {
      durationDays,
      scope,
      modalities,
      quizQuestionCount: state.quizQuestionCount,
      remindersEnabled: state.plan.remindersEnabled,
    });
    setPlan(next);
    setNotice(null);
    if (next.remindersEnabled) {
      void scheduleStudyPlanReminders(next, scope.type === 'deck' ? decks[0]?.title ?? 'your PowerPoint' : decks[0]?.courseName ?? 'your class')
        .then((result) => {
          if (result.error) {
            setPlan({ ...next, remindersEnabled: false });
            setNotice({ tone: 'error', text: result.error });
          }
        });
    }
  }, [decksForScope, setPlan, state.plan.durationDays, state.plan.modalities, state.plan.remindersEnabled, state.quizQuestionCount]);

  useEffect(() => {
    if (focusDeckId || state.plan.quizQuestionCount === state.quizQuestionCount) return;
    applyPlan(state.plan.scope);
  }, [applyPlan, focusDeckId, state.plan.quizQuestionCount, state.plan.scope, state.quizQuestionCount]);

  const chooseScopeType = (type: StudyScope['type']) => {
    if (type === state.plan.scope.type) return;
    if (type === 'deck') {
      const deck = selectedDecks[0] ?? state.decks[0];
      if (deck) applyPlan({ type, id: deck.id });
      return;
    }
    const courseId = selectedDecks[0]?.courseId ?? state.classes[0]?.id;
    if (courseId) applyPlan({ type, id: courseId });
  };

  const toggleModality = (modality: StudyModality) => {
    const selected = state.plan.modalities.includes(modality);
    if (selected && state.plan.modalities.length === 1) {
      setNotice({ tone: 'error', text: 'Keep at least one study method in your plan.' });
      return;
    }
    const next = selected
      ? state.plan.modalities.filter((item) => item !== modality)
      : [...state.plan.modalities, modality];
    applyPlan(state.plan.scope, state.plan.durationDays, next);
  };

  const toggleBlock = (dayId: string, blockId: string) => {
    const days = state.plan.days.map((day) => {
      if (day.id !== dayId) return day;
      const blocks = day.blocks.map((block) => block.id === blockId ? { ...block, complete: !block.complete } : block);
      return { ...day, blocks, complete: blocks.length > 0 && blocks.every((block) => block.complete) };
    });
    const next = { ...state.plan, days };
    setPlan(next);
    if (next.remindersEnabled) void scheduleStudyPlanReminders(next, subject);
  };

  const toggleReminders = async (enabled: boolean) => {
    setNotice(null);
    if (!enabled) {
      await disableStudyReminders();
      setPlan({ ...state.plan, remindersEnabled: false });
      setNotice({ tone: 'success', text: 'Study reminders are off.' });
      return;
    }
    const result = await scheduleStudyPlanReminders(state.plan, subject);
    if (result.error) {
      setNotice({ tone: 'error', text: result.error });
      return;
    }
    setPlan({ ...state.plan, remindersEnabled: true });
    setNotice({ tone: 'success', text: `${result.scheduled} study reminders scheduled around 6:00 PM.` });
  };

  return (
    <Screen>
      <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <Header title="Planner" right={<Pill label="Adaptive route" tone="mint" />} />
        <Text style={[styles.title, { color: colors.text }]}>Learn it on your timeline.</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose what you’re learning, your deadline, and the methods that work for you. StudyBolt maps the whole source into manageable sessions.</Text>

        <SectionHeader title="1 · What are you learning?" />
        <View style={[styles.segmented, { backgroundColor: colors.cardStrong }]}>
          {(['deck', 'course'] as const).map((type) => {
            const selected = state.plan.scope.type === type;
            return (
              <Pressable key={type} onPress={() => chooseScopeType(type)} style={[styles.segment, selected && { backgroundColor: colors.card }]}>
                <Icon name={type === 'deck' ? 'file-powerpoint-box' : 'bookshelf'} size={18} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>{type === 'deck' ? 'One PowerPoint' : 'Entire class'}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.choiceList}>
          {(state.plan.scope.type === 'deck' ? state.decks : state.classes).map((item) => {
            const id = item.id;
            const label = 'title' in item ? item.title : item.name;
            const detail = 'pageCount' in item ? `${item.courseName} · ${item.pageCount} slides` : `${state.decks.filter((deck) => deck.courseId === item.id).length} PowerPoints`;
            const selected = state.plan.scope.id === id;
            return (
              <Pressable key={id} onPress={() => applyPlan({ type: state.plan.scope.type, id })} style={[styles.scopeChoice, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                <View style={[styles.scopeIcon, { backgroundColor: `${item.color}20` }]}><Text style={styles.scopeEmoji}>{item.emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.scopeTitle, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.scopeDetail, { color: colors.textMuted }]}>{detail}</Text>
                </View>
                <Icon name={selected ? 'check-circle' : 'circle-outline'} color={selected ? colors.primary : colors.textMuted} size={22} />
              </Pressable>
            );
          })}
        </View>

        <SectionHeader title="2 · When do you need to know it?" />
        <View style={styles.durationGrid}>
          {DURATIONS.map((duration) => {
            const selected = state.plan.durationDays === duration.days;
            return (
              <Pressable key={duration.days} onPress={() => applyPlan(state.plan.scope, duration.days)} style={[styles.duration, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                <Text style={[styles.durationLabel, { color: selected ? colors.primaryText : colors.text }]}>{duration.label}</Text>
                <Text style={[styles.durationDetail, { color: selected ? colors.primaryText : colors.textMuted, opacity: selected ? 0.72 : 1 }]}>{duration.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader title="3 · Choose your study mix" action="Use recommended" onAction={() => applyPlan(state.plan.scope, state.plan.durationDays, RECOMMENDED_MODALITIES)} />
        <Card style={[styles.recommendation, { backgroundColor: colors.mintSoft }]}>
          <Icon name="creation" color={colors.mint} size={22} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.recommendationTitle, { color: colors.text }]}>Recommended order</Text>
            <Text style={[styles.recommendationText, { color: colors.textSecondary }]}>Notes → audio → flashcards → practice quiz → full test</Text>
          </View>
        </Card>
        <View style={styles.modalityList}>
          {RECOMMENDED_MODALITIES.map((modality, index) => {
            const selected = state.plan.modalities.includes(modality);
            return (
              <Pressable key={modality} onPress={() => toggleModality(modality)} style={[styles.modality, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                <View style={[styles.modalityOrder, { backgroundColor: selected ? colors.primarySoft : colors.cardStrong }]}>
                  <Text style={[styles.modalityOrderText, { color: selected ? colors.primary : colors.textMuted }]}>{index + 1}</Text>
                </View>
                <Icon name={MODALITY_ICONS[modality]} color={selected ? colors.primary : colors.textMuted} size={21} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalityTitle, { color: colors.text }]}>{MODALITY_LABELS[modality]}</Text>
                  <Text style={[styles.modalityDetail, { color: colors.textMuted }]}>{modality === 'test' ? 'Distinct, cumulative questions' : modality === 'quiz' ? `${state.quizQuestionCount} practice questions` : 'Included in your route'}</Text>
                </View>
                <Text style={[styles.modalityMinutes, { color: selected ? colors.primary : colors.textMuted }]}>≈ {formatMinutes(estimates[modality])}</Text>
                <Icon name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} color={selected ? colors.primary : colors.textMuted} size={22} />
              </Pressable>
            );
          })}
        </View>

        <Card style={[styles.planSummary, { backgroundColor: colors.mode === 'dark' ? colors.primarySoft : '#101A3D' }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryEyebrow}>YOUR ROUTE</Text>
              <Text style={styles.summaryTitle}>{subject}</Text>
              <Text style={styles.summaryDetail}>{selectedDecks.length} PowerPoint{selectedDecks.length === 1 ? '' : 's'} · {state.plan.durationDays} day{state.plan.durationDays === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.timeBubble}>
              <Text style={styles.timeValue}>{formatMinutes(totalMinutes)}</Text>
              <Text style={styles.timeLabel}>estimated</Text>
            </View>
          </View>
          <View style={styles.summaryMetrics}>
            <Text style={styles.summaryMetric}>≈ {formatMinutes(Math.ceil(totalMinutes / activeDayCount))}/study day</Text>
            <Text style={styles.summaryMetric}>{mastery}% current mastery</Text>
          </View>
          <ProgressBar progress={planProgress} color={colors.mint} />
          <Text style={styles.progressLabel}>{planProgress}% of planned sessions complete</Text>
        </Card>

        <SectionHeader title="Your day-by-day route" action={`${state.plan.days.filter((day) => day.minutes > 0).length} study days`} />
        <View style={styles.timeline}>
          {state.plan.days.map((day, index) => (
            <View key={day.id} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, { backgroundColor: day.complete ? colors.mint : index === 0 ? colors.primary : colors.purple }]}>
                  <Icon name={day.complete ? 'check' : day.minutes ? 'lightning-bolt' : 'weather-night'} size={13} color={colors.primaryText} />
                </View>
                {index < state.plan.days.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
              </View>
              <Card style={[styles.dayCard, day.complete && { borderColor: colors.mint }]}>
                <View style={styles.dayHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, { color: colors.text }]}>{day.label}</Text>
                    <Text style={[styles.daySubtitle, { color: colors.textMuted }]}>{day.subtitle}</Text>
                  </View>
                  <Pill label={day.minutes ? formatMinutes(day.minutes) : 'Rest'} tone={day.complete ? 'mint' : index === 0 ? 'blue' : 'neutral'} />
                </View>
                {day.blocks.length ? (
                  <View style={styles.blockList}>
                    {day.blocks.map((block) => (
                      <Pressable key={block.id} onPress={() => toggleBlock(day.id, block.id)} style={[styles.block, { backgroundColor: block.complete ? colors.mintSoft : colors.cardStrong }]}>
                        <Icon name={block.complete ? 'check-circle' : MODALITY_ICONS[block.modality]} size={17} color={block.complete ? colors.mint : colors.primary} />
                        <Text style={[styles.blockLabel, { color: block.complete ? colors.textMuted : colors.textSecondary, textDecorationLine: block.complete ? 'line-through' : 'none' }]}>{block.label}</Text>
                        <Text style={[styles.blockMinutes, { color: colors.textMuted }]}>{block.minutes} min</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Card>
            </View>
          ))}
        </View>

        <Card style={styles.reminderCard}>
          <View style={[styles.reminderIcon, { backgroundColor: colors.primarySoft }]}><Icon name="bell-ring" color={colors.primary} size={21} /></View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.reminderTitle, { color: colors.text }]}>Notify me along the way</Text>
            <Text style={[styles.reminderText, { color: colors.textMuted }]}>A reminder near 6 PM on each active study day.</Text>
          </View>
          <Switch
            value={state.plan.remindersEnabled}
            onValueChange={(enabled) => void toggleReminders(enabled)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.primaryText}
          />
        </Card>
        {notice ? (
          <View style={[styles.notice, { backgroundColor: notice.tone === 'success' ? colors.mintSoft : `${colors.danger}14` }]}>
            <Icon name={notice.tone === 'success' ? 'check-circle' : 'alert-circle-outline'} color={notice.tone === 'success' ? colors.mint : colors.danger} size={18} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{notice.text}</Text>
          </View>
        ) : null}

        <SectionHeader title="Focus timer" action="Supporting tool" />
        <FocusTimer focusMinutes={state.focusMinutes} onRecord={(minutes) => {
          setFocusMinutes(minutes);
          recordStudyEvent({ type: 'focus', durationMinutes: 25 });
        }} />
      </Animated.View>
    </Screen>
  );
}

function FocusTimer({ focusMinutes, onRecord }: { focusMinutes: number; onRecord: (minutes: number) => void }) {
  const { colors } = useStudyBolt();
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const hasRecorded = useRef(false);
  const totalSeconds = mode === 'focus' ? 25 * 60 : 5 * 60;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (secondsLeft !== 0 || hasRecorded.current) return;
    setRunning(false);
    hasRecorded.current = true;
    if (mode === 'focus') onRecord(focusMinutes + 25);
  }, [focusMinutes, mode, onRecord, secondsLeft]);

  const switchMode = (nextMode: 'focus' | 'break') => {
    setMode(nextMode);
    setSecondsLeft(nextMode === 'focus' ? 25 * 60 : 5 * 60);
    setRunning(false);
    hasRecorded.current = false;
  };
  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <Card style={[styles.timerCard, { backgroundColor: colors.mode === 'dark' ? colors.purpleSoft : '#10152F' }]}>
      <View style={styles.timerModes}>
        {(['focus', 'break'] as const).map((item) => (
          <Pressable key={item} onPress={() => switchMode(item)} style={[styles.timerMode, mode === item && { backgroundColor: colors.purple }]}>
            <Text style={[styles.timerModeText, { color: mode === item ? colors.primaryText : '#B4BEC8' }]}>{item === 'focus' ? 'Focus' : 'Short Break'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.timerCenter}>
        <Text style={styles.timerValue}>{minutes}:{seconds}</Text>
        <Text style={styles.timerLabel}>{running ? 'Stay with one task' : 'Ready when you are'}</Text>
      </View>
      <ProgressBar progress={((totalSeconds - secondsLeft) / totalSeconds) * 100} color={colors.purple} />
      <PrimaryButton label={running ? 'Pause session' : secondsLeft === 0 ? 'Start again' : 'Start focus'} icon={running ? 'pause' : 'play'} onPress={() => {
        if (secondsLeft === 0) {
          setSecondsLeft(totalSeconds);
          hasRecorded.current = false;
        }
        setRunning((value) => !value);
      }} style={[styles.timerButton, { backgroundColor: colors.purple }]} />
    </Card>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const styles = StyleSheet.create({
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 5 },
  segmented: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentText: { fontSize: 12, fontWeight: '800' },
  choiceList: { gap: 8, marginTop: 10 },
  scopeChoice: { minHeight: 62, borderRadius: 16, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  scopeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scopeEmoji: { fontSize: 21 },
  scopeTitle: { fontSize: 13, fontWeight: '800' },
  scopeDetail: { fontSize: 10, marginTop: 3 },
  durationGrid: { flexDirection: 'row', gap: 7 },
  duration: { flex: 1, minHeight: 68, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  durationLabel: { fontSize: 13, fontWeight: '900' },
  durationDetail: { fontSize: 9, marginTop: 3 },
  recommendation: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  recommendationTitle: { fontSize: 12, fontWeight: '800' },
  recommendationText: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  modalityList: { gap: 8, marginTop: 9 },
  modality: { minHeight: 66, borderRadius: 16, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  modalityOrder: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalityOrderText: { fontSize: 10, fontWeight: '900' },
  modalityTitle: { fontSize: 12, fontWeight: '800' },
  modalityDetail: { fontSize: 9, marginTop: 2 },
  modalityMinutes: { fontSize: 10, fontWeight: '800' },
  planSummary: { marginTop: 18, padding: 19 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryEyebrow: { color: '#8FB5EE', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  summaryTitle: { color: '#EDF1F5', fontSize: 18, lineHeight: 23, fontWeight: '900', marginTop: 4 },
  summaryDetail: { color: '#C1CAD3', fontSize: 10, marginTop: 4 },
  timeBubble: { minWidth: 78, height: 65, borderRadius: 18, backgroundColor: '#FFFFFF14', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  timeValue: { color: '#EDF1F5', fontSize: 17, fontWeight: '900' },
  timeLabel: { color: '#AAB6C2', fontSize: 8, marginTop: 2 },
  summaryMetrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 },
  summaryMetric: { color: '#C6CED6', fontSize: 9, fontWeight: '700' },
  progressLabel: { color: '#AAB6C2', fontSize: 9, marginTop: 8 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 36, alignItems: 'center' },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 15 },
  timelineLine: { position: 'absolute', width: 2, top: 39, bottom: -15 },
  dayCard: { flex: 1, marginBottom: 11 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dayTitle: { fontSize: 14, fontWeight: '800' },
  daySubtitle: { fontSize: 10, marginTop: 3 },
  blockList: { marginTop: 12, gap: 7 },
  block: { minHeight: 38, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockLabel: { flex: 1, fontSize: 11, fontWeight: '600' },
  blockMinutes: { fontSize: 9 },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  reminderIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1 },
  reminderTitle: { fontSize: 13, fontWeight: '800' },
  reminderText: { fontSize: 10, marginTop: 3, lineHeight: 14 },
  notice: { marginTop: 9, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 14 },
  timerCard: { padding: 20 },
  timerModes: { flexDirection: 'row', gap: 8, alignSelf: 'center', backgroundColor: '#18202A', borderRadius: 14, padding: 4 },
  timerMode: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 11 },
  timerModeText: { fontSize: 11, fontWeight: '800' },
  timerCenter: { alignItems: 'center', paddingVertical: 24 },
  timerValue: { color: '#EDF1F5', fontSize: 50, lineHeight: 56, fontWeight: '300', letterSpacing: -1 },
  timerLabel: { color: '#B4BEC8', fontSize: 11, marginTop: 4 },
  timerButton: { marginTop: 18, backgroundColor: '#8D6BFF' },
});
