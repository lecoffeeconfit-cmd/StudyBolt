import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { StudyPlan } from '../models';
import { buildStudyPlan } from '../services/studyPlan';

const TARGETS: Array<{ id: StudyPlan['target']; label: string; detail: string }> = [
  { id: 'tomorrow', label: 'Tomorrow', detail: 'Focused sprint' },
  { id: 'two-days', label: 'In 2 Days', detail: 'Balanced review' },
  { id: 'one-week', label: 'In 1 Week', detail: 'Spaced practice' },
  { id: 'custom', label: 'Custom', detail: '4-day sample' },
];

export function PlannerScreen() {
  const { colors, state, setPlan } = useStudyBolt();
  const selectTarget = (target: StudyPlan['target']) => setPlan(buildStudyPlan(target, state.decks.slice(0, 2)));
  const totalMinutes = state.plan.days.reduce((sum, day) => sum + day.minutes, 0);

  return (
    <Screen>
      <Header title="Planner" right={<Pill label="Evidence-informed" tone="mint" />} />
      <Text style={[styles.title, { color: colors.text }]}>When do you need to know it?</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose a goal and StudyBolt will divide the material into realistic retrieval sessions.</Text>

      <View style={styles.targets}>
        {TARGETS.map((target) => {
          const selected = state.plan.target === target.id;
          return (
            <Pressable
              key={target.id}
              onPress={() => selectTarget(target.id)}
              style={[
                styles.target,
                { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border },
              ]}
            >
              <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.textMuted }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.targetLabel, { color: colors.text }]}>{target.label}</Text>
                <Text style={[styles.targetDetail, { color: colors.textMuted }]}>{target.detail}</Text>
              </View>
              {selected ? <Icon name="check-circle" color={colors.primary} size={22} /> : null}
            </Pressable>
          );
        })}
      </View>

      <Card style={[styles.scienceCard, { backgroundColor: colors.mintSoft }]}>
        <Icon name="sprout" color={colors.mint} size={26} />
        <Text style={[styles.scienceText, { color: colors.textSecondary }]}>Short retrieval sessions are spaced across your timeline, with extra attention given to weak concepts.</Text>
      </Card>

      <SectionHeader title="Your study plan" action={`≈ ${formatMinutes(totalMinutes)} total`} />
      <View style={styles.timeline}>
        {state.plan.days.map((day, index) => (
          <View key={day.id} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, { backgroundColor: index === 0 ? colors.primary : colors.mint }]}>
                <Icon name={day.complete ? 'check' : index === 0 ? 'lightning-bolt' : 'clock-outline'} size={13} color="#FFFFFF" />
              </View>
              {index < state.plan.days.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
            </View>
            <Card style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={[styles.dayTitle, { color: colors.text }]}>{day.label}</Text>
                  <Text style={[styles.daySubtitle, { color: colors.textMuted }]}>{day.subtitle}</Text>
                </View>
                <Pill label={formatMinutes(day.minutes)} tone={index === 0 ? 'blue' : 'neutral'} />
              </View>
              <View style={styles.blockList}>
                {day.blocks.map((block) => (
                  <View key={block.label} style={styles.block}>
                    <Icon name="checkbox-blank-circle-outline" size={15} color={colors.textMuted} />
                    <Text style={[styles.blockLabel, { color: colors.textSecondary }]}>{block.label}</Text>
                    <Text style={[styles.blockMinutes, { color: colors.textMuted }]}>{block.minutes} min</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        ))}
      </View>

      <Card style={styles.reminderCard}>
        <View style={[styles.reminderIcon, { backgroundColor: colors.primarySoft }]}><Icon name="bell-ring" color={colors.primary} size={21} /></View>
        <View style={styles.reminderCopy}>
          <Text style={[styles.reminderTitle, { color: colors.text }]}>Smart reminders</Text>
          <Text style={[styles.reminderText, { color: colors.textMuted }]}>Save your reminder preference for this plan.</Text>
        </View>
        <Switch
          value={state.plan.remindersEnabled}
          onValueChange={(remindersEnabled) => setPlan({ ...state.plan, remindersEnabled })}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </Card>

      <SectionHeader title="Focus timer" action="Supporting tool" />
      <FocusTimer />
    </Screen>
  );
}

function FocusTimer() {
  const { colors, state, setFocusMinutes } = useStudyBolt();
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
    if (mode === 'focus') setFocusMinutes(state.focusMinutes + 25);
  }, [mode, secondsLeft, setFocusMinutes, state.focusMinutes]);

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
            <Text style={[styles.timerModeText, { color: mode === item ? '#FFFFFF' : '#AEB4D2' }]}>{item === 'focus' ? 'Focus' : 'Short Break'}</Text>
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
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const styles = StyleSheet.create({
  title: { fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  targets: { gap: 9, marginTop: 20 },
  target: { minHeight: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  targetLabel: { fontSize: 14, fontWeight: '800' },
  targetDetail: { fontSize: 10, marginTop: 2 },
  scienceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  scienceText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 36, alignItems: 'center' },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 15 },
  timelineLine: { position: 'absolute', width: 2, top: 39, bottom: -15 },
  dayCard: { flex: 1, marginBottom: 11 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayTitle: { fontSize: 14, fontWeight: '800' },
  daySubtitle: { fontSize: 10, marginTop: 3 },
  blockList: { marginTop: 12, gap: 9 },
  block: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockLabel: { flex: 1, fontSize: 12 },
  blockMinutes: { fontSize: 10 },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  reminderIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1 },
  reminderTitle: { fontSize: 13, fontWeight: '800' },
  reminderText: { fontSize: 10, marginTop: 3 },
  timerCard: { padding: 20 },
  timerModes: { flexDirection: 'row', gap: 8, alignSelf: 'center', backgroundColor: '#1B2040', borderRadius: 14, padding: 4 },
  timerMode: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 11 },
  timerModeText: { fontSize: 11, fontWeight: '800' },
  timerCenter: { alignItems: 'center', paddingVertical: 24 },
  timerValue: { color: '#FFFFFF', fontSize: 50, lineHeight: 56, fontWeight: '300', letterSpacing: -1 },
  timerLabel: { color: '#AEB4D2', fontSize: 11, marginTop: 4 },
  timerButton: { marginTop: 18, backgroundColor: '#8D6BFF' },
});
