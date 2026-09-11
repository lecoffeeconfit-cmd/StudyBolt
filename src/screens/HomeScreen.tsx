import * as DocumentPicker from 'expo-document-picker';
import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import { ImportAsset, StudyPack } from '../models';
import { calculateMastery } from '../services/mastery';
import { Card, Header, Icon, Pill, ProgressBar, Screen, SectionHeader } from '../components/ui';

export function HomeScreen({
  onOpenDeck,
  onImport,
}: {
  onOpenDeck: (deck: StudyPack) => void;
  onImport: (asset: ImportAsset) => void;
}) {
  const { colors, state, setTheme } = useStudyBolt();

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      onImport({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file });
    } catch {
      Alert.alert('Couldn’t open files', 'Check file permissions, then try again.');
    }
  };

  return (
    <Screen>
      <Header
        title="Study Bolt"
        right={
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={`Switch to ${colors.mode === 'dark' ? 'light' : 'dark'} mode`}
              onPress={() => setTheme(colors.mode === 'dark' ? 'light' : 'dark')}
              style={[styles.roundButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Icon name={colors.mode === 'dark' ? 'weather-sunny' : 'weather-night'} size={19} color={colors.mode === 'dark' ? colors.warning : colors.primary} />
            </Pressable>
            <View style={[styles.avatar, { backgroundColor: colors.mintSoft }]}>
              <Text style={styles.avatarText}>H</Text>
            </View>
          </View>
        }
      />

      <View style={styles.heroCopy}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ONE UPLOAD. YOUR WHOLE STUDY PACK.</Text>
        <Text style={[styles.title, { color: colors.text }]}>Upload your class slides.</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>StudyBolt turns them into notes, flashcards, quizzes, audio, and a study plan.</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Upload your class slides"
        onPress={pickDocument}
        style={({ pressed }) => [
          styles.uploadCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
            opacity: pressed ? 0.86 : 1,
          },
        ]}
      >
        <View style={[styles.cloudCircle, { backgroundColor: colors.primarySoft }]}>
          <Icon name="cloud-upload" size={47} color={colors.primary} />
        </View>
        <Text style={[styles.uploadTitle, { color: colors.text }]}>Tap to upload</Text>
        <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>or drag and drop on web</Text>
        <View style={styles.fileTypes}>
          <View style={[styles.fileIcon, { backgroundColor: '#FFF0ED' }]}><Icon name="microsoft-powerpoint" size={21} color="#E8553D" /></View>
          <View style={[styles.fileIcon, { backgroundColor: '#FFF0F0' }]}><Icon name="file-pdf-box" size={21} color="#EF4455" /></View>
          <View style={[styles.fileIcon, { backgroundColor: '#FFF7DE' }]}><Icon name="presentation" size={21} color="#E8A10B" /></View>
        </View>
        <Text style={[styles.formats, { color: colors.textMuted }]}>PPT, PPTX, or PDF · Up to 50 MB</Text>
      </Pressable>

      <View style={[styles.promise, { backgroundColor: colors.mintSoft }]}>
        <View style={[styles.promiseIcon, { backgroundColor: colors.card }]}>
          <Icon name="creation" size={19} color={colors.mint} />
        </View>
        <Text style={[styles.promiseText, { color: colors.textSecondary }]}>Everything is created together, then saved for offline study.</Text>
      </View>

      <SectionHeader title="Recent uploads" action="See all" />
      <View style={styles.deckList}>
        {state.decks.slice(0, 3).map((deck) => (
          <RecentDeck key={deck.id} deck={deck} onPress={() => onOpenDeck(deck)} />
        ))}
      </View>

      <Card style={[styles.tipCard, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.tipRow}>
          <View style={[styles.tipIcon, { backgroundColor: colors.primary }]}><Icon name="brain" size={20} color="#FFFFFF" /></View>
          <View style={styles.tipCopy}>
            <Text style={[styles.tipTitle, { color: colors.text }]}>Your next best step</Text>
            <Text style={[styles.tipText, { color: colors.textSecondary }]}>Review the 3 Biology cards still in learning. Retrieval before rereading strengthens recall.</Text>
          </View>
          <Icon name="chevron-right" color={colors.primary} />
        </View>
      </Card>
      {Platform.OS === 'web' ? <Text style={[styles.webHint, { color: colors.textMuted }]}>Tip: this layout adapts to mobile and web from the same Expo codebase.</Text> : null}
    </Screen>
  );
}

function RecentDeck({ deck, onPress }: { deck: StudyPack; onPress: () => void }) {
  const { colors } = useStudyBolt();
  const mastery = calculateMastery(deck).overall;
  return (
    <Card onPress={onPress} style={styles.deckCard}>
      <View style={[styles.deckThumb, { backgroundColor: `${deck.color}24` }]}>
        <Text style={styles.deckEmoji}>{deck.emoji}</Text>
      </View>
      <View style={styles.deckCopy}>
        <View style={styles.deckTitleRow}>
          <Text numberOfLines={1} style={[styles.deckTitle, { color: colors.text }]}>{deck.courseName}</Text>
          <Pill label={`${mastery}%`} tone={mastery >= 75 ? 'mint' : 'blue'} />
        </View>
        <Text numberOfLines={1} style={[styles.deckSubtitle, { color: colors.textSecondary }]}>{deck.title}</Text>
        <View style={styles.deckMetaRow}>
          <Text style={[styles.deckMeta, { color: colors.textMuted }]}>{deck.pageCount} slides</Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.deckMeta, { color: colors.textMuted }]}>Available offline</Text>
        </View>
        <View style={styles.miniProgress}><ProgressBar progress={mastery} color={deck.color} /></View>
      </View>
      <Icon name="chevron-right" size={24} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  roundButton: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#12775E' },
  heroCopy: { marginTop: 18, marginBottom: 20 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 8 },
  title: { fontSize: 31, lineHeight: 36, fontWeight: '900', letterSpacing: -1.1 },
  subtitle: { marginTop: 8, fontSize: 15, lineHeight: 21, maxWidth: 500 },
  uploadCard: { minHeight: 232, borderWidth: 1.4, borderStyle: 'dashed', borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 20 },
  cloudCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadTitle: { fontSize: 17, fontWeight: '900' },
  uploadHint: { fontSize: 13, marginTop: 3 },
  fileTypes: { flexDirection: 'row', gap: 10, marginTop: 17 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  formats: { fontSize: 11, fontWeight: '600', marginTop: 9 },
  promise: { marginTop: 14, minHeight: 58, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11 },
  promiseIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  promiseText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  deckList: { gap: 10 },
  deckCard: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  deckThumb: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deckEmoji: { fontSize: 25 },
  deckCopy: { flex: 1, minWidth: 0 },
  deckTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  deckTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  deckSubtitle: { fontSize: 12, marginTop: 2 },
  deckMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  deckMeta: { fontSize: 10 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  miniProgress: { marginTop: 7 },
  tipCard: { marginTop: 22 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tipCopy: { flex: 1 },
  tipTitle: { fontSize: 13, fontWeight: '800' },
  tipText: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  webHint: { textAlign: 'center', fontSize: 11, marginTop: 20 },
});
