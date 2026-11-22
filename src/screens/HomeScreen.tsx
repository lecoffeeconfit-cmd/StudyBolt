import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyPack, StudyTool } from '../models';
import type { SmartStudyMode } from '../services/adaptiveStudy';
import { AUTOMATIC_STUDY_PACK_MATERIALS } from '../services/documentProcessor';
import { getHomeUploadStatus } from '../services/homeUpload';
import {
  DEFAULT_STUDY_TIMER_SETTINGS,
  loadStudyTimerSettings,
  studyTimerMethodLabel,
  subscribeToStudyTimerSettings,
  type StudyTimerSettings,
} from '../services/studyTimer';
import { BoltMark, Icon, NeonOutline, GradientSurface, ThemeToggle } from '../components/ui';
import { bottomTabBarTop } from '../components/BottomTabs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { findHomeAudioResume } from '../services/homeStudy';
import { buildHomeDashboard } from '../services/homeDashboard';
import { getRetentionCardSchedule } from '../services/retentionScheduler';
import { HomePrioritySheet } from '../components/HomeLearningCards';
import type { HomePriority } from '../components/TodaysPlanCard';
import { TodaysPlanCard } from '../components/TodaysPlanCard';
import { AddStudyMaterialCard } from '../components/AddStudyMaterialCard';
import { HomeImportSheet } from '../components/HomeImportSheet';
import { useAuth } from '../AuthContext';
import { useStudyMaterialPicker, type ImportClass } from '../hooks/useStudyMaterialPicker';

import { ContinueStudying, HOME_TOOLS, StudyTools } from '../components/HomeStudySections';
import { HomeToolPicker } from '../components/HomeToolPicker';
import { StudyMaterialHistorySheet } from '../components/StudyMaterialHistorySheet';
import { planToolReady } from '../components/todaysPlanPresentation';
import { isHomeToolReady, type HomeTool } from '../services/homeTools';
import { buildStudyMaterialHistory } from '../services/studyMaterialHistory';
import { typography } from '../theme';
import { GuideAnchor, useGuidance, useGuidanceBlocker, useGuidanceScroll } from '../components/StudyGuidance';
import { POMODORO_STORAGE_KEY } from '../services/studyGuidance';

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
  onOpenProfile,
  planClassId,
  onSelectPlanClass,
}: {
  onOpenDeck: (deck: StudyPack, tool?: StudyTool, cardIds?: string[]) => void;
  onImport: (assets: ImportAsset[], course?: ImportClass) => void;
  onStartStudy: (mode: SmartStudyMode, focus?: { deckId: string; sectionIds?: string[] }) => void;
  onOpenMistakes: (itemIds?: string[]) => void;
  onOpenFlagged: () => void;
  onOpenPlanner: () => void;
  onPracticeTest: (deckId?: string) => void;
  onOpenLibrary: () => void;
  onOpenStats: () => void;
  onOpenProfile: () => void;
  planClassId: string | undefined;
  onSelectPlanClass: (id?: string) => void;
}) {
  const { colors, state } = useStudyBolt();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.3;
  const reducedMotion = useReducedMotion();
  const [uploadCourse, setUploadCourse] = useState<ImportClass>();
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toolPicker, setToolPicker] = useState<HomeTool | null>(null);
  const [priority, setPriority] = useState<HomePriority | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { opening: choosingFiles, error: importError, chooseFiles, acceptAssets, isOpening } = useStudyMaterialPicker(onImport);
  useGuidanceBlocker(importSheetOpen || choosingFiles || historyOpen || Boolean(toolPicker || priority));
  const guideScroll = useGuidanceScroll();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') setNow(new Date()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);

  const academicState = useMemo(() => ({
    ...state,
    decks: state.decks.filter(deck => deck.fileType !== 'demo'),
    activityEvents: state.activityEvents.filter(event => !event.id.startsWith('seed-')),
  }), [state]);
  const resumeDeck = useMemo(() => {
    const resume = findHomeAudioResume(academicState);
    return resume && isHomeToolReady(resume, 'audio') ? resume : null;
  }, [academicState]);
  const dashboard = useMemo(() => buildHomeDashboard(state, {
    now, resumeDeckId: resumeDeck?.id,
    scheduleCard: (deckId, cardId) => getRetentionCardSchedule(academicState, deckId, cardId, state.retentionMode === 'standard' ? 'sm2' : state.retentionMode, now),
  }), [state, academicState, now, resumeDeck?.id]);
  const history = useMemo(() => buildStudyMaterialHistory(state.decks, state.classes), [state.decks, state.classes]);
  const uploadStatus = useMemo(() => getHomeUploadStatus(state.decks, AUTOMATIC_STUDY_PACK_MATERIALS), [state.decks]);
  const toolPacks = useMemo(() => new Map(HOME_TOOLS.map(({ id }) => [id, dashboard.recent.map(item => item.deck)
    .filter(deck => isHomeToolReady(deck, id))])), [dashboard.recent]);
  const available = new Set([...toolPacks].filter(([, packs]) => packs.length > 0).map(([id]) => id));
  const practicePack = dashboard.recent.find(({ deck }) => isHomeToolReady(deck, 'quiz') || isHomeToolReady(deck, 'flashcards'))?.deck;
  const cramPack = toolPacks.get('flashcards')?.[0];
  const firstName = profile?.displayName?.trim().split(/\s+/)[0];
  const initials = (firstName || user?.email)?.[0]?.toUpperCase();
  const date = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const hasPacks = dashboard.decks.length > 0;

  const showUpload = (course?: ImportClass) => {
    if (isOpening()) return;
    setUploadCourse(course);
    setImportSheetOpen(true);
  };
  const openTool = (tool: HomeTool) => {
    const packs = toolPacks.get(tool) ?? [];
    if (packs.length === 1) onOpenDeck(packs[0]!, tool);
    else if (packs.length > 1) setToolPicker(tool);
  };
  const practice = () => {
    if (practicePack) onPracticeTest(practicePack.id);
    else if (hasPacks) onOpenLibrary();
    else showUpload();
  };

  return (
    <ScrollView
      {...guideScroll}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: Math.max(120, bottomTabBarTop(insets.bottom) + 24),
        paddingLeft: Math.max(16, insets.left),
        paddingRight: Math.max(16, insets.right),
      }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <BoltMark size={34} iconSize={24} backgroundColor={colors.neon?.indicator.icon ?? colors.goldBright} color={colors.neon ? colors.primaryText : colors.onGold} />
            <Text style={[styles.brandText, { color: colors.text }]}>StudyBolt</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle style={styles.roundButton} size={19} reducedMotion={reducedMotion} />
            <Pressable accessibilityRole="button" accessibilityLabel="Open profile and settings" onPress={onOpenProfile}
              style={({ pressed }) => [styles.roundButton, { borderColor: colors.border, backgroundColor: pressed ? colors.cardStrong : colors.primarySoft }]}>
              {initials ? <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text> : <Icon name="account-outline" size={21} color={colors.primary} />}
            </Pressable>
          </View>
        </View>
        <View style={styles.welcome}>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{firstName ? `${greeting}, ${firstName}` : hasPacks ? 'Welcome back' : 'Welcome to StudyBolt'}</Text>
        </View>

        <View style={[styles.columns, wide && styles.columnsWide]}>
          <View style={[styles.primaryColumn, wide && styles.primaryColumnWide]}>
            <TodaysPlanCard dashboard={dashboard} now={now} selectedId={planClassId} onSelectClass={onSelectPlanClass}
              onOpenPriority={setPriority} onOpenPlan={onOpenPlanner} onOpenStats={onOpenStats} onOpenDeck={onOpenDeck}
              onStartStudy={onStartStudy} onOpenMistakes={onOpenMistakes} onPracticeTest={onPracticeTest} onShowUpload={showUpload} />
            <ContinueStudying recent={dashboard.recent} resume={resumeDeck} onOpenDeck={onOpenDeck}
              onOpenLibrary={onOpenLibrary} onHistory={history.semesters.length ? () => setHistoryOpen(true) : undefined} />
          </View>

          <View style={[styles.secondaryColumn, wide && styles.secondaryColumnWide]}>
            <AddStudyMaterialCard colors={colors} onPress={() => showUpload()}
              onDropAssets={assets => !isOpening() && acceptAssets(assets)} opening={choosingFiles} featuredInPlan={!hasPacks}
              error={importSheetOpen ? null : importError} status={uploadStatus} onOpenPack={onOpenDeck} />
            {hasPacks ? <GuideAnchor id="home-tools">
              <StudyTools available={available} onTool={openTool} onPractice={practicePack ? practice : undefined}
                onCram={cramPack ? () => onStartStudy('cram', { deckId: cramPack.id }) : undefined} onOpenFlagged={onOpenFlagged} />
            </GuideAnchor> : null}
            <View>
              <Text accessibilityRole="header" style={[typography.sectionTitle, { color: colors.text }]}>Focus timer</Text>
              <PomodoroTimerCard />
            </View>
          </View>
        </View>
      </View>
      {importSheetOpen ? (
        <HomeImportSheet colors={colors} reducedMotion={reducedMotion} choosingFiles={choosingFiles}
          courseName={uploadCourse?.name} error={importError} onClose={() => setImportSheetOpen(false)}
          onChooseFiles={() => { if (!isOpening()) void chooseFiles(uploadCourse).finally(() => setImportSheetOpen(false)); }}
          onContinue={text => {
            if (acceptAssets([{ name: 'Study notes.txt', uri: '', mimeType: 'text/plain', text }], uploadCourse)) setImportSheetOpen(false);
          }}
        />
      ) : null}
      {historyOpen ? <StudyMaterialHistorySheet semesters={history.semesters} colors={colors} reducedMotion={reducedMotion}
        onClose={() => setHistoryOpen(false)} onOpenPack={deck => { setHistoryOpen(false); onOpenDeck(deck); }} /> : null}
      {toolPicker ? <HomeToolPicker label={HOME_TOOLS.find(tool => tool.id === toolPicker)!.title} packs={toolPacks.get(toolPicker) ?? []}
        onClose={() => setToolPicker(null)} onSelect={deck => { setToolPicker(null); onOpenDeck(deck, toolPicker); }} /> : null}
      <HomePrioritySheet kind={priority} dashboard={dashboard} onClose={() => setPriority(null)}
        onDue={group => onOpenDeck(group.deck, 'flashcards', group.cardIds)}
        onWeak={topic => topic.cardIds.length && isHomeToolReady(topic.deck, 'flashcards')
          ? onStartStudy('smart', { deckId: topic.deck.id, sectionIds: [topic.sectionId] })
          : onOpenDeck(topic.deck, isHomeToolReady(topic.deck, 'quiz') ? 'quiz' : planToolReady(topic.deck, 'notes') ? 'notes' : undefined)}
        onMistakes={() => onOpenMistakes(dashboard.mistakeIds)} onFlashcards={deck => onOpenDeck(deck, 'flashcards')} onPractice={practice} />
    </ScrollView>
  );
}

function PomodoroTimerCard() {
  const { colors, state, setFocusMinutes, recordStudyEvent } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const startingRef = useRef(false);
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [timerSettings, setTimerSettings] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [clock, setClock] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const setGuideTimer = useGuidance()?.setFocusTimer;
  useGuidanceBlocker(starting);
  useEffect(() => {
    if (ready) setGuideTimer?.(session?.status === 'running' ? session.endAt ?? 0 : 0);
  }, [ready, session?.endAt, session?.status, setGuideTimer]);
  const remainingSeconds = session?.status === 'running' && session.endAt
    ? Math.max(0, Math.ceil((session.endAt - clock) / 1000))
    : session?.remainingSeconds ?? timerSettings.focusMinutes * 60;
  const timeLabel = `${Math.floor(remainingSeconds / 60).toString().padStart(2, '0')}:${(remainingSeconds % 60).toString().padStart(2, '0')}`;
  const totalSeconds = (session?.durationMinutes ?? (session?.phase === 'break' ? timerSettings.breakMinutes : timerSettings.focusMinutes)) * 60;
  const fraction = session && totalSeconds > 0 ? Math.max(0, Math.min(1, 1 - remainingSeconds / totalSeconds)) : 0;

  useEffect(() => {
    if (reducedMotion || !session || session.status !== 'running') {
      progress.setValue(fraction);
      return;
    }
    const animation = Animated.timing(progress, { toValue: fraction, duration: 300, useNativeDriver: false, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [fraction, progress, reducedMotion, session]);

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
        ? `${phaseLabel} · paused`
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
  const shortAction = !session ? 'Start focus' : session.status === 'running' ? 'Pause' : session.status === 'paused' ? 'Resume'
    : session.phase === 'focus' ? 'Start break' : 'Start focus';
  const timerAccent = colors.neon?.chart ?? colors.purple;
  const timerAccentSurface = colors.neon?.secondarySoft ?? colors.purpleSoft;

  return (
    <View style={[styles.pomodoroCard, { backgroundColor: colors.card, borderColor: colors.neon?.edge ?? colors.border }]}>
      {colors.neon ? <GradientSurface colors={colors.neon.hero} borderRadius={styles.pomodoroCard.borderRadius} /> : null}
      <View style={styles.pomodoroHeading}>
        <View style={[styles.pomodoroIcon, { backgroundColor: timerAccentSurface }]}><Icon name={session?.phase === 'break' ? 'coffee-outline' : 'timer-outline'} size={20} color={timerAccent} /></View>
        <View style={styles.pomodoroCopy}>
          <Text style={[styles.pomodoroTitle, { color: colors.text }]}>{session?.methodLabel ?? studyTimerMethodLabel(timerSettings)}</Text>
          <Text style={[styles.pomodoroDetail, { color: colors.textSecondary }]}>{detail}</Text>
        </View>
        <Text accessibilityLabel={session?.status === 'complete' ? 'Timer complete' : `Time remaining ${timeLabel}`}
          style={[styles.pomodoroTime, { color: session?.status === 'complete' ? colors.mint : colors.text }]}>{session?.status === 'complete' ? '00:00' : timeLabel}</Text>
      </View>
      {session ? <View accessible={false} aria-hidden style={[styles.pomodoroTrack, { backgroundColor: colors.neon?.progressTrack ?? colors.purpleSoft }]}>
        <Animated.View style={[styles.pomodoroFill, { backgroundColor: timerAccent,
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}>
          {colors.neon ? <GradientSurface colors={[timerAccent, colors.neon.progressEnd]} borderRadius={4} /> : null}
        </Animated.View>
      </View> : null}
      <View style={styles.pomodoroControls}>
        {session ? (
          <Pressable accessibilityRole="button" accessibilityLabel={session.status === 'complete' ? 'Reset Pomodoro timer' : 'Stop Pomodoro timer'} accessibilityState={{ disabled: starting }} disabled={starting} hitSlop={6} onPress={stopSession} style={({ pressed }) => [styles.pomodoroStop, { backgroundColor: colors.backgroundRaised, opacity: starting ? 0.45 : pressed ? 0.72 : 1 }]}>
            <Icon name="stop" size={16} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} accessibilityState={{ busy: starting, disabled: !ready || !settingsReady || starting }} disabled={!ready || !settingsReady || starting} onPress={primaryAction} style={({ pressed }) => [styles.pomodoroAction, { backgroundColor: timerAccentSurface, opacity: !ready || !settingsReady || starting ? 0.5 : pressed ? 0.75 : 1 }]}>
          {colors.neon ? <NeonOutline color={colors.neon.edge} borderRadius={styles.pomodoroAction.borderRadius} /> : null}
          <Icon name={starting ? 'timer-sand' : actionIcon} size={18} color={timerAccent} />
          <Text style={[styles.pomodoroActionText, { color: timerAccent }]}>{starting ? 'Starting…' : shortAction}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1060, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 50 },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontSize: 20, lineHeight: 27, letterSpacing: -0.5, fontWeight: '800', flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  roundButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  welcome: { gap: 2, paddingTop: 16, paddingBottom: 14 },
  date: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  title: { fontSize: 33, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  columns: { gap: 23 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 22 },
  primaryColumn: { minWidth: 0, gap: 19 },
  secondaryColumn: { minWidth: 0, gap: 19 },
  primaryColumnWide: { flex: 5 },
  secondaryColumnWide: { flex: 3, paddingTop: 53 },
  pomodoroHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pomodoroControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 7 },
  pomodoroCard: { borderRadius: 18, borderWidth: 1, padding: 11, gap: 8, marginTop: 8 },
  pomodoroIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pomodoroCopy: { flex: 1, minWidth: 85 },
  pomodoroTitle: { fontSize: 14, lineHeight: 21, fontWeight: '800' },
  pomodoroDetail: { fontSize: 12, lineHeight: 18 },
  pomodoroTime: { fontSize: 21, lineHeight: 27, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pomodoroStop: { width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pomodoroAction: { minHeight: 44, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingHorizontal: 11, gap: 5, flexShrink: 1 },
  pomodoroActionText: { fontSize: 13, lineHeight: 19, fontWeight: '800', flexShrink: 1 },
  pomodoroTrack: { height: 4, borderRadius: 4, overflow: 'hidden' },
  pomodoroFill: { height: '100%', borderRadius: 4 },
});
