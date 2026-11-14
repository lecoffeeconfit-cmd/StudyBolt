import { PolishedSectionHeader as SectionHeader } from '../components/PagePresentation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { typography } from '../theme';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomTabBarTop } from '../components/BottomTabs';

import { Card, Header, Icon, Pill, PrimaryButton, ProgressBar } from '../components/ui';
import { SubjectIcon } from '../components/SubjectIcon';
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
  rebalanceMissedStudyPlan,
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

const DAY_MS = 24 * 60 * 60 * 1000;

function getCalendarDayOffset(dateInput: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const target = new Date(year, month - 1, day, 12);
  if (target.getFullYear() !== year || target.getMonth() !== month - 1 || target.getDate() !== day) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetOrdinal = Date.UTC(year, month - 1, day);
  const todayOrdinal = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((targetOrdinal - todayOrdinal) / DAY_MS);
}

function toDateInputValue(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(+date)) return '';
  const input = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return (getCalendarDayOffset(input) ?? -1) >= 0 ? input : '';
}

function getRemainingPlanDays(targetDate?: string): number | null {
  const input = toDateInputValue(targetDate);
  const offset = input ? getCalendarDayOffset(input) : null;
  return offset !== null && offset >= 0 ? offset + 1 : null;
}

function formatPlanDayDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(+date)) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function PlannerScreen({ focusDeckId, onFocusApplied }: { focusDeckId?: string; onFocusApplied?: () => void }) {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.3;
  const compactOptions = width < 360 || largeText;
  const { colors, recordStudyEvent, state, setPlan, setFocusMinutes } = useStudyBolt();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [examDate, setExamDate] = useState(() => toDateInputValue(state.plan.targetDate));
  const [examTitle, setExamTitle] = useState(() => state.plan.exam?.title ?? '');
  const [examNotice, setExamNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [showStudyOptions, setShowStudyOptions] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const dateField = useRef<TextInput>(null);
  const appliedFocus = useRef<string | undefined>(undefined);
  const entrance = useRef(new Animated.Value(1)).current;

  const decksForScope = useCallback((scope: StudyScope): StudyPack[] => scope.type === 'deck'
    ? state.decks.filter((deck) => deck.id === scope.id)
    : state.decks.filter((deck) => deck.courseId === scope.id), [state.decks]);

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion]);

  useEffect(() => {
    const adjusted = rebalanceMissedStudyPlan(state.plan);
    if (adjusted !== state.plan) {
      setPlan(adjusted);
      setNotice({ tone: 'success', text: 'Missed work was redistributed across your remaining study days.' });
    }
  }, [setPlan, state.plan]);

  useEffect(() => {
    setExamDate(toDateInputValue(state.plan.targetDate));
    setExamTitle(state.plan.exam?.title ?? '');
  }, [state.plan.exam?.title, state.plan.targetDate]);

  useEffect(() => {
    if (!focusDeckId || appliedFocus.current === focusDeckId) return;
    const deck = state.decks.find((item) => item.id === focusDeckId);
    if (!deck) return;
    appliedFocus.current = focusDeckId;
    void disableStudyReminders();
    setPlan({ ...buildStudyPlan([deck], {
      durationDays: getRemainingPlanDays(state.plan.targetDate) ?? state.plan.durationDays,
      scope: { type: 'deck', id: deck.id },
      modalities: state.plan.modalities.length ? state.plan.modalities : RECOMMENDED_MODALITIES,
      quizQuestionCount: state.quizQuestionCount,
      remindersEnabled: false,
    }), exam: state.plan.exam });
    onFocusApplied?.();
  }, [focusDeckId, onFocusApplied, setPlan, state.decks, state.plan.durationDays, state.plan.modalities, state.plan.targetDate, state.plan.exam, state.quizQuestionCount]);

  const selectedDecks = useMemo(() => decksForScope(state.plan.scope), [decksForScope, state.plan.scope]);
  const subject = state.plan.scope.type === 'deck'
    ? selectedDecks[0]?.title ?? 'your Study Pack'
    : state.classes.find((item) => item.id === state.plan.scope.id)?.name ?? selectedDecks[0]?.courseName ?? 'your class';
  const estimates = useMemo(
    () => estimateStudyMinutesByModality(selectedDecks, state.quizQuestionCount),
    [selectedDecks, state.quizQuestionCount],
  );
  const totalMinutes = state.plan.days.reduce((sum, day) => sum + day.minutes, 0);
  const activeDayCount = Math.max(1, state.plan.days.filter((day) => day.minutes > 0).length);
  const remainingPlanDays = getRemainingPlanDays(state.plan.targetDate);
  const examDateOffset = getCalendarDayOffset(examDate);
  const examDateIsBuildable = examDateOffset !== null && examDateOffset >= 0 && examDateOffset < 90;
  const planProgress = getPlanProgress(state.plan);
  const mastery = calculateCourseMastery(selectedDecks);
  const planPreview = useMemo(() => {
    if (!examDateIsBuildable || examDateOffset === null || !selectedDecks.length || !state.plan.modalities.length) return null;
    if (toDateInputValue(state.plan.targetDate) === examDate) return state.plan;
    return buildStudyPlan(selectedDecks, {
      durationDays: examDateOffset + 1,
      scope: state.plan.scope,
      modalities: state.plan.modalities,
      quizQuestionCount: state.quizQuestionCount,
      remindersEnabled: false,
    });
  }, [examDate, examDateIsBuildable, examDateOffset, selectedDecks, state.plan, state.quizQuestionCount]);
  const previewTotalMinutes = planPreview?.days.reduce((sum, day) => sum + day.minutes, 0) ?? 0;
  const previewActiveDays = Math.max(1, planPreview?.days.filter((day) => day.minutes > 0).length ?? 0);

  const applyPlan = useCallback((scope: StudyScope, durationDays?: number, modalities = state.plan.modalities, exam = durationDays === undefined ? state.plan.exam : undefined) => {
    const decks = decksForScope(scope);
    if (!decks.length || !modalities.length) return;
    const planDays = durationDays ?? getRemainingPlanDays(state.plan.targetDate) ?? state.plan.durationDays;
    const next = { ...buildStudyPlan(decks, {
      durationDays: planDays,
      scope,
      modalities,
      quizQuestionCount: state.quizQuestionCount,
      remindersEnabled: state.plan.remindersEnabled,
    }), exam };
    setPlan(next);
    setNotice(null);
    setExamNotice(null);
    if (next.remindersEnabled) {
      void scheduleStudyPlanReminders(next, scope.type === 'deck' ? decks[0]?.title ?? 'your PowerPoint' : decks[0]?.courseName ?? 'your class')
        .then((result) => {
          if (result.error) {
            setPlan({ ...next, remindersEnabled: false });
            setNotice({ tone: 'error', text: result.error });
          }
        });
    }
  }, [decksForScope, setPlan, state.plan.durationDays, state.plan.modalities, state.plan.remindersEnabled, state.plan.targetDate, state.plan.exam, state.quizQuestionCount]);

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
    applyPlan(state.plan.scope, undefined, next);
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

  const applyExamDate = () => {
    if (!examDateIsBuildable) {
      setExamNotice({ tone: 'error', text: examDateOffset === null ? 'Enter a real date in YYYY-MM-DD format.' : examDateOffset < 0 ? 'Choose today or a future date.' : 'Choose a test date within the next 90 days.' });
      return;
    }
    if (!selectedDecks.length) {
      setExamNotice({ tone: 'error', text: 'Add a study pack, then choose it under Edit plan.' });
      return;
    }
    const days = (examDateOffset ?? 0) + 1;
    applyPlan(state.plan.scope, days, state.plan.modalities, { date: examDate, title: examTitle.trim() || undefined });
    const target = new Date(`${examDate}T12:00:00`);
    const readableDate = target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    setExamNotice({ tone: 'success', text: `Your ${days}-day study plan is set through ${readableDate}. It will rebalance as you study.` });
  };

  const canBuild = examDateIsBuildable && selectedDecks.length > 0;
  const invalidDate = Boolean(examDate.trim()) && !examDateIsBuildable;
  const dateHelper = !selectedDecks.length
    ? 'Choose a Study Pack to build a plan.'
    : !examDate.trim()
      ? 'Enter a test date within the next 90 days.'
      : examDateOffset === null
        ? 'Use a real date in YYYY-MM-DD format.'
        : examDateOffset < 0
          ? 'Choose today or a future date.'
          : examDateOffset >= 90
            ? 'Choose a test date within the next 90 days.'
            : `${new Date(`${examDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${examDateOffset + 1} plan day${examDateOffset === 0 ? '' : 's'} · about ${Math.max(1, Math.ceil(previewTotalMinutes / previewActiveDays))} min per study day`;
  const packCount = `${selectedDecks.length} Study Pack${selectedDecks.length === 1 ? '' : 's'}`;
  const sampleRoute = selectedDecks.length > 0 && selectedDecks.every(deck => deck.fileType === 'demo');
  const routeStatus = remainingPlanDays === null ? 'No test date' : `${remainingPlanDays}-day window`;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: Math.max(120, bottomTabBarTop(insets.bottom) + 32),
        paddingLeft: Math.max(16, insets.left + 8),
        paddingRight: Math.max(16, insets.right + 8),
      }}
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[
        styles.content,
        {
          opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
        },
      ]}>
        <Header title="Planner" />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Study plan</Text>

        <Card style={[styles.majorCard, styles.planSummary, { backgroundColor: colors.primarySoft, borderColor: colors.mode === 'dark' ? colors.border : '#CBDCF4' }]}>
          <View style={styles.summaryTop}>
            <View style={styles.routeLabel}>
              <View style={[styles.routeIcon, { backgroundColor: colors.card }]}>
                <Icon name="map-marker-path" size={19} color={colors.primary} />
              </View>
              <Text style={[styles.summaryEyebrow, { color: colors.primary }]}>{sampleRoute ? 'Sample route' : 'Your route'}</Text>
            </View>
            <Pill label={routeStatus} tone={remainingPlanDays === null ? 'neutral' : 'blue'} />
          </View>
          <Text accessibilityRole="header" style={[styles.summaryTitle, { color: colors.text }]}>
            {selectedDecks.length ? subject : 'No study material selected'}
          </Text>
          <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>{packCount}</Text>

          <View style={[styles.summaryMetrics, largeText && styles.stacked, { borderColor: colors.border }]}>
            <RouteMetric label="Estimated total" value={formatMinutes(totalMinutes)} stacked={largeText} />
            <RouteMetric label="Per study day" value={`≈ ${formatMinutes(Math.ceil(totalMinutes / activeDayCount))}`} stacked={largeText} />
            <RouteMetric label="Study estimate" value={`${mastery}%`} stacked={largeText} />
          </View>

          <View style={styles.progressHeading}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Plan completion</Text>
            <Text style={[styles.progressValue, { color: planProgress > 0 ? colors.mint : colors.text }]}>{planProgress}%</Text>
          </View>
          <PlanCompletion progress={planProgress} reducedMotion={reducedMotion} />
        </Card>

        <Card style={[styles.majorCard, styles.testCard, { borderColor: colors.mode === 'dark' ? colors.border : '#D7E1F0' }]}>
          <View style={styles.examModeHeading}>
            <View style={[styles.examModeIcon, { backgroundColor: colors.goldSoft }]}>
              <Icon name="school-outline" size={21} color={colors.goldText} />
            </View>
            <View style={styles.flexCopy}>
              <Text accessibilityRole="header" style={[styles.examModeTitle, { color: colors.text }]}>Study toward a test</Text>
              <Text style={[styles.examModeText, { color: colors.textSecondary }]}>Pace your material through test day.</Text>
            </View>
          </View>

          <View style={[styles.examSelection, { backgroundColor: colors.cardStrong }]}>
            <Text style={[styles.selectionTitle, { color: colors.text }]}>{selectedDecks.length ? subject : 'Choose a Study Pack'}</Text>
            <View style={styles.selectionHeader}>
              <Text style={[styles.selectionDetail, { color: colors.textSecondary }]}>
                {state.plan.scope.type === 'course' ? 'Entire class · ' : ''}{packCount} selected
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editingPlan ? 'Done choosing study material' : 'Change study material'}
                accessibilityState={{ expanded: editingPlan }}
                aria-expanded={editingPlan}
                onPress={() => setEditingPlan(value => !value)}
                style={({ pressed }) => [styles.changeSelection, { backgroundColor: colors.card }, pressed && styles.controlPressed]}
              >
                <Text style={[styles.changeSelectionText, { color: colors.primary }]}>{editingPlan ? 'Done' : 'Change'}</Text>
                <Icon name={editingPlan ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
              </Pressable>
            </View>
          </View>

          {editingPlan ? <View style={styles.materialEditor}>
            <View style={[styles.segmented, largeText && styles.stacked, { backgroundColor: colors.cardStrong }]}>
              {(['deck', 'course'] as const).map((type) => {
                const selected = state.plan.scope.type === type;
                return (
                  <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected }} key={type} onPress={() => chooseScopeType(type)} style={[styles.segment, largeText && styles.stackedSegment, selected && { backgroundColor: colors.card }]}>
                    <Icon name={type === 'deck' ? 'file-powerpoint-box' : 'bookshelf'} size={18} color={selected ? colors.primary : colors.textMuted} />
                    <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>{type === 'deck' ? 'One Study Pack' : 'Entire class'}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.choiceList}>
              {(state.plan.scope.type === 'deck' ? state.decks : state.classes).map((item) => {
                const id = item.id;
                const label = 'title' in item ? item.title : item.name;
                const detail = 'pageCount' in item ? `${item.courseName} · ${item.pageCount} slides` : `${state.decks.filter((deck) => deck.courseId === item.id).length} Study Packs`;
                const selected = state.plan.scope.id === id;
                return (
                  <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected }} key={id} onPress={() => applyPlan({ type: state.plan.scope.type, id })} style={[styles.scopeChoice, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                    <SubjectIcon subject={'courseName' in item ? item.courseName : item.name} emoji={item.emoji} size={40} />
                    <View style={styles.flexCopy}>
                      <Text style={[styles.scopeTitle, { color: colors.text }]}>{label}</Text>
                      <Text style={[styles.scopeDetail, { color: colors.textMuted }]}>{detail}</Text>
                    </View>
                    <Icon name={selected ? 'check-circle' : 'circle-outline'} color={selected ? colors.primary : colors.textMuted} size={22} />
                  </Pressable>
                );
              })}
            </View>

            {!state.decks.length ? <Text style={[styles.dateHelper, { color: colors.textSecondary }]}>Add study material from Home to see it here.</Text> : null}
          </View> : null}

          <View style={styles.testFields}>
            <View style={styles.field}>
              <Text style={[styles.dateFieldLabel, { color: colors.text }]}>Test name <Text style={{ color: colors.textMuted, fontWeight: '400' }}>· Optional</Text></Text>
              <TextInput
                accessibilityLabel="Test name, optional"
                value={examTitle}
                onChangeText={setExamTitle}
                placeholder="e.g. Midterm"
                placeholderTextColor={colors.textMuted}
                maxLength={80}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => dateField.current?.focus()}
                style={[styles.fieldInput, styles.fieldSurface, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.dateFieldLabel, { color: colors.text }]}>Test date</Text>
              <View style={[styles.dateInputWrap, styles.fieldSurface, { borderColor: invalidDate ? colors.danger : colors.border, backgroundColor: colors.card }]}>
                <Icon name="calendar-month-outline" size={18} color={colors.primary} />
                <TextInput
                  ref={dateField}
                  accessibilityLabel="Test date"
                  accessibilityHint="Enter the date as four-digit year, month, and day."
                  value={examDate}
                  onChangeText={(value) => { setExamDate(value); setExamNotice(null); }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                  maxLength={10}
                  style={[styles.fieldInput, styles.examDateInput, { color: colors.text }]}
                />
              </View>
            </View>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.dateHelper, { color: invalidDate ? colors.danger : colors.textMuted }]}>
            {dateHelper}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={remainingPlanDays === null ? 'Build study plan' : 'Update study plan'}
            accessibilityState={{ disabled: !canBuild }}
            accessibilityHint={canBuild ? 'Saves your dated study route.' : dateHelper}
            disabled={!canBuild}
            onPress={applyExamDate}
            style={({ pressed }) => [
              styles.examDateButton,
              { backgroundColor: canBuild ? colors.primary : colors.cardStrong, borderColor: canBuild ? colors.primary : colors.border },
              pressed && styles.controlPressed,
            ]}
          >
            <Text style={[styles.examDateButtonText, { color: canBuild ? colors.primaryText : colors.textMuted }]}>
              {remainingPlanDays === null ? 'Build plan' : 'Update plan'}
            </Text>
            <Icon name="arrow-right" size={18} color={canBuild ? colors.primaryText : colors.textMuted} />
          </Pressable>
          {examNotice ? (
            <View accessibilityLiveRegion="polite" style={[styles.examNotice, { backgroundColor: examNotice.tone === 'success' ? colors.mintSoft : `${colors.danger}14` }]}>
              <Icon name={examNotice.tone === 'success' ? 'check-circle' : 'alert-circle-outline'} color={examNotice.tone === 'success' ? colors.mint : colors.danger} size={16} />
              <Text style={[styles.examNoticeText, { color: colors.text }]}>{examNotice.text}</Text>
            </View>
          ) : null}
        </Card>

        <Pressable
          aria-expanded={showStudyOptions}
          accessibilityRole="button"
          accessibilityState={{ expanded: showStudyOptions }}
          onPress={() => setShowStudyOptions(value => !value)}
          style={({ pressed }) => [styles.editPlanButton, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.controlPressed]}
        >
          <Icon name="tune-variant" size={19} color={colors.primary} />
          <Text style={[styles.editPlanText, { color: colors.text }]}>Study window & methods</Text>
          <Icon name={showStudyOptions ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>

        {showStudyOptions ? <View style={styles.planControls}>
        <Text style={[styles.quickDeadlineLabel, { color: colors.textMuted }]}>OR USE A QUICK STUDY WINDOW</Text>
        <View style={[styles.durationGrid, compactOptions && styles.wrapOptions]}>
          {DURATIONS.map((duration) => {
            const selected = state.plan.durationDays === duration.days;
            return (
              <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityState={{ checked: selected }} key={duration.days} onPress={() => applyPlan(state.plan.scope, duration.days)} style={[styles.duration, compactOptions && styles.wideDuration, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
                <Text style={[styles.durationLabel, { color: selected ? colors.primaryText : colors.text }]}>{duration.label}</Text>
                <Text style={[styles.durationDetail, { color: selected ? colors.primaryText : colors.textMuted }]}>{duration.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionHeader title="Choose your study mix" action="Use recommended" onAction={() => applyPlan(state.plan.scope, undefined, RECOMMENDED_MODALITIES)} />
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
              <Pressable accessibilityRole="checkbox" aria-checked={selected} accessibilityState={{ checked: selected }} key={modality} onPress={() => toggleModality(modality)} style={[styles.modality, { backgroundColor: colors.card, borderColor: selected ? colors.primary : colors.border }]}>
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
        </View> : null}

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
              <Card style={[styles.dayCard, styles.flatCard, day.complete && { borderColor: colors.mint }]}>
                <View style={styles.dayHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayTitle, { color: colors.text }]}>{day.label}{formatPlanDayDate(day.date) ? ` · ${formatPlanDayDate(day.date)}` : ''}</Text>
                    <Text style={[styles.daySubtitle, { color: colors.textMuted }]}>{day.subtitle}</Text>
                  </View>
                  <Pill label={day.minutes ? formatMinutes(day.minutes) : 'Rest'} tone={day.complete ? 'mint' : index === 0 ? 'blue' : 'neutral'} />
                </View>
                {day.blocks.length ? (
                  <View style={styles.blockList}>
                    {day.blocks.map((block) => (
                      <Pressable accessibilityRole="checkbox" aria-checked={block.complete} accessibilityState={{ checked: block.complete }} key={block.id} onPress={() => toggleBlock(day.id, block.id)} style={[styles.block, { backgroundColor: block.complete ? colors.mintSoft : colors.cardStrong }]}>
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

        <Card style={[styles.reminderCard, styles.flatCard]}>
          <View style={[styles.reminderIcon, { backgroundColor: colors.primarySoft }]}><Icon name="bell-ring" color={colors.primary} size={21} /></View>
          <View style={styles.reminderCopy}>
            <Text style={[styles.reminderTitle, { color: colors.text }]}>Notify me along the way</Text>
            <Text style={[styles.reminderText, { color: colors.textMuted }]}>A reminder near 6 PM on each active study day.</Text>
          </View>
          <Switch
            accessibilityLabel="Study reminders"
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

        <Pressable aria-expanded={showTimer}
          accessibilityRole="button"
          accessibilityState={{ expanded: showTimer }}
          onPress={() => setShowTimer((value) => !value)}
          style={({ pressed }) => [styles.timerToggle, { backgroundColor: colors.cardStrong }, pressed && styles.controlPressed]}
        >
          <View style={[styles.timerToggleIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="timer-outline" size={20} color={colors.purple} /></View>
          <View style={{ flex: 1 }}><Text style={[styles.timerToggleTitle, { color: colors.text }]}>Focus timer</Text><Text style={[styles.timerToggleText, { color: colors.textMuted }]}>25-minute focus · 5-minute break</Text></View>
          <Icon name={showTimer ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </Pressable>
        {showTimer ? <FocusTimer focusMinutes={state.focusMinutes} onRecord={(minutes) => {
          setFocusMinutes(minutes);
          recordStudyEvent({ type: 'focus', durationMinutes: 25 });
        }} /> : null}
      </Animated.View>
    </ScrollView>
  );
}

function RouteMetric({ label, value, stacked }: { label: string; value: string; stacked: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={[styles.routeMetric, stacked && styles.routeMetricStacked]}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function PlanCompletion({ progress, reducedMotion }: { progress: number; reducedMotion: boolean }) {
  const { colors } = useStudyBolt();
  const fill = useRef(new Animated.Value(progress / 100)).current;
  useEffect(() => {
    if (reducedMotion) { fill.setValue(progress / 100); return; }
    const animation = Animated.timing(fill, {
      toValue: progress / 100,
      duration: 260,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [fill, progress, reducedMotion]);
  return (
    <View
      accessible
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      accessibilityRole="progressbar"
      accessibilityLabel="Plan completion"
      accessibilityValue={{ min: 0, max: 100, now: progress }}
      style={[styles.planTrack, { backgroundColor: colors.border }]}
    >
      <Animated.View style={[styles.planFill, { backgroundColor: colors.mint, transform: [{ scaleX: fill }] }]} />
    </View>
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
    <Card style={[styles.timerCard, styles.flatCard]}>
      <View style={[styles.timerModes, { backgroundColor: colors.cardStrong }]}>
        {(['focus', 'break'] as const).map((item) => (
          <Pressable accessibilityRole="button" key={item} onPress={() => switchMode(item)} style={[styles.timerMode, mode === item && { backgroundColor: colors.primary }]}>
            <Text style={[styles.timerModeText, { color: mode === item ? colors.primaryText : colors.textSecondary }]}>{item === 'focus' ? 'Focus' : 'Short Break'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.timerCenter}>
        <Text style={[styles.timerValue, { color: colors.text }]}>{minutes}:{seconds}</Text>
        <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>{running ? 'Stay with one task' : 'Ready when you are'}</Text>
      </View>
      <ProgressBar progress={((totalSeconds - secondsLeft) / totalSeconds) * 100} color={colors.primary} />
      <PrimaryButton label={running ? 'Pause session' : secondsLeft === 0 ? 'Start again' : 'Start focus'} icon={running ? 'pause' : 'play'} onPress={() => {
        if (secondsLeft === 0) {
          setSecondsLeft(totalSeconds);
          hasRecorded.current = false;
        }
        setRunning((value) => !value);
      }} style={styles.timerButton} />
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
  content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  flexCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.pageTitle, marginTop: 12 },
  majorCard: { padding: 16, borderRadius: 22, borderWidth: 1, shadowOpacity: 0.045, shadowRadius: 10 },
  planSummary: { marginTop: 12 },
  summaryTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  routeLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  routeIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summaryEyebrow: { ...typography.caption, fontWeight: '700', flexShrink: 1 },
  summaryTitle: { ...typography.sectionTitle, marginTop: 8 },
  summaryDetail: { ...typography.caption, marginTop: 2 },
  summaryMetrics: { flexDirection: 'row', gap: 8, marginTop: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  routeMetric: { flex: 1, minWidth: 0, gap: 2 },
  routeMetricStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  metricValue: { fontSize: 16, lineHeight: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  metricLabel: { ...typography.caption, flexShrink: 1 },
  progressHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 10, marginBottom: 6 },
  progressLabel: { ...typography.caption, fontWeight: '600' },
  progressValue: { ...typography.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  planTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  planFill: { height: '100%', width: '100%', borderRadius: 3, transformOrigin: 'left center' },
  testCard: { marginTop: 16 },
  examModeHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  examModeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  examModeTitle: { ...typography.sectionTitle },
  examModeText: { ...typography.secondary, marginTop: 2 },
  examSelection: { borderRadius: 14, padding: 12, marginTop: 16 },
  selectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 4 },
  selectionTitle: { ...typography.cardTitle },
  selectionDetail: { ...typography.caption, flexShrink: 1 },
  changeSelection: { minHeight: 44, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeSelectionText: { ...typography.secondary, fontWeight: '700', flexShrink: 1 },
  materialEditor: { marginTop: 8 },
  testFields: { gap: 12, marginTop: 16 },
  field: { gap: 6 },
  dateFieldLabel: { ...typography.secondary, fontWeight: '600' },
  fieldSurface: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  fieldInput: { ...typography.control, fontWeight: '400', paddingVertical: 11 },
  dateInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examDateInput: { flex: 1, minWidth: 0, paddingHorizontal: 0 },
  dateHelper: { ...typography.caption, marginTop: 8 },
  examDateButton: { minHeight: 50, borderWidth: 1, borderRadius: 13, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  examDateButtonText: { ...typography.control, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  examNotice: { marginTop: 12, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  examNoticeText: { ...typography.secondary, flex: 1 },
  planControls: { marginTop: 2 },
  editPlanButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  editPlanText: { flex: 1, ...typography.control },
  controlPressed: { opacity: 0.76 },
  segmented: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  stacked: { flexDirection: 'column' },
  segment: { flex: 1, minHeight: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 6, gap: 6 },
  stackedSegment: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto' },
  segmentText: { ...typography.caption, fontWeight: '700', flexShrink: 1 },
  choiceList: { gap: 8, marginTop: 8 },
  scopeChoice: { minHeight: 62, borderRadius: 14, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scopeTitle: { ...typography.secondary, fontWeight: '700' },
  scopeDetail: { ...typography.caption, marginTop: 2 },
  quickDeadlineLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.9, marginTop: 15, marginBottom: 8 },
  durationGrid: { flexDirection: 'row', gap: 7 },
  wrapOptions: { flexWrap: 'wrap' },
  wideDuration: { flexBasis: '45%', flexGrow: 1 },
  duration: { flex: 1, minHeight: 62, minWidth: 0, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 4 },
  durationLabel: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  durationDetail: { ...typography.caption, marginTop: 2, textAlign: 'center' },
  recommendation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, padding: 18, borderRadius: 20 },
  recommendationTitle: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  recommendationText: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  modalityList: { gap: 8, marginTop: 9 },
  modality: { minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 15 },
  modalityOrder: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalityOrderText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  modalityTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  modalityDetail: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  modalityMinutes: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row' },
  timelineRail: { width: 36, alignItems: 'center' },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 15 },
  timelineLine: { position: 'absolute', width: 2, top: 39, bottom: -15 },
  dayCard: { flex: 1, marginBottom: 11 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dayTitle: { fontSize: 14, fontWeight: '800' },
  daySubtitle: { ...typography.secondary, marginTop: 2 },
  blockList: { marginTop: 12, gap: 7 },
  block: { minHeight: 44, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockLabel: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  blockMinutes: { fontSize: 12, lineHeight: 18 },
  reminderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  reminderIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reminderCopy: { flex: 1 },
  reminderTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  reminderText: { fontSize: 14, marginTop: 3, lineHeight: 21 },
  notice: { marginTop: 9, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 21 },
  timerToggle: { minHeight: 64, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, marginTop: 18 },
  timerToggleIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timerToggleTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  timerToggleText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  timerCard: { padding: 20, marginTop: 8, borderRadius: 22 },
  timerModes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 4 },
  timerMode: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 11 },
  timerModeText: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  timerCenter: { alignItems: 'center', paddingVertical: 24 },
  timerValue: { fontSize: 50, lineHeight: 56, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  timerButton: { marginTop: 16 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
});
