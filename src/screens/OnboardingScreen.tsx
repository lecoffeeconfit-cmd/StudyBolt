import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BoltLogo, Icon, PrimaryButton } from '../components/ui';
import type { IconName } from '../components/ui';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';

type OnboardingPage = {
  eyebrow: string;
  title: string;
  body: string;
  icon: IconName;
};

const PAGES: OnboardingPage[] = [
  {
    eyebrow: 'ONE UPLOAD',
    title: 'Bring one lecture.\nLeave with a plan.',
    body: 'Add a PDF, PowerPoint, or your own notes once. StudyBolt turns it into an organized study pack you can use offline.',
    icon: 'cloud-upload-outline',
  },
  {
    eyebrow: 'YOUR STUDY TOOLKIT',
    title: 'Everything you need,\nalready connected.',
    body: 'Move naturally between clear notes, active-recall cards, quick quizzes, and audio review.',
    icon: 'creation-outline',
  },
  {
    eyebrow: 'BUILT AROUND YOUR TIME',
    title: 'Small sessions.\nReal momentum.',
    body: 'Set your deadline and get a practical plan that focuses first on what still needs work.',
    icon: 'calendar-check-outline',
  },
];

export function OnboardingScreen({
  onComplete,
  onTrySample,
}: {
  onComplete: () => void;
  onTrySample: () => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [pageIndex, setPageIndex] = useState(0);
  const pageEntrance = useRef(new Animated.Value(1)).current;
  const page = PAGES[pageIndex]!;
  const isLast = pageIndex === PAGES.length - 1;
  const compact = height < 720;

  useEffect(() => {
    pageEntrance.setValue(0);
    if (reducedMotion) {
      pageEntrance.setValue(1);
      return;
    }
    Animated.spring(pageEntrance, {
      toValue: 1,
      damping: 18,
      stiffness: 170,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [pageEntrance, pageIndex, reducedMotion]);

  const next = () => {
    if (isLast) onComplete();
    else setPageIndex((current) => Math.min(current + 1, PAGES.length - 1));
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <View style={styles.topBar}>
        <BoltLogo compact />
        {!isLast ? (
          <Pressable accessibilityRole="button" onPress={onComplete} hitSlop={10} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      <Animated.View style={[styles.content, compact && styles.contentCompact, { opacity: pageEntrance, transform: [{ translateX: pageEntrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
        <LinearGradient
          colors={colors.mode === 'dark' ? ['#182839', '#11171F', '#302713'] : ['#E7F1FF', '#F6FAFF', '#FFF4D2']}
          locations={[0, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.visual, compact && styles.visualCompact, { borderColor: colors.border }]}
        >
          <View style={[styles.orb, styles.orbTop, { backgroundColor: `${colors.goldBright}24` }]} />
          <View style={[styles.orb, styles.orbBottom, { backgroundColor: `${colors.mint}22` }]} />
          {pageIndex === 0 ? <UploadVisual /> : pageIndex === 1 ? <ToolkitVisual /> : <PlanVisual />}
        </LinearGradient>

        <View style={[styles.copy, compact && styles.copyCompact]}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowIcon, { backgroundColor: colors.goldSoft }]}>
              <Icon name={page.icon} size={15} color={colors.goldText} />
            </View>
            <Text style={[styles.eyebrow, { color: colors.goldText }]}>{page.eyebrow}</Text>
          </View>
          <Text style={[styles.title, compact && styles.titleCompact, { color: colors.text }]}>{page.title}</Text>
          <Text style={[styles.body, compact && styles.bodyCompact, { color: colors.textSecondary }]}>{page.body}</Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: PAGES.length, now: pageIndex + 1 }} style={styles.progressRow}>
          {PAGES.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[
                styles.progressSegment,
                { backgroundColor: index <= pageIndex ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {pageIndex > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous onboarding page"
              onPress={() => setPageIndex((current) => Math.max(0, current - 1))}
              style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Icon name="arrow-left" size={21} color={colors.text} />
            </Pressable>
          ) : null}
          <PrimaryButton
            label={isLast ? 'Start with my slides' : 'Continue'}
            icon={isLast ? 'arrow-right' : undefined}
            onPress={next}
            style={styles.primaryAction}
          />
        </View>

        {isLast ? (
          <Pressable accessibilityRole="button" onPress={onTrySample} style={styles.sampleButton}>
            <Icon name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.sampleText, { color: colors.primary }]}>Explore the Biology demo instead</Text>
          </Pressable>
        ) : (
          <Text style={[styles.pageCount, { color: colors.textMuted }]}>{pageIndex + 1} of {PAGES.length}</Text>
        )}
      </View>
    </View>
  );
}

function UploadVisual() {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.uploadScene}>
      <View style={[styles.backSheet, styles.backSheetLeft, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <View style={[styles.backSheet, styles.backSheetRight, { backgroundColor: colors.card, borderColor: colors.border }]} />
      <View style={[styles.document, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
        <View style={[styles.fileMark, { backgroundColor: colors.primarySoft }]}><Icon name="file-document-outline" size={32} color={colors.primary} /></View>
        <View style={styles.documentLines}>
          <View style={[styles.documentLine, styles.documentLineLong, { backgroundColor: colors.text }]} />
          <View style={[styles.documentLine, { backgroundColor: colors.border }]} />
          <View style={[styles.documentLine, styles.documentLineShort, { backgroundColor: colors.border }]} />
        </View>
      </View>
      <View style={[styles.floatingBadge, styles.pdfBadge, { backgroundColor: colors.mode === 'dark' ? '#392126' : '#FFF1F2' }]}>
        <Icon name="file-pdf-box" size={19} color={colors.mode === 'dark' ? '#F08A95' : '#EC5362'} />
        <Text style={[styles.pdfText, colors.mode === 'dark' && { color: '#F08A95' }]}>PDF</Text>
      </View>
      <View style={[styles.uploadBubble, { backgroundColor: colors.goldBright, shadowColor: colors.gold }]}>
        <Icon name="arrow-up" size={27} color={colors.onGold} />
      </View>
      <View style={[styles.readyBadge, { backgroundColor: colors.mintSoft }]}>
        <Icon name="check-circle" size={18} color={colors.mint} />
        <Text style={[styles.readyText, { color: colors.mint }]}>Ready offline</Text>
      </View>
    </View>
  );
}

const TOOLS: Array<{ label: string; icon: IconName; tone: 'blue' | 'mint' | 'purple' | 'gold' }> = [
  { label: 'Notes', icon: 'text-box-outline', tone: 'blue' },
  { label: 'Cards', icon: 'cards-outline', tone: 'purple' },
  { label: 'Quiz', icon: 'help-circle-outline', tone: 'mint' },
  { label: 'Audio', icon: 'headphones', tone: 'gold' },
];

function ToolkitVisual() {
  const { colors } = useStudyBolt();
  const tone = {
    blue: { background: colors.primarySoft, foreground: colors.primary },
    mint: { background: colors.mintSoft, foreground: colors.mint },
    purple: { background: colors.purpleSoft, foreground: colors.purple },
    gold: colors.mode === 'dark'
      ? { background: '#382F1E', foreground: '#E8BD67' }
      : { background: '#FFF4D8', foreground: '#D48A00' },
  };
  return (
    <View style={styles.toolScene}>
      <View style={[styles.sourcePill, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.sourceIcon, { backgroundColor: colors.primarySoft }]}><Icon name="file-document-outline" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sourceTitle, { color: colors.text }]}>Biology lecture</Text>
          <Text style={[styles.sourceMeta, { color: colors.textMuted }]}>42 slides</Text>
        </View>
        <Icon name="lightning-bolt" size={19} color={colors.goldText} />
      </View>
      <View style={styles.toolGrid}>
        {[TOOLS.slice(0, 2), TOOLS.slice(2, 4)].map((row, rowIndex) => (
          <View key={rowIndex} style={styles.toolRow}>
            {row.map((tool) => (
              <View key={tool.label} style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <View style={[styles.toolIcon, { backgroundColor: tone[tool.tone].background }]}>
                  <Icon name={tool.icon} size={22} color={tone[tool.tone].foreground} />
                </View>
                <Text style={[styles.toolLabel, { color: colors.text }]}>{tool.label}</Text>
                <Icon name="check-circle" size={14} color={colors.mint} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function PlanVisual() {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.planCard, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.planHeader}>
        <View>
          <Text style={[styles.planKicker, { color: colors.primary }]}>EXAM IN 3 DAYS</Text>
          <Text style={[styles.planTitle, { color: colors.text }]}>Your study rhythm</Text>
        </View>
        <View style={[styles.planBolt, { backgroundColor: colors.goldSoft }]}><Icon name="lightning-bolt" size={20} color={colors.goldText} /></View>
      </View>
      <PlanRow day="Today" task="Notes + cards" minutes="25 min" progress={1} />
      <PlanRow day="Tomorrow" task="Quiz weak spots" minutes="20 min" progress={0.66} />
      <PlanRow day="Review" task="Quick listen" minutes="15 min" progress={0.32} last />
      <View style={[styles.momentumPill, { backgroundColor: colors.mintSoft }]}>
        <Icon name="trending-up" size={18} color={colors.mint} />
        <Text style={[styles.momentumText, { color: colors.mint }]}>A little progress every day</Text>
      </View>
    </View>
  );
}

function PlanRow({ day, task, minutes, progress, last = false }: { day: string; task: string; minutes: string; progress: number; last?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.planRow}>
      <View style={styles.timeline}>
        <View style={[styles.timelineDot, { backgroundColor: progress === 1 ? colors.mint : colors.primary }]} />
        {!last ? <View style={[styles.timelineLine, { backgroundColor: colors.border }]} /> : null}
      </View>
      <View style={styles.planCopy}>
        <View style={styles.planTextRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.planDay, { color: colors.text }]}>{day}</Text>
            <Text style={[styles.planTask, { color: colors.textSecondary }]}>{task}</Text>
          </View>
          <Text style={[styles.planMinutes, { color: colors.textMuted }]}>{minutes}</Text>
        </View>
        <View style={[styles.planTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.planFill, { backgroundColor: progress === 1 ? colors.mint : colors.primary, width: `${progress * 100}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipButton: { minWidth: 48, minHeight: 42, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontSize: 13, fontWeight: '700' },
  content: { flex: 1, justifyContent: 'center', paddingVertical: 16 },
  contentCompact: { paddingVertical: 8 },
  visual: { height: 300, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'center', padding: 24 },
  visualCompact: { height: 260, padding: 18 },
  orb: { position: 'absolute', width: 190, height: 190, borderRadius: 95 },
  orbTop: { top: -105, right: -55 },
  orbBottom: { bottom: -125, left: -45 },
  copy: { marginTop: 27 },
  copyCompact: { marginTop: 19 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  eyebrowIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 32, lineHeight: 36, fontWeight: '900', letterSpacing: -1.1 },
  titleCompact: { fontSize: 28, lineHeight: 32 },
  body: { marginTop: 12, fontSize: 15, lineHeight: 21, maxWidth: 500 },
  bodyCompact: { marginTop: 8, fontSize: 14, lineHeight: 19 },
  footer: { paddingTop: 6 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 17 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  backButton: { width: 54, minHeight: 54, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { flex: 1 },
  sampleButton: { height: 42, marginTop: 5, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
  sampleText: { fontSize: 13, fontWeight: '800' },
  pageCount: { height: 42, paddingTop: 12, textAlign: 'center', fontSize: 11, fontWeight: '700' },

  uploadScene: { height: 225, alignItems: 'center', justifyContent: 'center' },
  backSheet: { position: 'absolute', width: 124, height: 154, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth },
  backSheetLeft: { transform: [{ rotate: '-10deg' }], left: 31, opacity: 0.72 },
  backSheetRight: { transform: [{ rotate: '9deg' }], right: 31, opacity: 0.72 },
  document: { width: 142, height: 178, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 19, alignItems: 'center', shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 4 },
  fileMark: { width: 56, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  documentLines: { alignSelf: 'stretch', alignItems: 'center', marginTop: 19, gap: 8 },
  documentLine: { width: '78%', height: 6, borderRadius: 3 },
  documentLineLong: { width: '90%', opacity: 0.78 },
  documentLineShort: { width: '55%' },
  floatingBadge: { position: 'absolute', minHeight: 35, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pdfBadge: { left: 4, top: 34, transform: [{ rotate: '-4deg' }] },
  pdfText: { color: '#D94656', fontSize: 10, fontWeight: '900' },
  uploadBubble: { position: 'absolute', right: 2, top: 42, width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 13, elevation: 5 },
  readyBadge: { position: 'absolute', bottom: 14, right: 3, minHeight: 38, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  readyText: { fontSize: 10, fontWeight: '900' },

  toolScene: { height: 221, justifyContent: 'center' },
  sourcePill: { minHeight: 61, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 10, marginBottom: 11 },
  sourceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sourceTitle: { fontSize: 12, fontWeight: '800' },
  sourceMeta: { marginTop: 2, fontSize: 9, fontWeight: '600' },
  toolGrid: { gap: 9 },
  toolRow: { flexDirection: 'row', gap: 9 },
  toolCard: { flex: 1, minWidth: 0, minHeight: 70, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 7, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.05, shadowRadius: 9, elevation: 1 },
  toolIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { flex: 1, fontSize: 11, fontWeight: '800' },

  planCard: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 17, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 3 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  planKicker: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.9 },
  planTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', marginTop: 2 },
  planBolt: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planRow: { minHeight: 48, flexDirection: 'row' },
  timeline: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  timelineLine: { width: 2, flex: 1, marginVertical: 3 },
  planCopy: { flex: 1, paddingLeft: 7 },
  planTextRow: { flexDirection: 'row', alignItems: 'flex-start' },
  planDay: { fontSize: 11, fontWeight: '800' },
  planTask: { fontSize: 9, marginTop: 1 },
  planMinutes: { fontSize: 9, fontWeight: '700' },
  planTrack: { height: 4, borderRadius: 2, marginTop: 7, overflow: 'hidden' },
  planFill: { height: '100%', borderRadius: 2 },
  momentumPill: { minHeight: 34, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  momentumText: { fontSize: 10, fontWeight: '900' },
});
