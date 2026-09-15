import * as DocumentPicker from 'expo-document-picker';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Header, Icon, type IconName, Pill, PrimaryButton, Screen } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, LibrarySort, StudyClass, StudyPack } from '../models';
import { calculateCourseMastery, calculateMastery } from '../services/mastery';
import { DOCUMENT_PICKER_TYPE, pageLabel } from '../services/documentTypes';
import { radius } from '../theme';

const CLASS_COLORS = ['#39BFA3', '#F26D8B', '#418DFF', '#F3A633', '#7D5CFF', '#11A7A2'];
const CLASS_EMOJIS = ['📚', '🧠', '🧪', '🎨', '💻', '🌿'];

type CourseGroup = { course: StudyClass; decks: StudyPack[] };

const SORT_OPTIONS: Array<{ value: LibrarySort; label: string; description: string; icon: IconName }> = [
  { value: 'default', label: 'Default order', description: 'Classes as saved, packs in chapter order', icon: 'format-list-numbered' },
  { value: 'recent', label: 'Recently added', description: 'Newest classes and study packs first', icon: 'clock-outline' },
  { value: 'oldest', label: 'Oldest added', description: 'Earliest classes and study packs first', icon: 'clock-time-four-outline' },
  { value: 'alphabetical', label: 'A–Z', description: 'Alphabetize classes and study packs', icon: 'sort-alphabetical-ascending' },
];

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortDecks(decks: StudyPack[], sort: LibrarySort): StudyPack[] {
  return [...decks].sort((a, b) => {
    if (sort === 'recent') return timestamp(b.createdAt) - timestamp(a.createdAt) || a.order - b.order;
    if (sort === 'oldest') return timestamp(a.createdAt) - timestamp(b.createdAt) || a.order - b.order;
    if (sort === 'alphabetical') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    return a.order - b.order;
  });
}

export function LibraryScreen({
  onOpenDeck,
  onCreateReview,
  onOpenFlagged,
  onImport,
}: {
  onOpenDeck: (deck: StudyPack) => void;
  onCreateReview: (deckIds: string[]) => void;
  onOpenFlagged: () => void;
  onImport: (asset: ImportAsset, course: StudyClass) => void;
}) {
  const { colors, state, addClass, setLibrarySort } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [choosingSort, setChoosingSort] = useState(false);
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
    const sortedGroups = [...groups];
    if (state.librarySort === 'recent') {
      sortedGroups.sort((a, b) => timestamp(b.course.createdAt) - timestamp(a.course.createdAt));
    } else if (state.librarySort === 'oldest') {
      sortedGroups.sort((a, b) => timestamp(a.course.createdAt) - timestamp(b.course.createdAt));
    } else if (state.librarySort === 'alphabetical') {
      sortedGroups.sort((a, b) => a.course.name.localeCompare(b.course.name, undefined, { sensitivity: 'base' }));
    }
    return sortedGroups.map((group) => ({ ...group, decks: sortDecks(group.decks, state.librarySort) }));
  }, [state.classes, state.decks, state.librarySort]);

  const activeSort = SORT_OPTIONS.find((option) => option.value === state.librarySort) ?? SORT_OPTIONS[0]!;

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
        type: DOCUMENT_PICKER_TYPE,
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
                <Icon name="plus" size={19} color={colors.primaryText} />
              </Pressable>
              <Pressable onPress={() => { setSelecting((value) => !value); setSelected([]); }} style={[styles.selectButton, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.selectText, { color: colors.primary }]}>{selecting ? 'Done' : 'Select'}</Text>
              </Pressable>
            </View>
          }
        />
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{courses.length} {courses.length === 1 ? 'class' : 'classes'} · {state.decks.length} study {state.decks.length === 1 ? 'pack' : 'packs'}</Text>

        {selecting ? (
          <Card style={[styles.reviewBanner, styles.flatCard, { backgroundColor: colors.purpleSoft }]}>
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

        <View style={styles.libraryToolbar}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Classes</Text>
          <View style={styles.toolbarActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open flagged review"
              onPress={onOpenFlagged}
              style={({ pressed }) => [styles.savedButton, { backgroundColor: colors.cardStrong }, pressed && styles.sortButtonPressed]}
            >
              <Icon name="flag-outline" size={17} color={colors.warning} />
              <Text style={[styles.savedButtonText, { color: colors.textSecondary }]}>{state.flaggedItems.length}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort library, currently ${activeSort.label}`}
              onPress={() => setChoosingSort(true)}
              style={({ pressed }) => [styles.sortButton, { backgroundColor: colors.cardStrong }, pressed && styles.sortButtonPressed]}
            >
              <Icon name="sort-variant" size={17} color={colors.primary} />
              <Text style={[styles.sortButtonText, { color: colors.textSecondary }]}>{activeSort.label}</Text>
              <Icon name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
        <View style={styles.courseList}>
          {courses.map(({ course, decks }) => {
            const courseMastery = decks.length ? calculateCourseMastery(decks) : 0;
            return (
              <View key={course.id} style={[styles.classGroup, { backgroundColor: colors.cardStrong, borderColor: `${course.color}45` }]}>
                <View style={[styles.classAccent, { backgroundColor: course.color }]} />
                <View style={styles.courseHeader}>
                  <View style={[styles.courseIcon, { backgroundColor: `${course.color}24` }]}>
                    <Text style={styles.courseEmoji}>{course.emoji}</Text>
                  </View>
                  <View style={styles.courseHeaderCopy}>
                    <View style={styles.classLabelRow}>
                      <Icon name="folder-outline" size={12} color={course.color} />
                      <Text style={[styles.classLabel, { color: colors.textMuted }]}>CLASS</Text>
                    </View>
                    <Text style={[styles.courseName, { color: colors.text }]}>{course.name}</Text>
                    <Text style={[styles.courseMeta, { color: colors.textMuted }]}>
                      {decks.length ? `${courseMastery}% estimated mastery` : 'Ready for your first study pack'}
                    </Text>
                  </View>
                  <View style={[styles.classCount, { backgroundColor: colors.card, borderColor: `${course.color}38` }]}>
                    <Text style={[styles.classCountText, { color: colors.textSecondary }]}>{decks.length} {decks.length === 1 ? 'PACK' : 'PACKS'}</Text>
                  </View>
                </View>

                <View style={styles.classBody}>
                  {decks.length === 0 ? (
                    <Card style={[styles.emptyClassCard, styles.flatCard, { borderColor: `${course.color}55` }]}>
                      <View style={[styles.emptyClassIcon, { backgroundColor: `${course.color}18` }]}>
                        <Icon name="file-plus-outline" size={22} color={course.color} />
                      </View>
                      <View style={styles.emptyClassCopy}>
                        <Text style={[styles.emptyClassTitle, { color: colors.text }]}>Add your first study pack</Text>
                        <Text style={[styles.emptyClassSubtitle, { color: colors.textSecondary }]}>Upload slides, a PDF, or notes for {course.name}.</Text>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Add slides to ${course.name}`} onPress={() => void pickDocument(course)} style={[styles.addSlidesButton, { backgroundColor: course.color }]}>
                        <Icon name="plus" size={18} color="#FFFFFF" />
                      </Pressable>
                    </Card>
                  ) : (
                    <View style={styles.deckList}>
                      {decks.map((deck, index) => {
                        const isSelected = selected.includes(deck.id);
                        const fileVisual = deck.fileType === 'pdf'
                          ? { icon: 'file-pdf-box' as IconName, label: 'PDF', color: '#E5535D', background: colors.mode === 'dark' ? '#3A2228' : '#FFF0F2' }
                          : deck.fileType === 'pptx'
                            ? { icon: 'microsoft-powerpoint' as IconName, label: 'POWERPOINT', color: '#D95738', background: colors.mode === 'dark' ? '#38241F' : '#FFF0EC' }
                            : deck.fileType === 'notes'
                              ? { icon: 'note-text-outline' as IconName, label: 'NOTES', color: '#7D5CFF', background: colors.mode === 'dark' ? '#2C2548' : '#F0ECFF' }
                            : { icon: 'file-presentation-box' as IconName, label: 'SAMPLE PACK', color: colors.goldText, background: colors.goldSoft };
                        return (
                          <Card key={deck.id} onPress={() => selecting ? toggle(deck.id) : onOpenDeck(deck)} style={[styles.deckCard, styles.flatCard, { backgroundColor: colors.card }, isSelected && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                            {selecting ? (
                              <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                                {isSelected ? <Icon name="check" size={15} color={colors.primaryText} /> : null}
                              </View>
                            ) : (
                              <View style={[styles.deckFileIcon, { backgroundColor: fileVisual.background }]}>
                                <Icon name={fileVisual.icon} size={23} color={fileVisual.color} />
                              </View>
                            )}
                            <View style={styles.deckCopy}>
                              <Text style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
                              <View style={styles.deckMetaRow}>
                                <Text style={[styles.deckKind, { color: fileVisual.color }]}>{fileVisual.label} {index + 1}</Text>
                                <View style={[styles.deckMetaDot, { backgroundColor: colors.border }]} />
                                <Text style={[styles.deckMeta, { color: colors.textMuted }]}>{deck.pageCount} {pageLabel(deck.fileType)} · {calculateMastery(deck).overall}% mastered</Text>
                              </View>
                            </View>
                            <Icon name={selecting ? 'checkbox-multiple-marked-outline' : 'chevron-right'} color={isSelected ? colors.primary : colors.textMuted} />
                          </Card>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </Screen>

      <Modal visible={choosingSort} transparent animationType="slide" onRequestClose={() => setChoosingSort(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]}>
          <Pressable accessibilityLabel="Close sort options" onPress={() => setChoosingSort(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.sortSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeadingRow}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.primarySoft }]}><Icon name="sort-variant" size={24} color={colors.primary} /></View>
              <View style={styles.sheetHeadingCopy}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Sort your library</Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Choose how classes and study packs are arranged.</Text>
              </View>
              <Pressable accessibilityLabel="Close" onPress={() => setChoosingSort(false)} hitSlop={10}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
            </View>

            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((option) => {
                const active = option.value === state.librarySort;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      setLibrarySort(option.value);
                      setChoosingSort(false);
                    }}
                    style={({ pressed }) => [
                      styles.sortOption,
                      { backgroundColor: active ? colors.primarySoft : colors.backgroundRaised, borderColor: active ? colors.primary : colors.border },
                      pressed && styles.sortOptionPressed,
                    ]}
                  >
                    <View style={[styles.sortOptionIcon, { backgroundColor: active ? colors.card : colors.cardStrong }]}>
                      <Icon name={option.icon} size={21} color={active ? colors.primary : colors.textSecondary} />
                    </View>
                    <View style={styles.sortOptionCopy}>
                      <Text style={[styles.sortOptionTitle, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[styles.sortOptionDescription, { color: colors.textSecondary }]}>{option.description}</Text>
                    </View>
                    <View style={[styles.radio, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : 'transparent' }]}>
                      {active ? <Icon name="check" size={13} color={colors.primaryText} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={creatingClass} transparent animationType="slide" onRequestClose={closeClassModal}>
        <KeyboardAvoidingView style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  newClassButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  selectButton: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12 },
  selectText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.9, marginTop: 13 },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  reviewBanner: { marginTop: 18 },
  reviewBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewSubtitle: { fontSize: 11, marginTop: 3 },
  reviewButton: { minHeight: 48, marginTop: 14 },
  libraryToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 22, marginBottom: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.3 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  savedButton: { minHeight: 38, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11 },
  savedButtonText: { fontSize: 11, fontWeight: '800' },
  sortButton: { minHeight: 38, maxWidth: 170, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: radius.pill },
  sortButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  sortButtonText: { flexShrink: 1, fontSize: 11, fontWeight: '800' },
  courseList: { gap: 14 },
  classGroup: { position: 'relative', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  classAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 12, paddingLeft: 17 },
  courseHeaderCopy: { flex: 1 },
  classLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  classLabel: { fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 1.1 },
  classCount: { minHeight: 27, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  classCountText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.45 },
  courseName: { fontSize: 17, fontWeight: '800' },
  courseMeta: { fontSize: 11, marginTop: 3 },
  courseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  courseEmoji: { fontSize: 22 },
  classBody: { paddingHorizontal: 10, paddingBottom: 10 },
  emptyClassCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  emptyClassIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyClassCopy: { flex: 1 },
  emptyClassTitle: { fontSize: 13, fontWeight: '800' },
  emptyClassSubtitle: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  addSlidesButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  deckList: { gap: 9 },
  deckCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  deckFileIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  deckCopy: { flex: 1 },
  deckTitle: { fontSize: 13, fontWeight: '800' },
  deckMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  deckKind: { fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 0.55 },
  deckMetaDot: { width: 3, height: 3, borderRadius: 2 },
  deckMeta: { fontSize: 10 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sortSheet: { width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 16 },
  sortOptions: { gap: 9, marginTop: 20 },
  sortOption: { minHeight: 68, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sortOptionPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  sortOptionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sortOptionCopy: { flex: 1 },
  sortOptionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  sortOptionDescription: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
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
