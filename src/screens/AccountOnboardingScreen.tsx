import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
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

export function AccountOnboardingScreen({ onComplete }: { onComplete: (studyType?: StudyType) => Promise<{ error?: string } | void> }) {
  const { colors } = useStudyBolt();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<StudyType | null>(profile?.studyType ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const primaryLabel = colors.mode === 'dark' ? colors.primary : '#075BC6';
  const purpleLabel = colors.mode === 'dark' ? colors.purple : '#6341CB';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const continueSetup = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await onComplete(selected ?? undefined);
      if (mounted.current && result?.error) setError(result.error);
    } catch {
      if (mounted.current) setError('We couldn’t save your setup. Please try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      <View style={styles.content}>
        <View style={styles.topBar}>
          <BoltLogo compact />
          <View style={[styles.optionalPill, { backgroundColor: colors.purpleSoft }]}>
            <Text style={[styles.optionalText, { color: purpleLabel }]}>Optional</Text>
          </View>
        </View>

        <LinearGradient
          colors={colors.mode === 'dark' ? ['#1A2B42', '#29263A'] : ['#E9F2FF', '#EFEAFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.intro, { borderColor: colors.border }]}
        >
          <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.introIcon, { backgroundColor: colors.card }]}>
            <Icon name="school-outline" size={25} color={colors.primary} />
          </View>
          <View style={styles.introCopy}>
            <Text style={[styles.eyebrow, { color: primaryLabel }]}>YOUR STUDY SPACE</Text>
            <Text style={[styles.introText, { color: colors.text }]}>A little about your studies.</Text>
          </View>
        </LinearGradient>

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>What are you studying for?</Text>
          <Text style={[styles.helper, { color: colors.textSecondary }]}>Add a category to your Profile, or continue without one. You can change it in Profile anytime.</Text>
        </View>

        <View accessibilityRole="radiogroup" accessibilityLabel="Study category, optional" style={styles.options}>
          {STUDY_TYPE_OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label}. ${option.detail}`}
                aria-checked={isSelected}
                aria-disabled={busy}
                accessibilityState={{ checked: isSelected, disabled: busy }}
                disabled={busy}
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
                <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.optionIcon, { backgroundColor: isSelected ? colors.primary : colors.purpleSoft }]}>
                  <Icon name={option.icon} size={22} color={isSelected ? colors.primaryText : colors.purple} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                  <Text style={[styles.optionDetail, { color: colors.textSecondary }]}>{option.detail}</Text>
                </View>
                <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  <Icon name={isSelected ? 'check-circle' : 'circle-outline'} size={22} color={isSelected ? colors.primary : colors.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </View>

        {selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear study category selection"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            onPress={() => { setSelected(null); setError(null); }}
            style={styles.clearButton}
          >
            <Text style={[styles.clearText, { color: primaryLabel }]}>Leave this for later</Text>
          </Pressable>
        ) : null}

        {error ? (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: `${colors.danger}14` }]}>
            <Icon name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          label={busy ? 'Saving your setup…' : selected ? 'Save and continue' : 'Continue'}
          icon={busy ? undefined : 'arrow-right'}
          onPress={() => void continueSetup()}
          loading={busy}
          style={[styles.continueButton, { backgroundColor: primaryLabel }]}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, paddingHorizontal: 20 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  optionalPill: { minHeight: 30, borderRadius: radius.pill, paddingHorizontal: 12, justifyContent: 'center' },
  optionalText: { fontSize: 12, fontWeight: '700' },
  intro: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginTop: 26, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 13 },
  introIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.8 },
  introText: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 3 },
  copy: { marginTop: 28 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.7 },
  helper: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  options: { gap: 10, marginTop: 22 },
  option: { minHeight: 84, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, lineHeight: 21, fontWeight: '800' },
  optionDetail: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  clearButton: { minHeight: 44, alignSelf: 'center', paddingHorizontal: 14, marginTop: 8, justifyContent: 'center' },
  clearText: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  error: { minHeight: 48, borderRadius: 14, marginTop: 14, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  continueButton: { marginTop: 20, minHeight: 54 },
});
