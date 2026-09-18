import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { BoltLogo, Icon, PrimaryButton } from '../components/ui';
import type { IconName } from '../components/ui';
import type { StudyType } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';

const STUDY_TYPE_OPTIONS: Array<{ id: StudyType; label: string; detail: string; icon: IconName }> = [
  { id: 'college', label: 'College', detail: 'Classes, exams, and steady progress.', icon: 'school-outline' },
  { id: 'graduate_school', label: 'Graduate School', detail: 'Deep work for advanced study.', icon: 'book-education-outline' },
  { id: 'professional', label: 'Professional / Career', detail: 'Certifications, skills, and growth.', icon: 'briefcase-outline' },
  { id: 'other', label: 'Other', detail: 'A goal that is uniquely yours.', icon: 'compass-outline' },
];

export function AccountOnboardingScreen({ onComplete }: { onComplete: (studyType: StudyType) => Promise<{ error?: string } | void> }) {
  const { colors } = useStudyBolt();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<StudyType | null>(profile?.studyType ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueSetup = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    const result = await onComplete(selected);
    setBusy(false);
    if (result?.error) setError(result.error);
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      <View style={styles.topBar}><BoltLogo compact /><View style={styles.stepPill}><Text style={[styles.stepText, { color: colors.textMuted }]}>1 MINUTE SETUP</Text></View></View>

      <LinearGradient
        colors={colors.mode === 'dark' ? ['#172A42', '#15202D', '#332918'] : ['#E8F3FF', '#F6FAFF', '#FFF4D2']}
        locations={[0, 0.7, 1]}
        style={[styles.hero, { borderColor: colors.border }]}
      >
        <View style={[styles.heroOrb, { backgroundColor: `${colors.goldBright}24` }]} />
        <View style={[styles.heroMark, { backgroundColor: colors.goldBright, shadowColor: colors.gold }]}>
          <Icon name="lightning-bolt" size={38} color={colors.onGold} />
        </View>
        <View style={[styles.heroSpark, styles.heroSparkLeft, { backgroundColor: colors.primary }]} />
        <View style={[styles.heroSpark, styles.heroSparkRight, { backgroundColor: colors.mint }]} />
      </LinearGradient>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to StudyBolt ⚡</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>What are you studying for?</Text>
        <Text style={[styles.helper, { color: colors.textMuted }]}>This helps us shape your study experience. You can change it later in Profile.</Text>
      </View>

      <View style={styles.options}>
        {STUDY_TYPE_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => {
                setSelected(option.id);
                setError(null);
              }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: isSelected ? colors.primarySoft : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: isSelected ? colors.primary : colors.cardStrong }]}>
                <Icon name={option.icon} size={22} color={isSelected ? colors.primaryText : colors.primary} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                <Text style={[styles.optionDetail, { color: colors.textSecondary }]}>{option.detail}</Text>
              </View>
              <Icon name={isSelected ? 'check-circle' : 'circle-outline'} size={22} color={isSelected ? colors.primary : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <View style={[styles.error, { backgroundColor: `${colors.danger}14` }]}>
          <Icon name="alert-circle-outline" size={19} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      <PrimaryButton
        label={busy ? 'Saving your setup…' : 'Continue'}
        icon={busy ? undefined : 'arrow-right'}
        onPress={() => void continueSetup()}
        disabled={!selected}
        loading={busy}
        style={styles.continueButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepPill: { minHeight: 28, borderRadius: radius.pill, paddingHorizontal: 10, justifyContent: 'center' },
  stepText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  hero: { height: 156, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, marginTop: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -62, bottom: -132 },
  heroMark: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 6 },
  heroSpark: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  heroSparkLeft: { left: '24%', top: 38 },
  heroSparkRight: { right: '23%', bottom: 36 },
  copy: { marginTop: 26 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { fontSize: 17, lineHeight: 23, fontWeight: '800', marginTop: 6 },
  helper: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  options: { gap: 10, marginTop: 23 },
  option: { minHeight: 82, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1 },
  optionLabel: { fontSize: 13, lineHeight: 18, fontWeight: '900' },
  optionDetail: { fontSize: 10, lineHeight: 15, marginTop: 2 },
  error: { minHeight: 46, borderRadius: 13, marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  continueButton: { marginTop: 20 },
});
