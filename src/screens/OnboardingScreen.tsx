import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { BoltLogo, Icon, PrimaryButton } from '../components/ui';
import type { IconName } from '../components/ui';
import { initialState } from '../data/mockStudyPacks';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyMaterialPicker } from '../hooks/useStudyMaterialPicker';
import type { ImportAsset } from '../models';
import { findOnboardingSample } from '../services/onboarding';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';

export function OnboardingScreen({ onComplete, onTrySample, onImport, onSignIn }: {
  onComplete: () => void;
  onTrySample: () => void;
  onImport: (assets: ImportAsset[]) => void;
  onSignIn: () => void;
}) {
  const { colors, state, setTheme } = useStudyBolt();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<'welcome' | 'practice'>('welcome');
  const [revealed, setRevealed] = useState(false);
  const entrance = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const { opening, error, chooseFiles } = useStudyMaterialPicker(onImport);
  const sample = findOnboardingSample(state.decks) ?? findOnboardingSample(initialState.decks);
  const card = sample?.flashcards[0];
  const wide = width >= 900 && fontScale < 1.4;
  const compact = height < 740;
  const practice = step === 'practice' && Boolean(card);
  const primaryLabel = colors.mode === 'dark' ? colors.primary : '#075BC6';
  const purpleLabel = colors.mode === 'dark' ? colors.purple : '#6341CB';
  // Web OAuth reloads the page, so sign in before selecting browser File objects.
  const signInBeforeFiles = Platform.OS === 'web' && !user;

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    entrance.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) return;
    const animation = Animated.timing(entrance, { toValue: 1, duration: 320, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion, step]);

  const revealAnswer = () => {
    setRevealed(true);
    // Web uses the live region below; VoiceOver and TalkBack get the same answer.
    if (Platform.OS !== 'web' && card) AccessibilityInfo.announceForAccessibility(`Answer. ${card.back}`);
  };

  const startPractice = () => {
    setRevealed(false);
    setStep('practice');
    if (Platform.OS !== 'web' && card) AccessibilityInfo.announceForAccessibility(`Sample practice. Try answering before you reveal. ${card.front}`);
  };

  const fileActionLabel = opening ? 'Opening your files…' : signInBeforeFiles ? 'Sign in to add my material' : 'Choose my files';
  const chooseMaterial = () => { if (signInBeforeFiles) onSignIn(); else void chooseFiles(); };

  const actionPanel = (
    <View style={[styles.actions, wide && styles.actionsWide]}>
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: `${colors.danger}14` }]}><Icon name="alert-circle-outline" size={20} color={colors.danger} /><Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text></View> : null}
      <PrimaryButton
        label={practice ? 'Open sample flashcards' : fileActionLabel}
        icon={practice ? 'cards-outline' : 'cloud-upload-outline'}
        loading={opening}
        onPress={practice ? onTrySample : chooseMaterial}
        style={{ backgroundColor: primaryLabel }}
      />
      {!practice ? <Text style={[styles.formats, { color: colors.textSecondary }]}>PDF · PowerPoint · Word · text notes</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={practice ? fileActionLabel : 'Try a quick interactive sample'} disabled={opening} onPress={practice ? chooseMaterial : startPractice} style={({ pressed }) => [styles.sampleButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed || opening ? 0.65 : 1 }]}>
        <Icon name={practice ? 'cloud-upload-outline' : 'play-circle-outline'} size={22} color={colors.purple} />
        <Text style={[styles.sampleText, { color: colors.text }]}>{practice ? fileActionLabel : 'Try a quick sample'}</Text>
        <Icon name="arrow-right" size={18} color={colors.textSecondary} />
      </Pressable>
      <Text style={[styles.reassurance, { color: colors.textSecondary }]}>{practice ? 'Keep practicing with the sample without an account, or add your own material when you’re ready.' : user ? 'You’ll name your class before online processing. File and plan limits apply.' : 'Processing your files requires sign-in and an internet connection. File and plan limits apply. Try the sample without an account.'}</Text>
      <Pressable accessibilityRole="button" onPress={onComplete} disabled={opening} style={[styles.exploreButton, { marginBottom: practice || wide ? Math.max(insets.bottom, 16) : 0 }]}><Text style={[styles.exploreText, { color: colors.textSecondary }]}>{user ? 'Back to my study space' : 'Explore on my own'}</Text></Pressable>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.topBar, wide && styles.topBarWide]}>
        <BoltLogo compact />
        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${colors.mode === 'dark' ? 'light' : 'dark'} mode`} onPress={() => setTheme(colors.mode === 'dark' ? 'light' : 'dark')} style={[styles.themeButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Icon name={colors.mode === 'dark' ? 'weather-sunny' : 'weather-night'} size={20} color={colors.primary} />
          </Pressable>
          {!user ? <Pressable accessibilityRole="button" onPress={onSignIn} disabled={opening} style={styles.textButton}><Text style={[styles.link, { color: primaryLabel }]}>Sign in</Text></Pressable> : null}
        </View>
      </View>

      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, wide && styles.scrollContentWide]}>
        <View style={[styles.progressRow, { borderColor: colors.border }]}>
          {practice ? <Pressable accessibilityRole="button" accessibilityLabel="Back to welcome" onPress={() => setStep('welcome')} style={styles.backButton}><Icon name="arrow-left" size={20} color={colors.text} /></Pressable> : null}
          <View accessible accessibilityLabel={practice ? 'Optional sample, step 2 of 2' : 'Welcome, step 1 of 2'} style={styles.stepRow}>
            <View style={[styles.stepDot, { backgroundColor: practice ? colors.primarySoft : primaryLabel }]}><Text style={[styles.stepNumber, { color: practice ? primaryLabel : colors.primaryText }]}>{practice ? '✓' : '1'}</Text></View>
            <Text style={[styles.stepLabel, { color: practice ? colors.textSecondary : colors.text }]}>Explore</Text>
            <View style={[styles.stepLine, { backgroundColor: colors.border }]} />
            <View style={[styles.stepDot, { backgroundColor: practice ? primaryLabel : colors.cardStrong }]}><Text style={[styles.stepNumber, { color: practice ? colors.primaryText : colors.textSecondary }]}>2</Text></View>
            <Text style={[styles.stepLabel, { color: practice ? colors.text : colors.textSecondary }]}>Try it</Text>
          </View>
          <Text style={[styles.optional, { color: colors.textSecondary }]}>Optional tour</Text>
        </View>

        <Animated.View style={[styles.main, wide && styles.mainWide, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 10, 0] }) }] }]}>
          <View style={[styles.copy, wide && styles.copyWide]}>
            <View style={styles.eyebrowRow}><Icon name={practice ? 'cards-outline' : 'lightning-bolt'} size={16} color={colors.purple} /><Text style={[styles.eyebrow, { color: purpleLabel }]}>{practice ? 'A SMALL FIRST STEP' : 'YOUR STUDY SPACE, SIMPLIFIED'}</Text></View>
            <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.title, compact && !wide && styles.titleCompact, { color: colors.text }]}>{practice ? 'Try remembering.\nThen reveal.' : 'Your material.\nA clearer way to study.'}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{practice ? 'Take a moment to answer in your head. Checking what you remember helps you find what to review next.' : 'Turn lecture slides and notes into a Study Pack. Get clear notes, flashcards, and practice questions in one place.'}</Text>
            {!practice && wide ? <View style={styles.benefits}>
              <Benefit icon="file-document-outline" label="Bring one lecture to start" />
              <Benefit icon="cards-outline" label="Practice, then revisit what needs work" />
              <Benefit icon="calendar-check-outline" label="Build a study plan when you’re ready" />
            </View> : null}
            {!practice && !wide ? actionPanel : null}
          </View>

          <View style={[styles.visualColumn, wide && styles.visualColumnWide]}>
            {practice && card ? (
              <View style={[styles.practiceCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <View style={styles.practiceHeader}>
                  <View style={[styles.samplePill, { backgroundColor: colors.purpleSoft }]}><Icon name="flask-outline" size={15} color={colors.purple} /><Text style={[styles.sampleLabel, { color: colors.mode === 'dark' ? colors.purple : '#6341CB' }]}>BIOLOGY SAMPLE</Text></View>
                  <Icon name="cards-outline" size={24} color={colors.primary} />
                </View>
                <Text style={[styles.question, { color: colors.text }]}>{card.front}</Text>
                {!revealed ? <>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>No score. Just a chance to try it.</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Reveal the sample answer" onPress={revealAnswer} style={({ pressed }) => [styles.revealButton, { backgroundColor: colors.primarySoft, borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}><Icon name="eye-outline" size={19} color={colors.primary} /><Text style={[styles.revealText, { color: colors.mode === 'dark' ? colors.primary : '#075BC6' }]}>Reveal answer</Text></Pressable>
                </> : <View accessibilityLiveRegion="polite" style={[styles.answer, { borderColor: colors.border }]}>
                  <Text style={[styles.answerLabel, { color: colors.mode === 'dark' ? colors.mint : '#12775E' }]}>CHECK YOUR UNDERSTANDING</Text>
                  <Text style={[styles.answerText, { color: colors.text }]}>{card.back}</Text>
                  <View style={styles.sourceRow}><Icon name="file-document-outline" size={15} color={colors.textSecondary} /><Text style={[styles.source, { color: colors.textSecondary }]}>{card.source.label} · {sample?.courseName}</Text></View>
                  <Text style={[styles.takeaway, { color: colors.textSecondary }]}>Remembered it? Try another question. Still learning? Review the source, then try again later.</Text>
                </View>}
              </View>
            ) : <StudyToolkitVisual compact={compact && !wide} />}
          </View>
        </Animated.View>

        {practice || wide ? actionPanel : null}
      </ScrollView>
    </View>
  );
}

function Benefit({ icon, label }: { icon: IconName; label: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.benefit}><View style={[styles.benefitIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={17} color={colors.primary} /></View><Text style={[styles.benefitLabel, { color: colors.textSecondary }]}>{label}</Text></View>;
}

function StudyToolkitVisual({ compact }: { compact: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <LinearGradient aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" colors={colors.mode === 'dark' ? ['#182A41', '#202538', '#28223B'] : ['#E7F1FF', '#EDF0FF', '#F0E9FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.toolkitVisual, compact && styles.toolkitCompact, { borderColor: colors.border }]}>
      <View style={[styles.orb, { backgroundColor: `${colors.primary}12` }]} />
      <Text style={[styles.visualEyebrow, { color: colors.textSecondary }]}>HOW IT WORKS</Text>
      <View style={[styles.lectureCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}><Icon name="file-document-outline" size={32} color={colors.primary} /></View>
        <View style={{ flex: 1 }}><Text style={[styles.lectureTitle, { color: colors.text }]}>Your lecture</Text><Text style={[styles.lectureSubtitle, { color: colors.textSecondary }]}>Start with your course material</Text></View>
        <Icon name="cloud-upload-outline" size={23} color={colors.primary} />
      </View>
      <View style={styles.connectingLine}><View style={[styles.line, { backgroundColor: colors.mode === 'dark' ? '#5B6884' : '#BDC8E6' }]} /><View style={[styles.boltCircle, { backgroundColor: colors.purpleSoft }]}><Icon name="lightning-bolt" size={22} color={colors.purple} /></View><View style={[styles.line, { backgroundColor: colors.mode === 'dark' ? '#5B6884' : '#BDC8E6' }]} /></View>
      <View style={styles.toolRow}>
        {([{ label: 'Notes', icon: 'text-box-outline', color: colors.primary, background: colors.primarySoft }, { label: 'Flashcards', icon: 'cards-outline', color: colors.purple, background: colors.purpleSoft }, { label: 'Practice', icon: 'help-circle-outline', color: colors.mode === 'dark' ? colors.mint : '#12775E', background: colors.mintSoft }] satisfies Array<{ label: string; icon: IconName; color: string; background: string }>).map((tool) => <View key={tool.label} style={[styles.tool, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={[styles.toolIcon, { backgroundColor: tool.background }]}><Icon name={tool.icon} size={25} color={tool.color} /></View><Text style={[styles.toolLabel, { color: colors.text }]}>{tool.label}</Text></View>)}
      </View>
      <View style={styles.visualCaption}><Icon name="arrow-right" size={16} color={colors.purple} /><Text style={[styles.captionText, { color: colors.textSecondary }]}>From material to meaningful practice</Text></View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { width: '100%', maxWidth: 680, alignSelf: 'center', minHeight: 64, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topBarWide: { maxWidth: 1100, minHeight: 80 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  themeButton: { width: 44, height: 44, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textButton: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '800' },
  scrollContent: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingBottom: 20 },
  scrollContentWide: { maxWidth: 1100 },
  progressRow: { minHeight: 52, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumber: { fontSize: 12, fontWeight: '800' },
  stepLabel: { fontSize: 12, fontWeight: '700' },
  stepLine: { width: 18, height: 1, marginHorizontal: 2 },
  optional: { fontSize: 12, marginLeft: 'auto' },
  backButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  main: { gap: 24, flexGrow: 1, justifyContent: 'center' },
  mainWide: { flexDirection: 'row', alignItems: 'center', gap: 44, paddingVertical: 20 },
  copy: { gap: 12 },
  copyWide: { flex: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { flexShrink: 1, fontSize: 11, lineHeight: 17, fontWeight: '800', letterSpacing: 0.9 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1.2 },
  titleCompact: { fontSize: 31, lineHeight: 36 },
  body: { fontSize: 15, lineHeight: 23, maxWidth: 510 },
  benefits: { gap: 10, marginTop: 7 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  benefitLabel: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  visualColumn: { width: '100%' },
  visualColumnWide: { flex: 1 },
  toolkitVisual: { borderRadius: radius.xl, borderWidth: 1, padding: 22, overflow: 'hidden' },
  toolkitCompact: { padding: 17 },
  orb: { position: 'absolute', width: 280, height: 280, borderRadius: 140, right: -150, top: -155 },
  visualEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 18 },
  lectureCard: { borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 2 },
  fileIcon: { width: 49, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  lectureTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  lectureSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  connectingLine: { height: 52, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1 },
  boltCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toolRow: { flexDirection: 'row', gap: 8 },
  tool: { flex: 1, borderRadius: 17, borderWidth: 1, paddingVertical: 14, alignItems: 'center', gap: 9 },
  toolIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 11, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  visualCaption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 },
  captionText: { flexShrink: 1, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  actions: { gap: 10, marginTop: 14 },
  actionsWide: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 30 },
  formats: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: -2, marginBottom: 3 },
  sampleButton: { minHeight: 56, paddingHorizontal: 17, paddingVertical: 12, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sampleText: { flex: 1, fontSize: 15, lineHeight: 21, fontWeight: '800' },
  reassurance: { fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 },
  exploreButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 5, paddingVertical: 12 },
  exploreText: { fontSize: 13, lineHeight: 19, fontWeight: '600', textDecorationLine: 'underline' },
  error: { borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 14, marginBottom: 2 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 20 },
  practiceCard: { padding: 23, borderWidth: 1, borderRadius: radius.xl, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 2 },
  practiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  samplePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill },
  sampleLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.7, flexShrink: 1 },
  question: { fontSize: 23, lineHeight: 31, fontWeight: '800', letterSpacing: -0.4, marginTop: 27 },
  hint: { fontSize: 13, lineHeight: 20, marginTop: 12 },
  revealButton: { minHeight: 50, borderRadius: 14, borderWidth: 1, marginTop: 23, paddingHorizontal: 12, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  revealText: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  answer: { marginTop: 22, paddingTop: 20, borderTopWidth: 1, gap: 12 },
  answerLabel: { fontSize: 10, lineHeight: 16, fontWeight: '800', letterSpacing: 0.7 },
  answerText: { fontSize: 16, lineHeight: 25 },
  sourceRow: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  source: { flex: 1, fontSize: 12, lineHeight: 18 },
  takeaway: { fontSize: 13, lineHeight: 20 },
});
