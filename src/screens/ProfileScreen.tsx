import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Header, Icon, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { RetentionMode, StudyType, ThemePreference } from '../models';
import { learningEvidence } from '../data/learningScience';
import { useAuth } from '../AuthContext';
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

export function ProfileScreen({ onOpenOnboarding, onOpenAuth, onManageAccount, onOpenWidgets, onOpenLegal }: { onOpenOnboarding: () => void; onOpenAuth: () => void; onManageAccount: () => void; onOpenWidgets: () => void; onOpenLegal: () => void }) {
  const { colors, state, setRetentionMode, setTheme } = useStudyBolt();
  const { user, profile, updateProfile } = useAuth();
  const [studyTypeBusy, setStudyTypeBusy] = useState(false);
  const [studyTypeNotice, setStudyTypeNotice] = useState<string | null>(null);
  const [timerSettings, setTimerSettings] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [timerDraft, setTimerDraft] = useState(DEFAULT_STUDY_TIMER_SETTINGS);
  const [timerSettingsVisible, setTimerSettingsVisible] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [timerError, setTimerError] = useState<string | null>(null);
  const initial = (profile?.displayName?.[0] ?? user?.email?.[0] ?? 'H').toUpperCase();

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
      <Header title="Profile" right={<Pill label={user ? 'Signed in' : 'Guest'} tone={user ? 'mint' : 'neutral'} />} />
      <View style={styles.profileTop}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}><Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>{user ? profile?.displayName || 'Account ready' : 'Your StudyBolt'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{user?.email ?? 'Studying locally as a guest'}</Text>
      </View>

      <Card style={[styles.syncCard, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.syncRow}>
          <View style={[styles.syncIcon, { backgroundColor: colors.primary }]}><Icon name="cloud-sync" color={colors.primaryText} size={22} /></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.syncTitle, { color: colors.text }]}>{user ? 'Account & security' : 'Save materials everywhere'}</Text>
            <Text style={[styles.syncText, { color: colors.textSecondary }]}>{user ? 'Change your email, reset your password, or manage your account.' : 'Sign in to keep your account and future synced materials protected.'}</Text>
          </View>
        </View>
        <PrimaryButton label={user ? 'Manage account' : 'Sign in or create account'} icon={user ? 'shield-account-outline' : 'login'} onPress={user ? onManageAccount : onOpenAuth} style={styles.syncButton} />
      </Card>

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
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
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
              <Pressable
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
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
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
        <Setting icon="lifebuoy" title="Help & support" detail="Setup documentation included" />
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
  const insets = useSafeAreaInsets();
  const adjustMinutes = (field: 'focusMinutes' | 'breakMinutes', amount: number) => {
    const min = field === 'focusMinutes' ? 5 : 1;
    const max = field === 'focusMinutes' ? 120 : 30;
    onChange({ ...draft, method: 'custom', [field]: Math.max(min, Math.min(max, draft[field] + amount)) });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.timerModalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.34)' }]}>
        <Pressable accessibilityLabel="Close study timer settings" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.timerSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={[styles.timerHandle, { backgroundColor: colors.border }]} />
          <View style={styles.timerHeading}>
            <View style={[styles.timerHeadingIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="timer-outline" size={23} color={colors.purple} /></View>
            <View style={{ flex: 1 }}><Text style={[styles.timerSheetTitle, { color: colors.text }]}>Study timer</Text><Text style={[styles.timerSheetSubtitle, { color: colors.textSecondary }]}>Used by the timer button on Home</Text></View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.timerClose}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <Text style={[styles.timerSectionLabel, { color: colors.textMuted }]}>STUDY METHOD</Text>
          <View style={styles.timerPresetRow}>
            {STUDY_TIMER_PRESETS.map((preset) => {
              const selected = draft.method === preset.id;
              const icon: IconName = preset.id === 'quick-sprint' ? 'flash-outline' : preset.id === 'deep-focus' ? 'brain' : 'timer-outline';
              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
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
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
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
        <Pressable accessibilityLabel={`Decrease ${label.toLowerCase()} time`} onPress={() => onAdjust(-step)} style={[styles.timerStepButton, { backgroundColor: colors.card }]}><Icon name="minus" size={17} color={colors.primary} /></Pressable>
        <View style={styles.timerDurationValue}><Text style={[styles.timerDurationNumber, { color: colors.text }]}>{value}</Text><Text style={[styles.timerDurationUnit, { color: colors.textMuted }]}>min</Text></View>
        <Pressable accessibilityLabel={`Increase ${label.toLowerCase()} time`} onPress={() => onAdjust(step)} style={[styles.timerStepButton, { backgroundColor: colors.card }]}><Icon name="plus" size={17} color={colors.primary} /></Pressable>
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
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { opacity: 0.65 }]}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  profileTop: { alignItems: 'center', paddingVertical: 17 },
  avatar: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontWeight: '900' },
  title: { fontSize: 24, fontWeight: '900', marginTop: 12, letterSpacing: -0.6 },
  subtitle: { fontSize: 12, marginTop: 3 },
  syncCard: { marginTop: 6 },
  syncRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  syncIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  syncTitle: { fontSize: 14, fontWeight: '800' },
  syncText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  syncButton: { minHeight: 46, marginTop: 14 },
  studyTypeCard: { padding: 14 },
  studyTypeQuestion: { fontSize: 14, fontWeight: '900' },
  studyTypeHint: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  studyTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  studyTypeOption: { width: '48%', minHeight: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  studyTypeLabel: { flex: 1, fontSize: 10, lineHeight: 13, fontWeight: '800' },
  studyTypeNotice: { fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 10 },
  themeCard: { padding: 12 },
  themeOptions: { flexDirection: 'row', gap: 8 },
  themeOption: { flex: 1, borderRadius: 13, borderWidth: 1, alignItems: 'center', paddingVertical: 13, gap: 5 },
  themeLabel: { fontSize: 11, fontWeight: '800' },
  themeHint: { fontSize: 10, lineHeight: 15, marginTop: 12, paddingHorizontal: 3 },
  settingsCard: { paddingVertical: 1 },
  setting: { minHeight: 67, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { fontSize: 13, fontWeight: '700' },
  settingDetail: { fontSize: 10, marginTop: 3 },
  footer: { textAlign: 'center', fontSize: 11, fontWeight: '700', marginTop: 26 },
  evidenceCard: { paddingVertical: 1 },
  evidenceRow: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 11 },
  evidenceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  evidenceTitle: { fontSize: 12, fontWeight: '800' },
  evidenceText: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  evidenceSource: { fontSize: 9, fontWeight: '700', marginTop: 4 },
  retentionCard: { padding: 14 },
  retentionTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  retentionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  retentionTitle: { fontSize: 13, fontWeight: '800' },
  retentionText: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  retentionOptions: { flexDirection: 'row', gap: 7, marginTop: 14 },
  retentionOption: { flex: 1, minHeight: 67, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 8, gap: 2 },
  retentionOptionLabel: { fontSize: 10, fontWeight: '900' },
  retentionOptionDetail: { fontSize: 8, fontWeight: '700' },
  retentionHint: { fontSize: 10, lineHeight: 15, marginTop: 11, paddingHorizontal: 2 },
  retentionEvidence: { fontSize: 9, lineHeight: 14, marginTop: 7, paddingHorizontal: 2 },
  timerModalRoot: { flex: 1, justifyContent: 'flex-end' },
  timerSheet: { width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 20, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  timerHandle: { width: 42, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 15 },
  timerHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  timerHeadingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timerSheetTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  timerSheetSubtitle: { fontSize: 10, marginTop: 2 },
  timerClose: { width: 34, height: 34, alignItems: 'flex-end', justifyContent: 'center' },
  timerSectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  timerPresetRow: { flexDirection: 'row', gap: 7 },
  timerPreset: { flex: 1, minHeight: 82, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 4 },
  timerPresetTitle: { fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  timerPresetDetail: { fontSize: 8, fontWeight: '700' },
  timerDurationRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  timerDuration: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 10 },
  timerDurationLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginBottom: 7 },
  timerStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  timerStepButton: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timerDurationValue: { alignItems: 'center', minWidth: 38 },
  timerDurationNumber: { fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerDurationUnit: { fontSize: 8, fontWeight: '700' },
  timerAlarmRow: { flexDirection: 'row', gap: 7 },
  timerAlarm: { flex: 1, minHeight: 75, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, gap: 3 },
  timerAlarmTitle: { fontSize: 9, fontWeight: '900' },
  timerAlarmDetail: { fontSize: 7, lineHeight: 10, textAlign: 'center' },
  timerNote: { fontSize: 9, lineHeight: 13, marginTop: 11 },
  timerError: { fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 8 },
  timerSave: { minHeight: 46, marginTop: 13 },
});
