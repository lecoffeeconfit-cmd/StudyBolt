import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, PrimaryButton, Screen } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';

export type RegistrationReason = 'ai' | 'sync';

export function RegistrationPromptScreen({
  reason,
  onCreateAccount,
  onSignIn,
  onNotNow,
}: {
  reason: RegistrationReason;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onNotNow: () => void;
}) {
  const { colors } = useStudyBolt();
  const aiPrompt = reason === 'ai';

  return (
    <Screen>
      <Header title={aiPrompt ? 'Unlock AI study tools' : 'Sync your study space'} onBack={onNotNow} />
      <View style={styles.content}>
        <LinearGradient
          colors={colors.neon?.hero ?? colors.night?.hero ?? ['#E4F0FF', '#F3EDFF', '#FFF2CC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: colors.border }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: colors.card }]}>
            <Icon name={aiPrompt ? 'creation' : 'cloud-sync-outline'} size={35} color={colors.primary} />
          </View>
          <View style={[styles.spark, styles.sparkOne, { backgroundColor: colors.goldBright }]} />
          <View style={[styles.spark, styles.sparkTwo, { backgroundColor: colors.mint }]} />
          <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR STUDY SPACE, READY TO GROW</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{aiPrompt ? 'Make your next study session smarter.' : 'Take your Study Packs with you.'}</Text>
          <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>
            {aiPrompt
              ? 'Create a free account to unlock StudyBolt AI and keep your learning in sync across devices.'
              : 'Create a free account to securely sync your Study Packs across your devices and unlock AI study tools.'}
          </Text>
        </LinearGradient>

        <Card style={[styles.benefits, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Benefit icon="creation" title="AI-powered study help" detail="Tutor, generated flashcards, quizzes, summaries, and more." color={colors.purple} />
          <Benefit icon="cloud-sync-outline" title="Secure cross-device sync" detail="Keep your Study Packs together wherever you study." color={colors.primary} />
          <Benefit icon="folder-heart-outline" title="Your guest work comes along" detail="Guest-created packs and courses are added to your account automatically." color={colors.mint} last />
        </Card>

        <PrimaryButton label="Create free account" icon="arrow-right" onPress={onCreateAccount} style={styles.primaryAction} />
        <Pressable accessibilityRole="button" onPress={onSignIn} style={styles.linkButton}>
          <Text style={[styles.linkText, { color: colors.primary }]}>I already have an account</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onNotNow} style={styles.laterButton}>
          <Text style={[styles.laterText, { color: colors.textMuted }]}>Keep studying as a guest</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Benefit({ icon, title, detail, color, last = false }: { icon: IconName; title: string; detail: string; color: string; last?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.benefitRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.benefitIcon, { backgroundColor: `${color}18` }]}><Icon name={icon} size={20} color={color} /></View>
      <View style={styles.benefitCopy}>
        <Text style={[styles.benefitTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.benefitDetail, { color: colors.textSecondary }]}>{detail}</Text>
      </View>
      <Icon name="check-circle-outline" size={19} color={colors.mint} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 18, paddingBottom: 28 },
  hero: { minHeight: 250, borderWidth: StyleSheet.hairlineWidth, borderRadius: 26, padding: 22, justifyContent: 'flex-end', overflow: 'hidden', marginBottom: 16 },
  heroIcon: { position: 'absolute', top: 25, right: 25, width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', shadowColor: '#1B2B62', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  spark: { position: 'absolute', width: 13, height: 13, borderRadius: 5, transform: [{ rotate: '45deg' }] },
  sparkOne: { top: 37, left: 34 },
  sparkTwo: { top: 119, right: 131 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 9 },
  heroTitle: { maxWidth: 390, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.7 },
  heroCopy: { maxWidth: 445, fontSize: 15, lineHeight: 22, marginTop: 8 },
  benefits: { paddingHorizontal: 15, paddingVertical: 3, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, marginBottom: 16 },
  benefitRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  benefitIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  benefitCopy: { flex: 1, gap: 2 },
  benefitTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  benefitDetail: { fontSize: 12, lineHeight: 17 },
  primaryAction: { marginTop: 2 },
  linkButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '800' },
  laterButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  laterText: { fontSize: 13, fontWeight: '700' },
});
