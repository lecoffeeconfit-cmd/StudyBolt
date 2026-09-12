import * as DocumentPicker from 'expo-document-picker';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, StudyClass, StudyPack } from '../models';
import { calculateCourseMastery, calculateMastery } from '../services/mastery';
import { radius } from '../theme';

const CLASS_COLORS = ['#39BFA3', '#F26D8B', '#418DFF', '#F3A633', '#7D5CFF', '#11A7A2'];
const CLASS_EMOJIS = ['📚', '🧠', '🧪', '🎨', '💻', '🌿'];

type CourseGroup = { course: StudyClass; decks: StudyPack[] };

export function LibraryScreen({
  onOpenDeck,
  onCreateReview,
  onImport,
}: {
  onOpenDeck: (deck: StudyPack) => void;
  onCreateReview: (deckIds: string[]) => void;
  onImport: (asset: ImportAsset, course: StudyClass) => void;
}) {
  const { colors, state, addClass } = useStudyBolt();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [creatingClass, setCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CLASS_COLORS[0] ?? '#39BFA3');
  const [selectedEmoji, setSelectedEmoji] = useState(CLASS_EMOJIS[0] ?? '📚');
  const [classError, setClassError] = useState<string | null>(null);

  const courses = useMemo<CourseGroup[]>(() => {
    const deckMap = new Map<string, StudyPack[]>();
    state.decks.forEach((deck) => deckMap.set(deck.courseId, [...(deckMap.get(deck.courseId) ?? []), deck]));

    const groups = state.classes.map((course) => ({ course, decks: deckMap.get(course.id) ?? [] }));
    const knownIds = new Set(groups.map(({ course }) => course.id));
    state.decks.forEach((deck) => {
      if (knownIds.has(deck.courseId)) return;
      knownIds.add(deck.courseId);
      groups.push({
        course: { id: deck.courseId, name: deck.courseName, emoji: deck.emoji, color: deck.color, createdAt: deck.createdAt },
        decks: deckMap.get(deck.courseId) ?? [],
      });
    });
    return groups;
  }, [state.classes, state.decks]);

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const closeClassModal = () => {
    setCreatingClass(false);
    setNewClassName('');
    setClassError(null);
  };

  const createClass = () => {
    const name = newClassName.trim();
    if (!name) {
      setClassError('Add a name so you can find this class later.');
      return;
    }
    if (state.classes.some((course) => course.name.trim().toLowerCase() === name.toLowerCase())) {
      setClassError('You already have a class with that name.');
      return;
    }
    addClass({
      id: `class-${Date.now()}`,
      name,
      emoji: selectedEmoji,
      color: selectedColor,
      createdAt: new Date().toISOString(),
    });
    closeClassModal();
  };

  const pickDocument = async (course: StudyClass) => {
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
      onImport({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file }, course);
    } catch {
      Alert.alert('Couldn’t open files', 'Check file permissions, then try again.');
    }
  };

  return (
    <>
      <Screen>
        <Header
          title="Library"
          right={
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create a new class"
                onPress={() => {
                  setClassError(null);
                  setCreatingClass(true);
                }}
                style={({ pressed }) => [styles.newClassButton, { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 }]}
              >
                <Icon name="plus" size={16} color={colors.primaryText} />
                <Text style={[styles.newClassText, { color: colors.primaryText }]}>New class</Text>
              </Pressable>
              <Pressable onPress={() => { setSelecting((value) => !value); setSelected([]); }} style={[styles.selectButton, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.selectText, { color: colors.primary }]}>{selecting ? 'Done' : 'Select'}</Text>
              </Pressable>
            </View>
          }
        />
        <Text style={[styles.title, { color: colors.text }]}>Your library</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Keep every class in one place, then add study packs whenever you’re ready.</Text>

        {selecting ? (
          <Card style={[styles.reviewBanner, { backgroundColor: colors.purpleSoft }]}>
            <View style={styles.reviewBannerRow}>
              <Icon name="playlist-check" color={colors.purple} size={25} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.reviewTitle, { color: colors.text }]}>Build an exam review</Text>
                <Text style={[styles.reviewSubtitle, { color: colors.textSecondary }]}>Select two or more decks in chapter order.</Text>
              </View>
              <Pill label={`${selected.length} selected`} tone="purple" />
            </View>
            <PrimaryButton label="Create Exam Review" icon="creation" disabled={selected.length < 2} onPress={() => onCreateReview(selected)} style={styles.reviewButton} />
          </Card>
        ) : null}

        <SectionHeader title="Classes" action={`${courses.length} ${courses.length === 1 ? 'class' : 'classes'}`} />
        <View style={styles.courseList}>
          {courses.map(({ course, decks }) => {
            const courseMastery = decks.length ? calculateCourseMastery(decks) : 0;
            return (
              <View key={course.id}>
                <View style={styles.courseHeader}>
                  <View style={styles.courseHeaderCopy}>
                    <Text style={[styles.courseName, { color: colors.text }]}>{course.name}</Text>
                    <Text style={[styles.courseMeta, { color: colors.textMuted }]}>
                      {decks.length ? `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'} · ${courseMastery}% estimated mastery` : 'No study packs yet · Ready when you are'}
                    </Text>
                  </View>
                  <View style={[styles.courseIcon, { backgroundColor: `${course.color}24` }]}>
                    <Text style={styles.courseEmoji}>{course.emoji}</Text>
                  </View>
                </View>

                {decks.length === 0 ? (
                  <Card style={[styles.emptyClassCard, { borderColor: `${course.color}55` }]}>
                    <View style={[styles.emptyClassIcon, { backgroundColor: `${course.color}18` }]}>
                      <Icon name="file-plus-outline" size={22} color={course.color} />
                    </View>
                    <View style={styles.emptyClassCopy}>
                      <Text style={[styles.emptyClassTitle, { color: colors.text }]}>Add your first study pack</Text>
                      <Text style={[styles.emptyClassSubtitle, { color: colors.textSecondary }]}>Upload slides or a PDF for {course.name}.</Text>
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={`Add slides to ${course.name}`} onPress={() => void pickDocument(course)} style={[styles.addSlidesButton, { backgroundColor: course.color }]}>
                      <Icon name="plus" size={18} color="#FFFFFF" />
                    </Pressable>
                  </Card>
                ) : (
                  <View style={styles.deckList}>
                    {[...decks].sort((a, b) => a.order - b.order).map((deck, index) => {
                      const isSelected = selected.includes(deck.id);
                      return (
                        <Card key={deck.id} onPress={() => selecting ? toggle(deck.id) : onOpenDeck(deck)} style={[styles.deckCard, isSelected && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                          {selecting ? (
                            <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                              {isSelected ? <Icon name="check" size={15} color={colors.primaryText} /> : null}
                            </View>
                          ) : (
                            <View style={[styles.orderBadge, { backgroundColor: colors.cardStrong }]}>
                              <Text style={[styles.orderText, { color: colors.textSecondary }]}>{index + 1}</Text>
                            </View>
                          )}
                          <View style={styles.deckCopy}>
                            <Text style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
                            <Text style={[styles.deckMeta, { color: colors.textMuted }]}>{deck.pageCount} slides · {calculateMastery(deck).overall}% mastered</Text>
                          </View>
                          <Icon name={selecting ? 'checkbox-multiple-marked-outline' : 'chevron-right'} color={isSelected ? colors.primary : colors.textMuted} />
                        </Card>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Screen>

      <Modal visible={creatingClass} transparent animationType="slide" onRequestClose={closeClassModal}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable accessibilityLabel="Close new class dialog" onPress={closeClassModal} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeadingRow}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.primarySoft }]}><Icon name="school-outline" size={24} color={colors.primary} /></View>
              <View style={styles.sheetHeadingCopy}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Create a class</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Give your next set of notes a home.</Text>
              </View>
              <Pressable accessibilityLabel="Close" onPress={closeClassModal} hitSlop={10}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Class name</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.backgroundRaised, borderColor: classError ? colors.danger : colors.border }]}>
              <Icon name="pencil-outline" size={19} color={colors.textMuted} />
              <TextInput
                accessibilityLabel="Class name"
                autoFocus
                value={newClassName}
                onChangeText={(value) => { setNewClassName(value); setClassError(null); }}
                onSubmitEditing={createClass}
                placeholder="e.g. Anatomy & Physiology"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={[styles.input, { color: colors.text }]}
              />
            </View>
            {classError ? <Text style={[styles.errorText, { color: colors.danger }]}>{classError}</Text> : null}

            <Text style={[styles.inputLabel, styles.optionLabel, { color: colors.textSecondary }]}>Choose an icon</Text>
            <View style={styles.optionRow}>
              {CLASS_EMOJIS.map((emoji) => {
                const active = selectedEmoji === emoji;
                return <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Use ${emoji} icon`} onPress={() => setSelectedEmoji(emoji)} style={[styles.emojiOption, { backgroundColor: active ? colors.primarySoft : colors.backgroundRaised, borderColor: active ? colors.primary : colors.border }]}><Text style={styles.emojiOptionText}>{emoji}</Text></Pressable>;
              })}
            </View>

            <Text style={[styles.inputLabel, styles.optionLabel, { color: colors.textSecondary }]}>Choose a color</Text>
            <View style={styles.optionRow}>
              {CLASS_COLORS.map((color) => {
                const active = selectedColor === color;
                return <Pressable key={color} accessibilityRole="button" accessibilityLabel="Choose class color" onPress={() => setSelectedColor(color)} style={[styles.colorOption, { backgroundColor: color, borderColor: colors.card }, active && { borderColor: colors.text, borderWidth: 3 }]} />;
              })}
            </View>

            <View style={[styles.previewCard, { backgroundColor: `${selectedColor}16`, borderColor: `${selectedColor}44` }]}>
              <View style={[styles.previewIcon, { backgroundColor: `${selectedColor}28` }]}><Text style={styles.previewEmoji}>{selectedEmoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.previewTitle, { color: colors.text }]}>{newClassName.trim() || 'Your new class'}</Text>
                <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>0 study packs · Ready to learn</Text>
              </View>
            </View>

            <PrimaryButton label="Create class" icon="plus" onPress={createClass} style={styles.createButton} />
            <Pressable accessibilityRole="button" onPress={closeClassModal} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Maybe later</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  newClassButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  newClassText: { fontSize: 11, fontWeight: '900' },
  selectButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12 },
  selectText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 4 },
  reviewBanner: { marginTop: 20 },
  reviewBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewSubtitle: { fontSize: 11, marginTop: 3 },
  reviewButton: { minHeight: 48, marginTop: 14 },
  courseList: { gap: 28 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  courseHeaderCopy: { flex: 1, paddingRight: 12 },
  courseName: { fontSize: 17, fontWeight: '800' },
  courseMeta: { fontSize: 11, marginTop: 3 },
  courseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  courseEmoji: { fontSize: 20 },
  emptyClassCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  emptyClassIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyClassCopy: { flex: 1 },
  emptyClassTitle: { fontSize: 13, fontWeight: '800' },
  emptyClassSubtitle: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  addSlidesButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  deckList: { gap: 9 },
  deckCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  orderBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 12, fontWeight: '900' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  deckCopy: { flex: 1 },
  deckTitle: { fontSize: 13, fontWeight: '800' },
  deckMeta: { fontSize: 10, marginTop: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sheetIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetHeadingCopy: { flex: 1 },
  sheetTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.5 },
  sheetSubtitle: { fontSize: 12, marginTop: 3 },
  inputLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800', marginTop: 20, marginBottom: 7, marginLeft: 2 },
  inputWrap: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, minWidth: 0, height: 52, fontSize: 14 },
  errorText: { fontSize: 11, marginTop: 6, marginLeft: 2 },
  optionLabel: { marginTop: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  emojiOption: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emojiOptionText: { fontSize: 21 },
  colorOption: { width: 31, height: 31, borderRadius: 16, borderWidth: 1 },
  previewCard: { minHeight: 65, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, marginTop: 19 },
  previewIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 21 },
  previewTitle: { fontSize: 13, fontWeight: '900' },
  previewMeta: { fontSize: 10, marginTop: 3 },
  createButton: { minHeight: 52, marginTop: 15 },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 12, fontWeight: '800' },
});
