import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { ImportAsset, StudyPack } from '../models';
import { MAX_IMPORT_BYTES } from '../services/documentProcessor';
import type { HomeUploadStatus } from '../services/homeUpload';
import type { AppColors } from '../theme';
import { HomeFileDropArea } from './HomeFileDropArea';

type Props = {
  colors: AppColors;
  onPress: () => void;
  onDropAssets: (assets: ImportAsset[]) => boolean;
  opening: boolean;
  primaryAction: boolean;
  error: string | null;
  status: HomeUploadStatus | null;
  onOpenPack: (deck: StudyPack) => void;
};

const OUTPUTS = [
  { label: 'Notes', icon: 'note-text-outline' },
  { label: 'Flashcards', icon: 'cards-outline' },
  { label: 'Practice quizzes', icon: 'clipboard-check-outline' },
] as const;

const FILE_FORMATS = [
  { label: 'PDF', icon: 'file-pdf-box', light: '#C94C4C', dark: '#FFA0A0' },
  { label: 'PPT / PPTX', icon: 'file-powerpoint-outline', light: '#C95D25', dark: '#FFAB76' },
  { label: 'Word', icon: 'file-word-box', light: '#2F67B1', dark: '#94BCFF' },
  { label: 'Text & Markdown', icon: 'file-document-outline', light: '#2F7D56', dark: '#80D9AA' },
] as const;

/** Home's second main action; this component never uploads or creates a pack itself. */
export function AddStudyMaterialCard({ colors, onPress, onDropAssets, opening, primaryAction, error, status, onOpenPack }: Props) {
  const reducedMotion = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;
  const accent = useRef(new Animated.Value(0)).current;
  const accentAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [focused, setFocused] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const wide = cardWidth > 560 && fontScale < 1.3;
  const dark = colors.mode === 'dark';
  const blue = dark ? '#A6C5FF' : '#2459BC';
  const actionColor = primaryAction ? '#FFFFFF' : blue;

  const animateAccent = () => {
    accentAnimation.current?.stop();
    accent.setValue(0);
    if (reducedMotion || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    accentAnimation.current = Animated.sequence([
      Animated.timing(accent, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(accent, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]);
    accentAnimation.current.start();
  };

  useEffect(() => {
    animateAccent();
    if (reducedMotion) { press.stopAnimation(); press.setValue(0); }
    return () => { accentAnimation.current?.stop(); press.stopAnimation(); };
  }, [accent, press, reducedMotion]);

  const animatePress = (down: boolean) => {
    press.stopAnimation();
    Animated.timing(press, { toValue: down && !reducedMotion ? 1 : 0, duration: reducedMotion ? 0 : 130, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  return (
    <Animated.View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={[styles.frame, { shadowColor: colors.shadow, transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }] }]}>
      <LinearGradient
        colors={focused ? ['#7FA6EF', '#A590E2', '#82BFC9'] : dark ? ['#3D5D80', '#605582', '#375C6B'] : ['#C8E2FF', '#DCCEF6', '#C9E7E9']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.outline}
      >
        <LinearGradient colors={dark ? ['#1B293A', '#25283C'] : ['#FCFEFF', '#F4F3FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View style={styles.heading}>
            <Animated.View
              aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              style={[styles.cloud, { backgroundColor: dark ? '#2C3D5B' : '#E9F0FF', transform: [{ translateY: accent.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}
            >
              <UploadCloud color={blue} accent={dark ? '#D2C4FF' : '#8B71D6'} />
            </Animated.View>
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Upload & Create</Text>
                {primaryAction ? <Text style={[styles.startBadge, { color: blue, backgroundColor: colors.primarySoft }]}>START HERE</Text> : null}
              </View>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{primaryAction ? 'Bring your class material. Build your first Study Pack.' : 'Turn new course material into your next study session.'}</Text>
            </View>
          </View>

          <View style={styles.outputs} accessibilityLabel="Study tools available to create: notes, flashcards, and practice quizzes">
            {OUTPUTS.map((output) => <View key={output.label} style={styles.output}>
              <MaterialCommunityIcons name={output.icon} size={15} color={dark ? '#B6A9E1' : '#6D59A5'} accessible={false} />
              <Text style={[styles.outputText, { color: colors.textSecondary }]}>{output.label}</Text>
            </View>)}
          </View>

          <HomeFileDropArea disabled={opening} onDropAssets={onDropAssets}>
            {(dragging) => <View style={[styles.selectionArea, wide && styles.selectionWide, { borderColor: dragging || focused ? blue : dark ? '#4B5874' : '#C7D2E9', backgroundColor: dragging ? colors.primarySoft : dark ? '#111C2B66' : '#FFFFFFB8' }]}>
              <View style={wide ? styles.copy : undefined}>
              <Text style={[styles.selectionTitle, { color: colors.text }]}>{dragging ? 'Drop your files to continue' : Platform.OS === 'web' ? 'Drop files here, or choose files' : 'Choose your course material'}</Text>
              <View style={styles.fileFormats} accessibilityLabel="Supported files: PDF, PowerPoint, Word, text, and Markdown">
                {FILE_FORMATS.map((format) => {
                  const color = dark ? format.dark : format.light;
                  return <View key={format.label} style={[styles.fileFormat, { backgroundColor: `${color}${dark ? '20' : '12'}` }]}>
                    <MaterialCommunityIcons name={format.icon} size={12} color={color} accessible={false} />
                    <Text style={[styles.fileFormatText, { color }]}>{format.label}</Text>
                  </View>;
                })}
              </View>
              <Text style={[styles.limit, { color: colors.textSecondary }]}>{MAX_IMPORT_BYTES / 1024 / 1024} MB per file · Combine PowerPoints, or choose one other file</Text>
              </View>
              <Pressable
                accessibilityRole="button" accessibilityLabel={opening ? 'Opening file picker' : 'Choose Files'}
                accessibilityHint="Select one PDF, PowerPoint, Word document, or text file, or multiple PowerPoints. Creating a Study Pack requires a connection and sign-in."
                accessibilityState={{ disabled: opening, busy: opening }} disabled={opening}
                onPress={onPress} onPressIn={() => { animatePress(true); animateAccent(); }} onPressOut={() => animatePress(false)}
                onHoverIn={animateAccent} onFocus={() => { setFocused(true); animateAccent(); }} onBlur={() => setFocused(false)}
                style={({ pressed }) => [styles.actionClip, wide && styles.actionWide, { opacity: opening ? 0.65 : pressed ? 0.85 : 1 }]}
              >
                <LinearGradient colors={primaryAction ? ['#326EDB', '#6C4DCB'] : dark ? ['#293F60', '#3B355A'] : ['#E5EDFF', '#EAE5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.action}>
                  {opening && !reducedMotion ? <ActivityIndicator size="small" color={actionColor} /> : <MaterialCommunityIcons name={opening ? 'clock-outline' : 'folder-open-outline'} size={20} color={actionColor} accessible={false} />}
                  <Text style={[styles.actionText, { color: actionColor }]}>{opening ? 'Opening files…' : 'Choose Files'}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={actionColor} accessible={false} />
                </LinearGradient>
              </Pressable>
            </View>}
          </HomeFileDropArea>
          <Text style={[styles.flowHint, { color: colors.textSecondary }]}>Choose files → name your class → create your Study Pack. Online processing and plan limits apply.</Text>

          {error ? <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, { backgroundColor: dark ? '#432C34' : '#FFF0F2' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" color={colors.danger} size={19} accessible={false} />
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          </View> : null}
          {status ? <GenerationStatus status={status} colors={colors} reducedMotion={reducedMotion} onOpen={() => onOpenPack(status.deck)} /> : null}
        </LinearGradient>
      </LinearGradient>
    </Animated.View>
  );
}

function GenerationStatus({ status, colors, reducedMotion, onOpen }: { status: HomeUploadStatus; colors: AppColors; reducedMotion: boolean; onOpen: () => void }) {
  const creating = status.kind === 'creating';
  const ready = status.kind === 'ready';
  const title = creating ? 'Creating study tools' : ready ? 'Your Study Pack is ready' : status.failed ? 'Study tools need another try' : 'Check study tool status';
  const action = ready ? 'Open pack' : creating ? 'View progress' : status.failed ? 'Review & retry' : 'View tools';
  const tone = ready ? colors.mode === 'dark' ? colors.mint : '#187D68' : creating ? colors.primary : colors.goldText;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={title + '. ' + status.deck.title + '. ' + status.ready + ' of ' + status.total + ' tools ready. ' + action}
    onPress={onOpen}
    style={({ pressed }) => [styles.generation, { borderTopColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
  >
    {creating && !reducedMotion ? <ActivityIndicator size="small" color={tone} /> : <MaterialCommunityIcons name={creating ? 'clock-outline' : ready ? 'check-circle-outline' : 'alert-circle-outline'} color={tone} size={22} accessible={false} />}
    <View style={styles.copy} accessibilityLiveRegion="polite">
      <Text style={[styles.generationTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.generationDetail, { color: colors.textSecondary }]}>{status.deck.title} · {status.ready} / {status.total} tools ready{status.failed ? ' · ' + status.failed + ' need retry' : ''}{status.missing ? ' · Some status information is unavailable' : ''}</Text>
      <Text style={[styles.generationAction, { color: tone }]}>{action} →</Text>
    </View>
  </Pressable>;
}

function UploadCloud({ color, accent }: { color: string; accent: string }) {
  return <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
    <Path d="M9 24H8a5.5 5.5 0 0 1-.5-11A8.7 8.7 0 0 1 24 11a6.5 6.5 0 0 1 .5 13H23" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 27V15m-4 4 4-4 4 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M25.5 4v4m-2-2h4" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />
  </Svg>;
}

const styles = StyleSheet.create({
  frame: { marginTop: 16, borderRadius: 23, shadowOffset: { width: 0, height: 3 }, shadowRadius: 12, shadowOpacity: 0.06, elevation: 2 },
  outline: { padding: 1, borderRadius: 23 },
  card: { padding: 16, borderRadius: 22, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cloud: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  title: { fontSize: 19, lineHeight: 26, fontWeight: '800', letterSpacing: -0.5 },
  startBadge: { fontSize: 8, lineHeight: 13, fontWeight: '800', letterSpacing: 0.7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  description: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  outputs: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 13, marginBottom: 13 },
  output: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  outputText: { fontSize: 10, lineHeight: 16, fontWeight: '600' },
  selectionArea: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12 },
  selectionWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectionTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  fileFormats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 5 },
  fileFormat: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7 },
  fileFormatText: { fontSize: 9, lineHeight: 13, fontWeight: '700' },
  limit: { fontSize: 10, lineHeight: 16, marginTop: 2 },
  actionClip: { marginTop: 11, borderRadius: 12, overflow: 'hidden' },
  actionWide: { marginTop: 0, flexBasis: 166, flexShrink: 0 },
  action: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '800' },
  flowHint: { fontSize: 9, lineHeight: 15, marginTop: 9 },
  error: { marginTop: 12, padding: 11, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 18 },
  generation: { minHeight: 66, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  generationTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  generationDetail: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  generationAction: { fontSize: 11, lineHeight: 18, fontWeight: '700', marginTop: 2 },
});
