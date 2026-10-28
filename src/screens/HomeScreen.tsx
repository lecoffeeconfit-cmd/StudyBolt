import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import { DOCUMENT_PICKER_TYPE, getImportDocumentType, pageLabel } from '../services/documentTypes';
import {
  DEFAULT_STUDY_TIMER_SETTINGS,
  loadStudyTimerSettings,
  studyTimerMethodLabel,
  subscribeToStudyTimerSettings,
  type StudyTimerSettings,
} from '../services/studyTimer';
import { Card, Header, Icon, Pill, Screen, SectionHeader } from '../components/ui';
import { SubjectIcon } from '../components/SubjectIcon';
import { AddStudyMaterialCard } from '../components/AddStudyMaterialCard';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { findHomeAudioResume } from '../services/homeStudy';
import { buildHomeDashboard } from '../services/homeDashboard';
import type { HomeDueReview, HomeWeakTopic } from '../services/homeDashboard';
import { getRetentionCardSchedule } from '../services/retentionScheduler';
import { HomePrioritySheet, RecentLearningCard, UpcomingExamCard } from '../components/HomeLearningCards';
import type { HomePriority } from '../components/TodaysPlanCard';
import { TodaysPlanCard } from '../components/TodaysPlanCard';
import { useAuth } from '../AuthContext';

const POMODORO_STORAGE_KEY = '@studybolt/pomodoro-timer/v1';

type PomodoroPhase = 'focus' | 'break';
type PomodoroSession = {
  phase: PomodoroPhase;
  status: 'running' | 'paused' | 'complete';
  endAt: number | null;
  remainingSeconds: number;
  notificationId?: string;
  alarmAvailable?: boolean;
  durationMinutes?: number;
  methodLabel?: string;
  recorded?: boolean;
  alerted?: boolean;
};

async function schedulePomodoroAlarm(phase: PomodoroPhase, endAt: number, requestPermission: boolean, settings: StudyTimerSettings) {
  if (Platform.OS === 'web') return { notificationId: undefined, available: false };

  try {
    const channelId = `study-timer-${settings.alarmMode}`;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: settings.alarmMode === 'sound-vibration' ? 'Study timer alarms' : settings.alarmMode === 'vibration' ? 'Study timer vibration' : 'Study timer silent alerts',
        importance: settings.alarmMode === 'silent' ? Notifications.AndroidImportance.DEFAULT : Notifications.AndroidImportance.HIGH,
        sound: settings.alarmMode === 'sound-vibration' ? 'default' : null,
        enableVibrate: settings.alarmMode !== 'silent',
        vibrationPattern: settings.alarmMode !== 'silent' ? [0, 250, 250, 250] : undefined,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const status = current.status === 'granted' || !requestPermission
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return { notificationId: undefined, available: false };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: phase === 'focus' ? 'Focus session complete' : 'Break is over',
        body: phase === 'focus' ? `Nice work. Take a ${settings.breakMinutes}-minute break.` : `Ready for another ${settings.focusMinutes}-minute focus session?`,
        sound: settings.alarmMode === 'sound-vibration' ? 'default' : false,
        data: { studyBolt: true, type: 'pomodoro', phase, alarmMode: settings.alarmMode },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endAt),
        channelId: Platform.OS === 'android' ? channelId : undefined,
      },
    });
    return { notificationId, available: true };
  } catch {
    return { notificationId: undefined, available: false };
  }
}

async function cancelPomodoroAlarm(notificationId?: string) {
  if (Platform.OS === 'web' || !notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

export function HomeScreen({
  onOpenDeck,
  onImport,
  onStartStudy,
  onOpenMistakes,
  onOpenFlagged,
  onOpenPlanner,
  onPracticeTest,
  onOpenLibrary,
  onOpenStats,
}: {
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onImport: (assets: ImportAsset[]) => void;
  onStartStudy: (mode: SmartStudyMode, focus?: { deckId: string; sectionIds?: string[] }) => void;
  onOpenMistakes: (itemIds?: string[]) => void;
  onOpenFlagged: () => void;
  onOpenPlanner: () => void;
  onPracticeTest: (deckId?: string) => void;
  onOpenLibrary: () => void;
  onOpenStats: () => void;
}) {
  const { colors, state, setTheme } = useStudyBolt();
  const { user } = useAuth();
  const avatarInitial = user?.email?.[0]?.toUpperCase();
  const [now, setNow] = useState(() => new Date());
  const [priority, setPriority] = useState<HomePriority | 'flashcards' | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', (next) => { if (next === 'active') setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const academicState = useMemo(() => ({ ...state, decks: state.decks.filter((deck) => deck.fileType !== 'demo'), activityEvents: state.activityEvents.filter((event) => !event.id.startsWith('seed-')) }), [state]);
  const resumeDeck = useMemo(() => findHomeAudioResume(academicState), [academicState]);
  const dashboard = useMemo(() => buildHomeDashboard(state, {
    now, resumeDeckId: resumeDeck?.id,
    scheduleCard: (deckId, cardId) => getRetentionCardSchedule(academicState, deckId, cardId, state.retentionMode === 'standard' ? 'sm2' : state.retentionMode, now),
  }), [state, academicState, now, resumeDeck?.id]);
  const importInFlight = useRef(false);
  const today = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const recentMaterials = (dashboard.decks.length ? dashboard.decks : state.decks).slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 2);
  const failedPack = dashboard.decks.find((deck) => deck.generation && Object.values(deck.generation.materials).some((material) => material.status === 'failed'));

  const pickDocument = async () => {
    if (importInFlight.current) return;
    importInFlight.current = true;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: DOCUMENT_PICKER_TYPE,
        copyToCacheDirectory: true,
        multiple: true,
        // Keep the browser's File object instead of eagerly reading a second
        // base64 copy into memory before the multipart upload starts.
        base64: false,
      });
      if (result.canceled) return;
      const assets = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file }));
      if (!assets.length) return;
      if (assets.length > 1 && assets.some((asset) => getImportDocumentType(asset.name, asset.mimeType) !== 'powerpoint')) {
        Alert.alert('Choose PowerPoints together', 'To create one integrated Study Pack, select only PowerPoint files. Other file types can be imported one at a time.');
        return;
      }
      onImport(assets);
    } catch {
      Alert.alert('Couldn’t open files', 'Check file permissions, then try again.');
    } finally {
      importInFlight.current = false;
    }
  };

  const reviewDue = (group: HomeDueReview) => onOpenDeck(group.deck, 'flashcards', group.cardIds);
  const studyWeak = (topic: HomeWeakTopic) => topic.cardIds.length
    ? onStartStudy('smart', { deckId: topic.deck.id, sectionIds: [topic.sectionId] })
    : onOpenDeck(topic.deck, 'notes');
  const practice = () => dashboard.decks.length ? onPracticeTest(dashboard.decks.find((deck) => deck.quiz.length || deck.flashcards.length)?.id) : void pickDocument();
  const startRecommended = () => {
    const next = dashboard.recommendation;
    const deck = dashboard.decks.find((item) => item.id === next.deckId);
    if (next.kind === 'materials') return pickDocument();
    if (next.kind === 'mistakes') return onOpenMistakes(dashboard.mistakeIds);
    if (!deck) return onOpenLibrary();
    if (next.kind === 'resume') return onOpenDeck(deck, 'audio');
    if (next.kind === 'due') return onOpenDeck(deck, 'flashcards', next.cardIds);
    if (next.kind === 'weak' && next.sectionId) {
      if (!next.cardIds?.length) return onOpenDeck(deck, 'notes');
      return onStartStudy('smart', { deckId: deck.id, sectionIds: [next.sectionId] });
    }
    return deck.flashcards.length ? onStartStudy('smart', { deckId: deck.id }) : onOpenDeck(deck, 'notes');
  };

  return (
    <Screen>
      <Header
        title="Study Bolt"
        right={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${colors.mode === 'dark' ? 'light' : 'dark'} mode`}
              onPress={() => setTheme(colors.mode === 'dark' ? 'light' : 'dark')}
              style={[styles.roundButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Icon name={colors.mode === 'dark' ? 'weather-sunny' : 'weather-night'} size={19} color={colors.mode === 'dark' ? colors.warning : colors.primary} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: colors.mintSoft }]}>
              {avatarInitial ? <Text style={[styles.avatarText, { color: colors.mode === 'dark' ? '#A4E0CE' : '#12775E' }]}>{avatarInitial}</Text> : <Icon name="account-outline" size={21} color={colors.mode === 'dark' ? '#A4E0CE' : '#12775E'} />}
            </View>
          </View>
        }
      />

      <View style={styles.heroCopy}>
        <View style={styles.dateRow}>
          <Icon name="lightning-bolt" size={12} color={colors.goldText} />
          <Text style={[styles.date, { color: colors.textSecondary }]}>{today.toUpperCase()}</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Ready when you are</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Let’s build on what you know.</Text>
      </View>

      <TodaysPlanCard dashboard={dashboard} colors={colors} onStartSession={startRecommended} onOpenPriority={setPriority} />

      <AddStudyMaterialCard colors={colors} onPress={pickDocument} compact={dashboard.decks.length > 0} />
      {failedPack ? <Card onPress={() => onOpenDeck(failedPack)} style={[styles.statusCard, { backgroundColor: colors.goldSoft }]}><Icon name="information-outline" color={colors.goldText} size={20} /><Text style={[styles.statusText, { color: colors.text }]}>Some tools in {failedPack.title} need another try. Open the pack to retry generation.</Text><Icon name="chevron-right" color={colors.goldText} size={18} /></Card> : null}
      <UpcomingExamCard exam={dashboard.exam} onOpenPlan={onOpenPlanner} />

      <Text accessibilityRole="header" style={[styles.sectionLabel, { color: colors.text }]}>Quick start</Text>
      <View style={styles.quickActions}>
        <QuickAction icon="clipboard-check-outline" label="Practice Test" detail="Test what you know" color={colors.primary} background={colors.primarySoft} onPress={practice} />
        <QuickAction icon="book-alert-outline" label="Review Mistakes" detail="Retry missed questions" color={colors.purple} background={colors.purpleSoft} onPress={() => setPriority('mistakes')} />
        <QuickAction icon="cards-outline" label="Flashcards" detail="Practice active recall" color={colors.mode === 'dark' ? colors.mint : '#187D68'} background={colors.mintSoft} onPress={() => setPriority('flashcards')} />
        <QuickAction icon="bookshelf" label="Study Materials" detail="Continue learning" color={colors.goldText} background={colors.goldSoft} onPress={onOpenLibrary} />
      </View>
      <View style={styles.moreTools}>
        <Pressable accessibilityRole="button" onPress={() => dashboard.decks.length ? onStartStudy('cram', { deckId: dashboard.decks[0]!.id }) : void pickDocument()} style={styles.moreTool}><Icon name="fire" color={colors.goldText} size={17} /><Text style={[styles.moreToolText, { color: colors.textSecondary }]}>Cram review</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onOpenFlagged} style={styles.moreTool}><Icon name="flag-outline" color={colors.purple} size={17} /><Text style={[styles.moreToolText, { color: colors.textSecondary }]}>Saved items</Text></Pressable>
      </View>
      <RecentLearningCard activity={dashboard.activity} onOpenStats={onOpenStats} onStart={() => { void startRecommended(); }} />
      <Text accessibilityRole="header" style={[styles.sectionLabel, { color: colors.text }]}>Make room to focus</Text>
      <PomodoroTimerCard />
      <SectionHeader title={dashboard.decks.length ? 'Recent materials' : 'Explore sample materials'} action="Library" onAction={onOpenLibrary} />
      <View style={styles.deckList}>
        {!recentMaterials.length ? <Text style={[styles.emptyMaterials, { color: colors.textSecondary }]}>Your Study Packs will appear here after you import materials.</Text> : null}
        {recentMaterials.map((deck) => <RecentDeck key={deck.id} deck={deck} onPress={() => onOpenDeck(deck)} />)}
      </View>
      <Text style={[styles.localNote, { color: colors.textSecondary }]}>Your saved study material and learning activity are available offline. AI features may require a connection.</Text>
      <HomePrioritySheet kind={priority} dashboard={dashboard} onClose={() => setPriority(null)} onDue={reviewDue} onWeak={studyWeak} onMistakes={() => onOpenMistakes(dashboard.mistakeIds)} onFlashcards={(deck) => onOpenDeck(deck, 'flashcards')} onPractice={practice} />
    </Screen>
  );
}

function PomodoroTimerCard() {
  const { colors, state, setFocusMinutes, recordStudyEvent } = useStudyBolt();
  const { width, fontScale } = useWindowDimensions();
  const stackedTimer = width < 370 || fontScale >= 1.3;
  const startingRef = useRef(false);
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [timerSettings, setTimerSettings] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [clock, setClock] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const remainingSeconds = session?.status === 'running' && session.endAt
    ? Math.max(0, Math.ceil((session.endAt - clock) / 1000))
    : session?.remainingSeconds ?? timerSettings.focusMinutes * 60;
  const timeLabel = `${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToStudyTimerSettings((next) => {
      if (mounted) setTimerSettings(next);
    });
    void loadStudyTimerSettings().then((next) => {
      if (!mounted) return;
      setTimerSettings(next);
      setSettingsReady(true);
    }).catch(() => {
      if (mounted) setSettingsReady(true);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(POMODORO_STORAGE_KEY).then(async (raw) => {
      if (!mounted) return;
      if (raw) {
        try {
          const saved = JSON.parse(raw) as PomodoroSession;
          if ((saved.phase === 'focus' || saved.phase === 'break')
            && ['running', 'paused', 'complete'].includes(saved.status)
            && Number.isFinite(saved.remainingSeconds)) {
            const restored = saved.status === 'running' && (!saved.endAt || saved.endAt <= Date.now())
              ? { ...saved, status: 'complete' as const, endAt: null, remainingSeconds: 0, notificationId: undefined }
              : saved;
            setSession(restored);
            if (restored !== saved) await AsyncStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(restored));
          } else {
            await AsyncStorage.removeItem(POMODORO_STORAGE_KEY);
          }
        } catch {
          await AsyncStorage.removeItem(POMODORO_STORAGE_KEY);
        }
      }
      if (mounted) setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || session?.status !== 'running') return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const appStateSubscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') setClock(Date.now());
    });
    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [ready, session?.status]);

  useEffect(() => {
    if (!ready || session?.status !== 'running' || remainingSeconds > 0) return;
    const completed: PomodoroSession = { ...session, status: 'complete', endAt: null, remainingSeconds: 0, notificationId: undefined };
    setSession(completed);
    void AsyncStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(completed)).catch(() => undefined);
  }, [ready, remainingSeconds, session]);

  useEffect(() => {
    if (session?.status !== 'complete') return;
    const completed = { ...session };
    let changed = false;
    if (session.phase === 'focus' && !session.recorded) {
      completed.recorded = true;
      changed = true;
      const durationMinutes = session.durationMinutes ?? DEFAULT_STUDY_TIMER_SETTINGS.focusMinutes;
      setFocusMinutes(state.focusMinutes + durationMinutes);
      recordStudyEvent({ type: 'focus', durationMinutes });
    }
    if (!session.alarmAvailable && !session.alerted) {
      completed.alerted = true;
      changed = true;
      Alert.alert('Time’s up', session.phase === 'focus' ? `Your focus session is complete. Take a ${timerSettings.breakMinutes}-minute break.` : `Your break is over. Ready for another ${timerSettings.focusMinutes}-minute focus session?`);
    }
    if (changed) {
      setSession(completed);
      void AsyncStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(completed)).catch(() => undefined);
    }
  }, [recordStudyEvent, session, setFocusMinutes, state.focusMinutes, timerSettings.breakMinutes, timerSettings.focusMinutes]);

  const saveSession = (next: PomodoroSession | null) => {
    setSession(next);
    if (next) void AsyncStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
    else void AsyncStorage.removeItem(POMODORO_STORAGE_KEY).catch(() => undefined);
  };

  const startPhase = async (phase: PomodoroPhase, seconds: number, askForPermission: boolean, resumedSession?: PomodoroSession) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    try {
      await cancelPomodoroAlarm(session?.notificationId);
      const endAt = Date.now() + seconds * 1000;
      const alarm = await schedulePomodoroAlarm(phase, endAt, askForPermission, timerSettings);
      if (!alarm.available) {
        const message = Platform.OS === 'web'
          ? 'The timer will count down while StudyBolt is open. Use the mobile app for a lock-screen alarm.'
          : 'The timer will still count down. Enable StudyBolt notifications to hear the alarm when your screen is locked.';
        Alert.alert('Alarm unavailable', message);
      }
      const next: PomodoroSession = {
        phase,
        status: 'running',
        endAt,
        remainingSeconds: seconds,
        notificationId: alarm.notificationId,
        alarmAvailable: alarm.available,
        durationMinutes: resumedSession?.durationMinutes ?? Math.max(1, Math.round(seconds / 60)),
        methodLabel: resumedSession?.methodLabel ?? studyTimerMethodLabel(timerSettings),
      };
      setClock(Date.now());
      saveSession(next);
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const primaryAction = () => {
    if (starting || !ready || !settingsReady) return;
    if (!session) {
      void startPhase('focus', timerSettings.focusMinutes * 60, true);
    } else if (session.status === 'running') {
      const pausedAt = Date.now();
      const pausedSeconds = Math.max(0, Math.ceil(((session.endAt ?? pausedAt) - pausedAt) / 1000));
      void cancelPomodoroAlarm(session.notificationId);
      setClock(pausedAt);
      saveSession({
        ...session,
        status: pausedSeconds > 0 ? 'paused' : 'complete',
        endAt: null,
        remainingSeconds: pausedSeconds,
        notificationId: undefined,
      });
    } else if (session.status === 'paused') {
      void startPhase(session.phase, remainingSeconds, false, session);
    } else {
      const nextPhase = session.phase === 'focus' ? 'break' : 'focus';
      const nextDuration = (nextPhase === 'focus' ? timerSettings.focusMinutes : timerSettings.breakMinutes) * 60;
      void startPhase(nextPhase, nextDuration, false);
    }
  };

  const stopSession = () => {
    void cancelPomodoroAlarm(session?.notificationId);
    saveSession(null);
  };

  const phaseLabel = session?.phase === 'break' ? 'Short break' : 'Focus session';
  const detail = !session
    ? `${timerSettings.focusMinutes} min focus · ${timerSettings.breakMinutes} min break`
    : session.status === 'running'
      ? `${phaseLabel} · in progress`
      : session.status === 'paused'
        ? `Paused · ${timeLabel} left`
        : session.phase === 'focus'
          ? 'Focus complete · take a short break'
          : 'Break complete · ready to focus?';
  const actionLabel = !session
    ? `Start ${timerSettings.focusMinutes}-minute focus timer`
    : session.status === 'running'
      ? 'Pause timer'
      : session.status === 'paused'
        ? 'Resume timer'
        : session.phase === 'focus'
          ? `Start ${timerSettings.breakMinutes}-minute break`
          : `Start ${timerSettings.focusMinutes}-minute focus timer`;
  const actionIcon = !session || session.status === 'paused' || session.status === 'complete' ? 'play' : 'pause';

  return (
    <View style={[styles.pomodoroCard, stackedTimer && styles.pomodoroCardStacked, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.pomodoroHeading}>
        <View style={[styles.pomodoroIcon, { backgroundColor: colors.purpleSoft }]}><Icon name={session?.phase === 'break' ? 'coffee-outline' : 'timer-outline'} size={20} color={colors.purple} /></View>
        <View style={styles.pomodoroCopy}>
          <Text style={[styles.pomodoroTitle, { color: colors.text }]}>{session?.methodLabel ?? studyTimerMethodLabel(timerSettings)}</Text>
          <Text style={[styles.pomodoroDetail, { color: colors.textSecondary }]}>{detail}</Text>
        </View>
      </View>
      <View style={[styles.pomodoroControls, stackedTimer && styles.pomodoroControlsStacked]}>
        <Text accessibilityLabel={`Time remaining ${timeLabel}`} style={[styles.pomodoroTime, { color: session?.status === 'complete' ? colors.mint : colors.text }]}>{session?.status === 'complete' ? 'DONE' : timeLabel}</Text>
        {session ? (
          <Pressable accessibilityRole="button" accessibilityLabel={session.status === 'complete' ? 'Reset Pomodoro timer' : 'Stop Pomodoro timer'} accessibilityState={{ disabled: starting }} disabled={starting} hitSlop={6} onPress={stopSession} style={({ pressed }) => [styles.pomodoroStop, { backgroundColor: colors.backgroundRaised, opacity: starting ? 0.45 : pressed ? 0.72 : 1 }]}>
            <Icon name="stop" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityState={{ disabled: !ready || !settingsReady || starting }} disabled={!ready || !settingsReady || starting} onPress={primaryAction} style={({ pressed }) => [styles.pomodoroAction, { backgroundColor: colors.purple, opacity: !ready || !settingsReady || starting ? 0.5 : pressed ? 0.82 : 1 }]}>
          <Icon name={starting ? 'timer-sand' : actionIcon} size={18} color={colors.primaryText} />
        </Pressable>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, detail, color, background, onPress }: { icon: Parameters<typeof Icon>[0]['name']; label: string; detail: string; color: string; background: string; onPress: () => void }) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${detail}`} onPress={onPress} style={({ pressed }) => [styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }, pressed && (reducedMotion ? { opacity: 0.78 } : styles.pressed)]}>
      <View style={[styles.quickActionIcon, { backgroundColor: background }]}><Icon name={icon} size={20} color={color} /></View>
      <Text style={[styles.quickActionLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.quickActionDetail, { color: colors.textSecondary }]}>{detail}</Text>
    </Pressable>
  );
}

function RecentDeck({ deck, onPress }: { deck: StudyPack; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Card onPress={onPress} style={[styles.deckCard, styles.flatCard]}>
      <SubjectIcon subject={deck.courseName} emoji={deck.emoji} size={52} />
      <View style={styles.deckCopy}>
        <View style={styles.deckTitleRow}>
          <Text numberOfLines={1} style={[styles.deckTitle, { color: colors.text }]}>{deck.courseName}</Text>
          <Pill label={deck.fileType === 'demo' ? 'Sample' : 'Study pack'} tone="blue" />
        </View>
        <Text numberOfLines={1} style={[styles.deckSubtitle, { color: colors.textSecondary }]}>{deck.title}</Text>
        <View style={styles.deckMetaRow}>
          <Text style={[styles.deckMeta, { color: colors.textSecondary }]}>{deck.pageCount} {pageLabel(deck.fileType)}</Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.deckMeta, { color: colors.textSecondary }]}>Available offline</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  statusCard: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, shadowOpacity: 0, elevation: 0 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 18 },
  moreTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  moreTool: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 6 },
  moreToolText: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
  localNote: { fontSize: 10, lineHeight: 16, marginTop: 18 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  roundButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#12775E' },
  heroCopy: { marginTop: 14, marginBottom: 16 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 7 },
  date: { fontSize: 9, fontWeight: '900', letterSpacing: 1.15 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.9 },
  subtitle: { marginTop: 5, fontSize: 13, lineHeight: 18, maxWidth: 500 },
  examCard: { minHeight: 62, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  examIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  examTitle: { fontSize: 11, fontWeight: '900' },
  examText: { fontSize: 9, lineHeight: 13, marginTop: 3 },
  resumeCard: { marginTop: 14, flexDirection: 'row', alignItems: 'center', padding: 15, gap: 11, shadowOpacity: 0, elevation: 0 },
  resumeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resumeCopy: { flex: 1, minWidth: 0 },
  resumeTitle: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  resumeSubtitle: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  resumeDeck: { fontSize: 11, lineHeight: 17, marginTop: 4 },
  emptyMaterials: { fontSize: 13, lineHeight: 20, paddingVertical: 8 },
  pomodoroCardStacked: { flexDirection: 'column', alignItems: 'stretch' },
  pomodoroHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  pomodoroControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 1 },
  pomodoroControlsStacked: { alignSelf: 'stretch', flexWrap: 'wrap' },
  pomodoroCard: { minHeight: 70, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
  pomodoroIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pomodoroCopy: { flex: 1, minWidth: 0 },
  pomodoroTitle: { fontSize: 12, fontWeight: '900' },
  pomodoroDetail: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  pomodoroTime: { minWidth: 47, textAlign: 'right', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pomodoroStop: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pomodoroAction: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, marginTop: 22 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickAction: { flexBasis: '48%', flexGrow: 1, minHeight: 74, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, padding: 10, paddingLeft: 50, justifyContent: 'center' },
  quickActionIcon: { position: 'absolute', left: 10, width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 13, lineHeight: 19, fontWeight: '900' },
  quickActionDetail: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  promise: { marginTop: 14, minHeight: 58, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11 },
  promiseIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  promiseText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  deckList: { gap: 10 },
  deckCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
  deckCopy: { flex: 1, minWidth: 0 },
  deckTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  deckTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  deckSubtitle: { fontSize: 12, marginTop: 2 },
  deckMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  deckMeta: { fontSize: 10 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  miniProgress: { marginTop: 7 },
  tipCard: { marginTop: 22 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800' },
  tipText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
});
