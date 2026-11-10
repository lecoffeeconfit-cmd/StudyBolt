import { PolishedScreen as Screen, PolishedSectionHeader as SectionHeader } from '../components/PagePresentation';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { typography } from '../theme';
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Header, Icon, Pill, PrimaryButton } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { RetentionMode, StudyType, ThemePreference } from '../models';
import { learningEvidence } from '../data/learningScience';
import { useAuth } from '../AuthContext';
import { NarrationSettingsSheet, narrationLanguageLabel } from '../components/NarrationSettingsSheet';
import { useNarrationPreferences } from '../hooks/useNarrationPreferences';
import {
  DEFAULT_STUDY_TIMER_SETTINGS,
  loadStudyTimerSettings,
  saveStudyTimerSettings,
  STUDY_TIMER_PRESETS,
  studyTimerMethodLabel,
  subscribeToStudyTimerSettings,
  type StudyTimerAlarmMode,
  type StudyTimerSettings,
} from '../services/studyTimer';

const THEMES: Array<{ id: ThemePreference; label: string; icon: IconName }> = [
  { id: 'system', label: 'System', icon: 'cellphone' },
  { id: 'light', label: 'Light', icon: 'weather-sunny' },
  { id: 'dark', label: 'Dark', icon: 'weather-night' },
];

const RETENTION_OPTIONS: Array<{ id: RetentionMode; label: string; detail: string; icon: IconName }> = [
  { id: 'standard', label: 'Standard', detail: 'Simple', icon: 'calendar-sync-outline' },
  { id: 'fsrs', label: 'FSRS', detail: 'Adaptive', icon: 'brain' },
  { id: 'sm2', label: 'SM-2', detail: 'Classic', icon: 'chart-timeline-variant' },
];

const STUDY_TYPE_OPTIONS: Array<{ id: StudyType; label: string; icon: IconName }> = [
  { id: 'college', label: 'College', icon: 'school-outline' },
  { id: 'graduate_school', label: 'Graduate school', icon: 'book-education-outline' },
  { id: 'professional', label: 'Professional', icon: 'briefcase-outline' },
  { id: 'other', label: 'Other', icon: 'compass-outline' },
];

function retentionLabel(mode: RetentionMode): string {
  return mode === 'standard' ? 'Standard' : mode === 'fsrs' ? 'FSRS' : 'SM-2';
}

export function ProfileScreen({ onOpenOnboarding, onOpenAuth, onManageAccount, onOpenWidgets, onOpenLegal, onOpenAdmin, onOpenSupport, onOpenPremium, isAdmin = false }: { onOpenOnboarding: () => void; onOpenAuth: () => void; onManageAccount: () => void; onOpenWidgets: () => void; onOpenLegal: () => void; onOpenAdmin: () => void; onOpenSupport: () => void; onOpenPremium: () => void; isAdmin?: boolean }) {
  const { colors, state, setRetentionMode, setTheme } = useStudyBolt();
  const { user, profile, updateProfile } = useAuth();
  const { preferences: narrationPreferences, voices: narrationVoices, loading: narrationLoading, updatePreferences: saveNarrationPreferences } = useNarrationPreferences();
  const [studyTypeBusy, setStudyTypeBusy] = useState(false);
  const [studyTypeNotice, setStudyTypeNotice] = useState<string | null>(null);
  const [timerSettings, setTimerSettings] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [timerDraft, setTimerDraft] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [timerSettingsVisible, setTimerSettingsVisible] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const [narrationSettingsVisible, setNarrationSettingsVisible] = useState(false);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const initial = (profile?.displayName?.[0] ?? user?.email?.[0] ?? 'H').toUpperCase();
  const narrationVoice = narrationVoices.find((voice) => voice.identifier === narrationPreferences.voiceIdentifier);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeToStudyTimerSettings((next) => {
      if (mounted) setTimerSettings(next);
    });
    void loadStudyTimerSettings().then((next) => {
      if (mounted) setTimerSettings(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const openTimerSettings = () => {
    setTimerDraft(timerSettings);
    setTimerError(null);
    setTimerSettingsVisible(true);
  };

  const saveTimerSettings = async () => {
    setTimerSaving(true);
    setTimerError(null);
    try {
      const saved = await saveStudyTimerSettings(timerDraft);
      setTimerSettings(saved);
      setTimerSettingsVisible(false);
    } catch {
      setTimerError('StudyBolt could not save these timer settings. Please try again.');
    } finally {
      setTimerSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Settings" right={<Pill label={user ? 'Signed in' : 'Guest'} tone={user ? 'mint' : 'neutral'} />} />
      <View style={[styles.profileTop, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>{user ? profile?.displayName || 'Account ready' : 'Your StudyBolt'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{user?.email ?? 'Studying locally as a guest'}</Text>
      </View>

      <Card style={[styles.syncCard, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.syncRow}>
          <View style={[styles.syncIcon, { backgroundColor: colors.primary }]}><Icon name="cloud-sync" color={colors.primaryText} size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.syncTitle, { color: colors.text }]}>{user ? 'Account & security' : 'Your study space'}</Text>
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>{user ? 'Change your email, reset your password, or manage your account.' : 'Study Packs stay on this device. Sign in for cloud tools and membership access.'}</Text>
          </View>
        </View>
        <PrimaryButton label={user ? 'Manage account' : 'Sign in or create account'} icon={user ? 'shield-account-outline' : 'login'} onPress={user ? onManageAccount : onOpenAuth} style={styles.syncButton} />
      </Card>

      <SectionHeader title="Membership" />
      <Card style={styles.settingsCard}>
        <Setting icon="star-circle-outline" title="Premium & AI usage" detail={user ? 'View your allowance, subscribe, or restore a purchase' : 'Sign in to view or manage a subscription'} onPress={onOpenPremium} last />
      </Card>

      {user && isAdmin ? <>
        <SectionHeader title="Administration" action="Private operations" />
        <Card style={styles.settingsCard}>
          <Setting icon="shield-account-outline" title="Admin Center" detail="Learner activity, feedback, and account controls" onPress={onOpenAdmin} last />
        </Card>
      </> : null}

      {user ? (
        <>
          <SectionHeader title="Study setup" />
          <Card style={styles.studyTypeCard}>
            <Text style={[styles.studyTypeQuestion, { color: colors.text }]}>What are you studying for?</Text>
            <Text style={[styles.studyTypeHint, { color: colors.textSecondary }]}>Update this anytime; it will not restart onboarding.</Text>
            <View style={styles.studyTypeGrid}>
              {STUDY_TYPE_OPTIONS.map((option) => {
                const selected = profile?.studyType === option.id;
                return (
                  <Pressable aria-checked={selected}
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={studyTypeBusy}
                    onPress={() => {
                      setStudyTypeBusy(true);
                      setStudyTypeNotice(null);
                      void updateProfile({ studyType: option.id }).then((result) => {
                        setStudyTypeBusy(false);
                        if (result.error) setStudyTypeNotice(result.error);
                      });
                    }}
                    style={({ pressed }) => [
                      styles.studyTypeOption,
                      {
                        backgroundColor: selected ? colors.primarySoft : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: studyTypeBusy ? 0.65 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Icon name={option.icon} size={18} color={selected ? colors.primary : colors.textMuted} />
                    <Text style={[styles.studyTypeLabel, { color: selected ? colors.primary : colors.textSecondary }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {studyTypeNotice ? <Text style={[styles.studyTypeNotice, { color: colors.danger }]}>{studyTypeNotice}</Text> : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Appearance" />
      <Card style={styles.themeCard}>
        <View style={styles.themeOptions}>
          {THEMES.map((theme) => {
            const selected = state.theme === theme.id;
            return (
              <Pressable accessibilityRole="button"
                key={theme.id}
                onPress={() => setTheme(theme.id)}
                style={[styles.themeOption, { backgroundColor: selected ? colors.primarySoft : colors.card, borderColor: selected ? colors.primary : colors.border }]}
              >
                <Icon name={theme.icon} size={20} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.themeLabel, { color: selected ? colors.primary : colors.textSecondary }]}>{theme.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.themeHint, { color: colors.textMuted }]}>System · Matches your device’s Light or Dark setting. Night mode lowers large bright areas and keeps text readable in dim rooms. Match your device brightness to the room; dark mode improves comfort but is not eye or sleep protection.</Text>
      </Card>

      <SectionHeader title="Listening" />
      <Card style={styles.narrationCard}>
        <View style={styles.narrationTop}>
          <View style={[styles.narrationIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="waveform" size={22} color={colors.purple} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.narrationTitle, { color: colors.text }]}>Narration & language</Text>
            <Text style={[styles.narrationSubtitle, { color: colors.textSecondary }]}>Choose a voice from your phone and set its spoken language.</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Change narration voice and language" onPress={() => { setNarrationError(null); setNarrationSettingsVisible(true); }} style={[styles.narrationSummary, { backgroundColor: colors.cardStrong }]}>
          <View style={styles.narrationSummaryCopy}>
            <Text style={[styles.narrationSummaryLabel, { color: colors.textMuted }]}>CURRENT VOICE</Text>
            <Text numberOfLines={1} style={[styles.narrationSummaryValue, { color: colors.text }]}>{narrationVoice?.name ?? 'Phone default voice'}</Text>
          </View>
          <View style={[styles.narrationSummaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.narrationSummaryCopy}>
            <Text style={[styles.narrationSummaryLabel, { color: colors.textMuted }]}>LANGUAGE</Text>
            <Text numberOfLines={1} style={[styles.narrationSummaryValue, { color: colors.text }]}>{narrationLanguageLabel(narrationPreferences.language)}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
        {narrationError ? <Text style={[styles.narrationError, { color: colors.danger }]}>{narrationError}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Customize narration" onPress={() => { setNarrationError(null); setNarrationSettingsVisible(true); }} style={({ pressed }) => [styles.narrationButton, { backgroundColor: colors.purple, opacity: pressed ? 0.78 : 1 }]}>
          <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.narrationButtonIcon}><Icon name="tune-variant" size={18} color={colors.primaryText} /></View>
          <Text style={[styles.narrationButtonText, { color: colors.primaryText }]}>Customize narration</Text>
          <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.narrationButtonIcon}><Icon name="arrow-top-right" size={18} color={colors.primaryText} /></View>
        </Pressable>
      </Card>

      <SectionHeader title="Study preferences" />
      <Card style={styles.settingsCard}>
        <Setting icon="bell-outline" title="Reminders" detail={state.plan.remindersEnabled ? 'Enabled in current plan' : 'Off'} />
        <Setting icon="speedometer" title="Playback speed" detail="1.0× default" />
        <Setting icon="timer-outline" title="Study timer" detail={`${studyTimerMethodLabel(timerSettings)} · ${timerSettings.focusMinutes} min focus · ${timerSettings.breakMinutes} min break`} onPress={openTimerSettings} />
        <Setting icon="view-dashboard-outline" title="Study widgets" detail="Add glanceable study views to your Home Screen" onPress={onOpenWidgets} />
        <Setting icon="download-circle-outline" title="Offline study" detail={`${state.decks.length} packs stored locally`} last />
      </Card>

      <SectionHeader title="Retention scheduling" action={retentionLabel(state.retentionMode)} />
      <Card style={[styles.retentionCard, { backgroundColor: state.retentionMode === 'standard' ? colors.card : colors.primarySoft }]}>
        <View style={styles.retentionTop}>
          <View style={[styles.retentionIcon, { backgroundColor: state.retentionMode === 'standard' ? colors.cardStrong : colors.primary }]}><Icon name="brain" size={21} color={state.retentionMode === 'standard' ? colors.primary : colors.primaryText} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.retentionTitle, { color: colors.text }]}>Advanced review timing</Text>
            <Text style={[styles.retentionText, { color: colors.textSecondary }]}>Choose how StudyBolt decides when each card is due.</Text>
          </View>
          <Switch
            accessibilityLabel="Use advanced retention scheduling"
            value={state.retentionMode !== 'standard'}
            onValueChange={(enabled) => setRetentionMode(enabled ? 'fsrs' : 'standard')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.primaryText}
          />
        </View>
        <View style={styles.retentionOptions}>
          {RETENTION_OPTIONS.map((option) => {
            const selected = state.retentionMode === option.id;
            return (
              <Pressable aria-checked={selected}
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setRetentionMode(option.id)}
                style={[styles.retentionOption, { backgroundColor: selected ? colors.card : 'transparent', borderColor: selected ? colors.primary : colors.border }]}
              >
                <Icon name={option.icon} size={17} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.retentionOptionLabel, { color: selected ? colors.primary : colors.textSecondary }]}>{option.label}</Text>
                <Text style={[styles.retentionOptionDetail, { color: colors.textMuted }]}>{option.detail}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.retentionHint, { color: colors.textMuted }]}>
          {state.retentionMode === 'standard'
            ? 'Off · Standard uses simple time-based intervals. Your review history is kept.'
            : state.retentionMode === 'fsrs'
              ? 'On · FSRS adapts difficulty, stability, and retrievability from your recorded reviews.'
              : 'On · SM-2 adjusts each card’s ease factor and interval from your recall ratings.'}
        </Text>
        <Text style={[styles.retentionEvidence, { color: colors.textMuted }]}>Science note · Spaced retrieval supports long-term retention; schedulers guide timing but cannot guarantee memory.</Text>
      </Card>

      <SectionHeader title="About" />
      <Card style={styles.settingsCard}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenOnboarding}
          style={[styles.setting, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
        >
          <View style={[styles.settingIcon, { backgroundColor: colors.cardStrong }]}><Icon name="compass-outline" size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingTitle, { color: colors.text }]}>Quick tour</Text>
            <Text style={[styles.settingDetail, { color: colors.textMuted }]}>Replay the StudyBolt introduction</Text>
          </View>
          <Icon name="chevron-right" color={colors.textMuted} />
        </Pressable>
        <Setting icon="shield-lock-outline" title="Privacy & terms" detail="Review your legal documents" onPress={onOpenLegal} />
        <Setting icon="lifebuoy" title="Help & support" detail="Send feedback and view support replies" onPress={onOpenSupport} />
        <Setting icon="information-outline" title="StudyBolt" detail="Version 1.0.0" last />
      </Card>

      <SectionHeader title="Learning approach" action="Primary research" />
      <Card style={styles.evidenceCard}>
        {learningEvidence.map((item, index) => (
          <Pressable
            key={item.principle}
            accessibilityRole="link"
            onPress={() => void Linking.openURL(item.url)}
            style={[styles.evidenceRow, index < learningEvidence.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <View style={[styles.evidenceIcon, { backgroundColor: index === 1 ? colors.mintSoft : colors.primarySoft }]}>
              <Icon name={index === 0 ? 'brain' : index === 1 ? 'calendar-refresh' : 'flask-outline'} size={19} color={index === 1 ? colors.mint : colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.evidenceTitle, { color: colors.text }]}>{item.principle}</Text>
              <Text style={[styles.evidenceText, { color: colors.textSecondary }]}>{item.application}</Text>
              <Text style={[styles.evidenceSource, { color: colors.primary }]}>{item.source}</Text>
            </View>
            <Icon name="open-in-new" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </Card>
      <Text style={[styles.footer, { color: colors.textMuted }]}>Small steps. Big futures. ⚡</Text>

      <StudyTimerSettingsSheet
        visible={timerSettingsVisible}
        draft={timerDraft}
        saving={timerSaving}
        error={timerError}
        onChange={setTimerDraft}
        onSave={() => void saveTimerSettings()}
        onClose={() => setTimerSettingsVisible(false)}
      />
      <NarrationSettingsSheet
        visible={narrationSettingsVisible}
        voices={narrationVoices}
        preferences={narrationPreferences}
        loading={narrationLoading}
        onChange={(next) => {
          setNarrationError(null);
          void saveNarrationPreferences(next).catch(() => setNarrationError('StudyBolt could not save your narration preferences. Please try again.'));
        }}
        onClose={() => setNarrationSettingsVisible(false)}
      />
    </Screen>
  );
}

const TIMER_ALARM_OPTIONS: Array<{ id: StudyTimerAlarmMode; label: string; detail: string; icon: IconName }> = [
  { id: 'sound-vibration', label: 'Sound', detail: 'Sound and vibration', icon: 'bell-ring-outline' },
  { id: 'vibration', label: 'Quiet', detail: 'Vibration when supported', icon: 'vibrate' },
  { id: 'silent', label: 'Silent', detail: 'Notification only', icon: 'bell-off-outline' },
];

function StudyTimerSettingsSheet({
  visible,
  draft,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  visible: boolean;
  draft: StudyTimerSettings;
  saving: boolean;
  error: string | null;
  onChange: (settings: StudyTimerSettings) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const adjustMinutes = (field: 'focusMinutes' | 'breakMinutes', amount: number) => {
    const min = field === 'focusMinutes' ? 5 : 1;
    const max = field === 'focusMinutes' ? 120 : 30;
    onChange({ ...draft, method: 'custom', [field]: Math.max(min, Math.min(max, draft[field] + amount)) });
  };

  return (
    <Modal visible={visible} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.timerModalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.34)' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close study timer settings" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel="Study timer settings" style={[styles.timerSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={[styles.timerHandle, { backgroundColor: colors.border }]} />
          <View style={styles.timerHeading}>
            <View style={[styles.timerHeadingIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="timer-outline" size={23} color={colors.purple} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.timerSheetTitle, { color: colors.text }]}>Study timer</Text><Text style={[styles.timerSheetSubtitle, { color: colors.textSecondary }]}>Used by the timer button on Home</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.timerClose}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <Text style={[styles.timerSectionLabel, { color: colors.textMuted }]}>STUDY METHOD</Text>
          <View style={styles.timerPresetRow}>
            {STUDY_TIMER_PRESETS.map((preset) => {
              const selected = draft.method === preset.id;
              const icon: IconName = preset.id === 'quick-sprint' ? 'flash-outline' : preset.id === 'deep-focus' ? 'brain' : 'timer-outline';
              return (
                <Pressable aria-checked={selected}
                  key={preset.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onChange({ ...draft, method: preset.id, focusMinutes: preset.focusMinutes, breakMinutes: preset.breakMinutes })}
                  style={({ pressed }) => [styles.timerPreset, { backgroundColor: selected ? colors.purpleSoft : colors.cardStrong, borderColor: selected ? colors.purple : colors.border, opacity: pressed ? 0.75 : 1 }]}
                >
                  <Icon name={icon} size={18} color={selected ? colors.purple : colors.textMuted} />
                  <Text style={[styles.timerPresetTitle, { color: selected ? colors.purple : colors.text }]}>{preset.label}</Text>
                  <Text style={[styles.timerPresetDetail, { color: colors.textMuted }]}>{preset.focusMinutes}/{preset.breakMinutes} min</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.timerDurationRow}>
            <TimerDurationControl label="Focus" value={draft.focusMinutes} step={5} onAdjust={(amount) => adjustMinutes('focusMinutes', amount)} />
            <TimerDurationControl label="Break" value={draft.breakMinutes} step={1} onAdjust={(amount) => adjustMinutes('breakMinutes', amount)} />
          </View>

          <Text style={[styles.timerSectionLabel, { color: colors.textMuted }]}>ALARM MODE</Text>
          <View style={styles.timerAlarmRow}>
            {TIMER_ALARM_OPTIONS.map((option) => {
              const selected = draft.alarmMode === option.id;
              return (
                <Pressable aria-checked={selected}
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => onChange({ ...draft, alarmMode: option.id })}
                  style={({ pressed }) => [styles.timerAlarm, { backgroundColor: selected ? colors.primarySoft : colors.cardStrong, borderColor: selected ? colors.primary : colors.border, opacity: pressed ? 0.75 : 1 }]}
                >
                  <Icon name={option.icon} size={18} color={selected ? colors.primary : colors.textMuted} />
                  <Text style={[styles.timerAlarmTitle, { color: selected ? colors.primary : colors.text }]}>{option.label}</Text>
                  <Text style={[styles.timerAlarmDetail, { color: colors.textMuted }]}>{option.detail}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.timerNote, { color: colors.textMuted }]}>Changes apply to the next timer. Notification behavior also follows your phone’s sound and vibration settings.</Text>
          {error ? <Text style={[styles.timerError, { color: colors.danger }]}>{error}</Text> : null}
          <PrimaryButton label={saving ? 'Saving…' : 'Save timer settings'} icon="check" disabled={saving} onPress={onSave} style={styles.timerSave} />
        </View>
      </View>
    </Modal>
  );
}

function TimerDurationControl({ label, value, step, onAdjust }: { label: string; value: number; step: number; onAdjust: (amount: number) => void }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.timerDuration, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
      <Text style={[styles.timerDurationLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <View style={styles.timerStepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label.toLowerCase()} time`} onPress={() => onAdjust(-step)} style={[styles.timerStepButton, { backgroundColor: colors.card }]}><Icon name="minus" size={17} color={colors.primary} /></Pressable>
        <View style={styles.timerDurationValue}><Text style={[styles.timerDurationNumber, { color: colors.text }]}>{value}</Text><Text style={[styles.timerDurationUnit, { color: colors.textMuted }]}>min</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label.toLowerCase()} time`} onPress={() => onAdjust(step)} style={[styles.timerStepButton, { backgroundColor: colors.card }]}><Icon name="plus" size={17} color={colors.primary} /></Pressable>
      </View>
    </View>
  );
}

function Setting({ icon, title, detail, last = false, onPress }: { icon: IconName; title: string; detail: string; last?: boolean; onPress?: () => void }) {
  const { colors } = useStudyBolt();
  const content = (
    <>
      <View style={[styles.settingIcon, { backgroundColor: colors.cardStrong }]}><Icon name={icon} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingDetail, { color: colors.textMuted }]}>{detail}</Text>
      </View>
      <Icon name={onPress ? 'chevron-right' : 'check-circle-outline'} color={colors.textMuted} />
    </>
  );
  const style = [styles.setting, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }];
  if (!onPress) return <View style={style}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.65 }]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  profileTop: { alignItems: 'center', paddingVertical: 17, padding: 22, marginTop: 12, borderRadius: 22 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontWeight: '700' },
  title: { ...typography.pageTitle,  marginTop: 12, },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  syncCard: { marginTop: 6 },
  syncRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  syncIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  syncTitle: { fontSize: 14, fontWeight: '800' },
  syncText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  syncButton: { minHeight: 46, marginTop: 14 },
  studyTypeCard: { padding: 14 },
  studyTypeQuestion: { fontSize: 14, fontWeight: '900' },
  studyTypeHint: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  studyTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  studyTypeOption: { width: '48%', minHeight: 48, paddingVertical: 8, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  studyTypeLabel: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  studyTypeNotice: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 10 },
  themeCard: { padding: 12 },
  themeOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeOption: { flex: 1, borderRadius: 13, borderWidth: 1, alignItems: 'center', paddingVertical: 13, gap: 5, minHeight: 70, minWidth: 84, flexGrow: 1 },
  themeLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  themeHint: { fontSize: 12, lineHeight: 19, marginTop: 12, paddingHorizontal: 3 },
  narrationCard: { padding: 13 },
  narrationTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  narrationIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  narrationTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  narrationSubtitle: { fontSize: 16, lineHeight: 24, marginTop: 3 },
  narrationSummary: { minHeight: 59, flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 11, gap: 10, marginTop: 13, padding: 15 },
  narrationSummaryCopy: { flex: 1, minWidth: 0, paddingVertical: 9 },
  narrationSummaryLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.7 },
  narrationSummaryValue: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 3 },
  narrationSummaryDivider: { width: StyleSheet.hairlineWidth, height: 31 },
  narrationButton: { minHeight: 50, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10, marginTop: 10 },
  narrationButtonIcon: { width: 24, height: 24, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  narrationButtonText: { fontSize: 14, lineHeight: 21, fontWeight: '700', flex: 1, minWidth: 0, textAlign: 'center' },
  narrationError: { fontSize: 14, lineHeight: 21, marginTop: 9 },
  settingsCard: { paddingVertical: 1, paddingHorizontal: 18, borderRadius: 22 },
  setting: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  settingDetail: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  footer: { textAlign: 'center', fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 26 },
  evidenceCard: { paddingVertical: 1 },
  evidenceRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  evidenceText: { fontSize: 14, lineHeight: 21, marginTop: 2 },
  evidenceSource: { fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  retentionCard: { padding: 14 },
  retentionTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  retentionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  retentionTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  retentionText: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  retentionOptions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  retentionOption: { flex: 1, minHeight: 52, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 12, gap: 2 },
  retentionOptionLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  retentionOptionDetail: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  retentionHint: { fontSize: 14, lineHeight: 21, marginTop: 11, paddingHorizontal: 2 },
  retentionEvidence: { fontSize: 14, lineHeight: 21, marginTop: 7, paddingHorizontal: 2 },
  timerModalRoot: { flex: 1, justifyContent: 'flex-end' },
  timerSheet: { width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  timerHandle: { width: 42, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 15 },
  timerHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  timerHeadingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timerSheetTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  timerSheetSubtitle: { fontSize: 16, lineHeight: 24, marginTop: 2 },
  timerClose: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  timerSectionLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  timerPresetRow: { flexDirection: 'row', gap: 7 },
  timerPreset: { flex: 1, minHeight: 82, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 4 },
  timerPresetTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  timerPresetDetail: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  timerDurationRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  timerDuration: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  timerDurationLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700', letterSpacing: 0.7, marginBottom: 7 },
  timerStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  timerStepButton: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timerDurationValue: { alignItems: 'center', minWidth: 38 },
  timerDurationNumber: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerDurationUnit: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  timerAlarmRow: { flexDirection: 'row', gap: 7 },
  timerAlarm: { flex: 1, minHeight: 75, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 3 },
  timerAlarmTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
  timerAlarmDetail: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  timerNote: { fontSize: 14, lineHeight: 21, marginTop: 11 },
  timerError: { fontSize: 14, lineHeight: 21, fontWeight: '700', marginTop: 8 },
  timerSave: { minHeight: 46, marginTop: 13 },
});
