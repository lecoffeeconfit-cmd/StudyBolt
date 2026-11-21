import { LoadingArtwork } from './StudyBoltLoading';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState, type Ref } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { ImportAsset, StudyPack } from '../models';
import { MAX_IMPORT_BYTES } from '../services/documentProcessor';
import type { HomeUploadStatus } from '../services/homeUpload';
import type { AppColors } from '../theme';
import { HomeFileDropArea } from './HomeFileDropArea';

type Props = {
  colors: AppColors;
  actionRef: Ref<View>;
  courseName?: string;
  onClearCourse: () => void;
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
  { label: 'PDF', icon: 'file-pdf-box', light: '#A9363E', dark: '#FFA0A0' },
  { label: 'PPT / PPTX', icon: 'file-powerpoint-outline', light: '#92421D', dark: '#FFAB76' },
  { label: 'Word & Pages', icon: 'file-word-box', light: '#245CA2', dark: '#94BCFF' },
  { label: 'Text & Markdown', icon: 'file-document-outline', light: '#236747', dark: '#80D9AA' },
  { label: 'Spreadsheets', icon: 'file-table-outline', light: '#226052', dark: '#83D5C2' },
  { label: 'Images', icon: 'image-outline', light: '#64429E', dark: '#C9B0F8' },
] as const;

/** Home's second main action; this component never uploads or creates a pack itself. */
export function AddStudyMaterialCard({ colors, actionRef, courseName, onClearCourse, onPress, onDropAssets, opening, primaryAction, error, status, onOpenPack }: Props) {
  const reducedMotion = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);
  const [cardWidth, setCardWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const wide = cardWidth >= 500 && fontScale < 1.3;
  const dark = colors.mode === 'dark';
  const blue = dark ? colors.primary : '#075BC6';
  const actionBackground = dark ? colors.primary : '#1268D9';
  useEffect(() => {
    if (reducedMotion) { press.stopAnimation(); press.setValue(0); }
    return () => press.stopAnimation();
  }, [press, reducedMotion]);
  const animatePress = (down: boolean) => {
    press.stopAnimation();
    if (reducedMotion) return;
    Animated.timing(press, { toValue: down ? 1 : 0, duration: 110, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  return (
    <Animated.View onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)} style={[styles.card, { backgroundColor: colors.card, borderColor: focused ? blue : colors.border, transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.99] }) }] }]}>
      <View style={styles.heading}>
        <View aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.cloud, { backgroundColor: colors.primarySoft }]}><MaterialCommunityIcons name="file-upload-outline" size={24} color={blue} /></View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Add Course Material</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{primaryAction ? 'Start with a study guide, lecture, or your own notes.' : 'Turn a study guide, lecture, or notes into a Study Pack.'}</Text>
        </View>
      </View>
      {courseName ? <View style={[styles.targetCourse, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.copy, styles.limitText, { color: colors.text }]}>Adding to {courseName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear upload class" onPress={onClearCourse} style={styles.clearCourse}>
          <Text style={[styles.fileFormatText, { color: blue }]}>Clear</Text>
        </Pressable>
      </View> : null}
      {primaryAction ? <View style={styles.outputs} accessibilityLabel="Create notes, flashcards, and practice quizzes">
        {OUTPUTS.map((output) => <View key={output.label} style={styles.output}><MaterialCommunityIcons name={output.icon} size={16} color={blue} accessible={false} /><Text style={[styles.outputText, { color: colors.textSecondary }]}>{output.label}</Text></View>)}
      </View> : null}
      <HomeFileDropArea disabled={opening} onDropAssets={onDropAssets}>
        {(dragging) => <View style={[styles.selectionArea, wide && styles.selectionWide, { backgroundColor: dragging ? colors.primarySoft : colors.card, borderColor: dragging ? blue : colors.border }]}>
          <View style={styles.copy}>
            {Platform.OS === 'web' || dragging ? <Text style={[styles.selectionTitle, { color: colors.text }]}>{dragging ? 'Drop your files to continue' : 'Drop files here, or choose files'}</Text> : null}
            <View style={styles.fileFormats} accessibilityLabel="Supported files include PDF, PowerPoint, Word, Pages, text, spreadsheets, and images">
              {FILE_FORMATS.map((format) => {
                const color = dark ? format.dark : format.light;
                return <View key={format.label} style={[styles.fileFormat, { backgroundColor: color + (dark ? '18' : '0C') }]}><MaterialCommunityIcons name={format.icon} size={14} color={color} accessible={false} /><Text style={[styles.fileFormatText, { color }]}>{format.label}</Text></View>;
              })}
            </View>
            <Text style={[styles.limit, styles.limitText, { color: colors.textSecondary }]}>{MAX_IMPORT_BYTES / 1024 / 1024} MB per file · Bundle PowerPoints or choose one other file.</Text>
          </View>
          <Pressable ref={actionRef} accessibilityRole="button" accessibilityLabel={opening ? 'Opening file picker' : 'Choose Files'} accessibilityHint={courseName ? `Opens upload options for ${courseName}.` : 'Opens upload options for a Study Pack.'} accessibilityState={{ disabled: opening, busy: opening }} disabled={opening} onPress={onPress} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => [styles.action, wide && styles.actionWide, { backgroundColor: actionBackground, opacity: opening || pressed ? 0.75 : 1 }]}>
            {opening && !reducedMotion ? <LoadingArtwork compact colors={{ ...colors, primary: colors.primaryText }} /> : <MaterialCommunityIcons name="folder-open-outline" size={21} color={colors.primaryText} accessible={false} />}
            <Text style={[styles.actionText, { color: colors.primaryText }]}>{opening ? 'Opening files…' : 'Choose Files'}</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color={colors.primaryText} accessible={false} />
          </Pressable>
        </View>}
      </HomeFileDropArea>
      <Text style={[styles.flowHint, styles.limitText, { color: colors.textSecondary }]}>Create a Study Pack as a guest or with an account. Internet and plan limits apply.</Text>
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.error, { backgroundColor: dark ? '#432C34' : '#FFF0F2' }]}><MaterialCommunityIcons name="alert-circle-outline" color={colors.danger} size={20} accessible={false} /><Text style={[styles.errorText, { color: colors.text }]}>{error}</Text></View> : null}
      {status ? <GenerationStatus status={status} colors={colors} reducedMotion={reducedMotion} onOpen={() => onOpenPack(status.deck)} /> : null}
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
    {creating && !reducedMotion ? <LoadingArtwork compact colors={{ ...colors, primary: tone }} /> : <MaterialCommunityIcons name={creating ? 'clock-outline' : ready ? 'check-circle-outline' : 'alert-circle-outline'} color={tone} size={22} accessible={false} />}
    <View style={styles.copy} accessibilityLiveRegion="polite">
      <Text style={[styles.generationTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.generationDetail, { color: colors.textSecondary }]}>{status.deck.title} · {status.ready} / {status.total} tools ready{status.failed ? ' · ' + status.failed + ' need retry' : ''}{status.missing ? ' · Some status information is unavailable' : ''}</Text>
      <Text style={[styles.generationAction, { color: tone }]}>{action} →</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16, borderRadius: 22, borderWidth: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cloud: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700', letterSpacing: -0.3 },
  description: { fontSize: 14, lineHeight: 21, marginTop: 3 },
  outputs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 5, marginTop: 10 },
  output: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  outputText: { fontSize: 13, lineHeight: 19 },
  selectionArea: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 11, paddingTop: 10 },
  selectionWide: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  selectionTitle: { fontSize: 14, lineHeight: 21, fontWeight: '500', marginBottom: 5 },
  fileFormats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  fileFormat: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 7, maxWidth: '100%' },
  fileFormatText: { fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  limitText: { fontSize: 12, lineHeight: 18 },
  limit: { marginTop: 6 },
  targetCourse: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderRadius: 10, marginTop: 9 },
  clearCourse: { minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  action: { minHeight: 52, paddingHorizontal: 15, paddingVertical: 12, marginTop: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionWide: { marginTop: 0, flexBasis: 180, flexShrink: 0 },
  actionText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, fontWeight: '700' },
  flowHint: { marginTop: 8 },
  error: { marginTop: 12, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  errorText: { flex: 1, fontSize: 14, lineHeight: 21 },
  generation: { minHeight: 66, marginTop: 13, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  generationTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  generationDetail: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  generationAction: { fontSize: 13, lineHeight: 20, fontWeight: '600', marginTop: 3 },
});
