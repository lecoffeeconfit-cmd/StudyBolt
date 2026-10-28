import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Header, Icon, type IconName, Pill, PrimaryButton, Screen } from '../components/ui';
import { SubjectIcon } from '../components/SubjectIcon';
import { getSubjectIcon, SUBJECT_ICONS } from '../data/subjectIcons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useStudyBolt } from '../StudyBoltContext';
import type { ImportAsset, LibrarySort, StudyClass, StudyEvent, StudyPack } from '../models';
import { calculateCourseMastery, calculateMastery } from '../services/mastery';
import { DOCUMENT_PICKER_TYPE, getImportDocumentType, pageLabel } from '../services/documentTypes';
import { getStudyEventMinutes } from '../services/studyActivity';
import { radius } from '../theme';

const CLASS_COLORS = ['#39BFA3', '#F26D8B', '#418DFF', '#F3A633', '#7D5CFF', '#11A7A2'];

type CourseGroup = { course: StudyClass; decks: StudyPack[] };

const SORT_OPTIONS: Array<{ value: LibrarySort; label: string; description: string; icon: IconName }> = [
  { value: 'default', label: 'Default', description: 'Classes as saved, packs in chapter order', icon: 'format-list-numbered' },
  { value: 'recent', label: 'Recently added', description: 'Newest classes and study packs first', icon: 'clock-outline' },
  { value: 'oldest', label: 'Oldest added', description: 'Earliest classes and study packs first', icon: 'clock-time-four-outline' },
  { value: 'alphabetical', label: 'Name (A–Z)', description: 'Alphabetize classes and study packs', icon: 'sort-alphabetical-ascending' },
];

const CLASS_TRANSITION_MS = 220;

function CollapseChevron({ collapsed, color, reducedMotion }: { collapsed: boolean; color: string; reducedMotion: boolean }) {
  const progress = useRef(new Animated.Value(collapsed ? 0 : 1)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(collapsed ? 0 : 1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: collapsed ? 0 : 1,
      duration: CLASS_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [collapsed, progress, reducedMotion]);

  return (
    <Animated.View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ transform: [{ rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
      <Icon name="chevron-down" size={20} color={color} />
    </Animated.View>
  );
}

function CollapsibleClassBody({ expanded, reducedMotion, children }: { expanded: boolean; reducedMotion: boolean; children: ReactNode }) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [mounted, setMounted] = useState(expanded);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    progress.stopAnimation();
    if (expanded) setMounted(true);
    if (reducedMotion) {
      progress.setValue(expanded ? 1 : 0);
      setMounted(expanded);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: CLASS_TRANSITION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !expanded) setMounted(false);
    });
    return () => animation.stop();
  }, [expanded, progress, reducedMotion]);

  if (!mounted) return null;
  return (
    <Animated.View
      pointerEvents={expanded ? 'auto' : 'none'}
      aria-hidden={!expanded}
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      style={{ overflow: 'hidden', height: contentHeight ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }) : undefined, opacity: progress }}
    >
      <View style={styles.measuredBody} onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}>{children}</View>
    </Animated.View>
  );
}

function ClassMasteryProgress({ value, courseName, reducedMotion }: { value: number; courseName: string; reducedMotion: boolean }) {
  const { colors } = useStudyBolt();
  const progress = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    progress.stopAnimation();
    if (reducedMotion) {
      progress.setValue(value);
      return;
    }
    const animation = Animated.timing(progress, { toValue: value, duration: CLASS_TRANSITION_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion, value]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Estimated mastery for ${courseName}`}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={[styles.masteryTrack, { backgroundColor: colors.mintSoft }]}
    >
      <Animated.View style={[styles.masteryFill, { backgroundColor: colors.mint, width: progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatClassAddedDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatLastStudied(at: number, now = new Date()): string {
  const date = new Date(at);
  const calendarDay = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
  const days = calendarDay(now) - calendarDay(date);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

function getLibraryStudyHistory(events: StudyEvent[], decks: StudyPack[], now = Date.now()) {
  const deckById = new Map(decks.map((deck) => [deck.id, deck]));
  const latestByCourse = new Map<string, number>();
  let latestDeck: StudyPack | null = null;
  let latestDeckAt = 0;

  for (const event of events) {
    const at = timestamp(event.occurredAt);
    if (!at || at > now || getStudyEventMinutes(event) <= 0) continue;
    const deck = event.deckId ? deckById.get(event.deckId) : undefined;
    const courseId = deck?.courseId ?? event.courseId;
    if (courseId && at > (latestByCourse.get(courseId) ?? 0)) latestByCourse.set(courseId, at);
    if (deck && at >= latestDeckAt) {
      latestDeck = deck;
      latestDeckAt = at;
    }
  }
  return { latestByCourse, latestDeck, latestDeckAt };
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
  onOpenSpeedReview,
  onImport,
}: {
  onOpenDeck: (deck: StudyPack) => void;
  onCreateReview: (deckIds: string[]) => void;
  onOpenFlagged: () => void;
  onOpenSpeedReview: (courseId: string) => void;
  onImport: (assets: ImportAsset[], course: StudyClass) => void;
}) {
  const { colors, state, addClass, setLibrarySort } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [choosingSort, setChoosingSort] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCourseIds, setCollapsedCourseIds] = useState<string[]>([]);
  const [creatingClass, setCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CLASS_COLORS[0] ?? '#39BFA3');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [inspectedCourseId, setInspectedCourseId] = useState<string | null>(null);
  const suggestedIcon = getSubjectIcon(newClassName);
  const classEmoji = selectedEmoji ?? suggestedIcon.emoji;

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

  const studyHistory = useMemo(() => getLibraryStudyHistory(state.activityEvents, state.decks), [state.activityEvents, state.decks]);
  const inspectedCourse = courses.find((group) => group.course.id === inspectedCourseId);

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const visibleCourses = useMemo(() => courses
    .map((group) => {
      if (!normalizedSearch) return { ...group, visibleDecks: group.decks };
      const classMatches = group.course.name.toLocaleLowerCase().includes(normalizedSearch);
      const matchingDecks = group.decks.filter((deck) => `${deck.title} ${deck.fileName} ${deck.courseName}`.toLocaleLowerCase().includes(normalizedSearch));
      return { ...group, visibleDecks: classMatches ? group.decks : matchingDecks };
    })
    .filter((group) => !normalizedSearch
      || group.course.name.toLocaleLowerCase().includes(normalizedSearch)
      || group.visibleDecks.length > 0), [courses, normalizedSearch]);

  const activeSort = SORT_OPTIONS.find((option) => option.value === state.librarySort) ?? SORT_OPTIONS[0]!;

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleCourse = (id: string) => setCollapsedCourseIds((current) => current.includes(id)
    ? current.filter((courseId) => courseId !== id)
    : [...current, id]);

  const closeClassModal = () => {
    setCreatingClass(false);
    setNewClassName('');
    setSelectedEmoji(null);
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
      emoji: classEmoji,
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
        multiple: true,
        // Keep the browser's File object instead of eagerly reading a second
        // base64 copy into memory before the multipart upload starts.
        base64: false,
      });
      if (result.canceled) return;
      const assets = result.assets.map((asset) => ({ name: asset.name, uri: asset.uri, mimeType: asset.mimeType, size: asset.size, file: asset.file }));
      if (!assets.length) return;
      if (assets.length > 1 && assets.some((asset) => getImportDocumentType(asset.name, asset.mimeType) !== 'powerpoint')) {
        Alert.alert('Choose PowerPoints together', 'To create one integrated Study Pack, select only PowerPoint files. Other file types can be imported one at a time.');
        return;
      }
      onImport(assets, course);
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
              <Pressable accessibilityRole="button" accessibilityLabel={selecting ? 'Finish selecting study packs' : 'Select study packs for an exam review'} accessibilityState={{ selected: selecting }} aria-pressed={selecting} onPress={() => { setSelecting((value) => !value); setSelected([]); }} style={({ pressed }) => [styles.selectButton, { backgroundColor: colors.primarySoft }, pressed && styles.deckRowPressed]}>
                <Text style={[styles.selectText, { color: colors.primary }]}>{selecting ? 'Done' : 'Select'}</Text>
              </Pressable>
            </View>
          }
        />
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{courses.length} {courses.length === 1 ? 'class' : 'classes'} · {state.decks.length} study {state.decks.length === 1 ? 'pack' : 'packs'}</Text>

        <View style={[styles.searchField, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
          <Icon name="magnify" size={20} color={colors.textSecondary} />
          <TextInput
            accessibilityLabel="Search classes and study packs"
            autoCapitalize="none"
            autoCorrect={false}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search classes and study packs…"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear library search" style={styles.clearSearch} onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {studyHistory.latestDeck && !selecting && !normalizedSearch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Continue studying ${studyHistory.latestDeck.title}, ${studyHistory.latestDeck.courseName}`}
            accessibilityHint="Opens the study pack from your most recent recorded study activity."
            onPress={() => { if (studyHistory.latestDeck) onOpenDeck(studyHistory.latestDeck); }}
            style={({ pressed }) => [styles.continueRow, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.deckRowPressed]}
          >
            <View style={[styles.continueIcon, { backgroundColor: colors.primarySoft }]}><Icon name="book-open-page-variant" size={21} color={colors.primary} /></View>
            <View style={styles.deckCopy}>
              <Text style={[styles.continueLabel, { color: colors.primary }]}>Continue studying</Text>
              <Text numberOfLines={2} style={[styles.continueTitle, { color: colors.text }]}>{studyHistory.latestDeck.title}</Text>
              <Text numberOfLines={2} style={[styles.continueMeta, { color: colors.textSecondary }]}>{studyHistory.latestDeck.courseName} · Last studied {formatLastStudied(studyHistory.latestDeckAt)}</Text>
            </View>
            <Icon name="arrow-right" size={19} color={colors.primary} />
          </Pressable>
        ) : null}

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
              accessibilityLabel={`Open saved items, ${state.flaggedItems.length} saved`}
              onPress={onOpenFlagged}
              style={({ pressed }) => [styles.savedButton, { backgroundColor: state.flaggedItems.length ? colors.goldSoft : colors.cardStrong, borderColor: colors.border }, pressed && styles.sortButtonPressed]}
            >
              <Icon name={state.flaggedItems.length ? 'flag' : 'flag-outline'} size={17} color={colors.goldText} />
              <Text style={[styles.savedButtonText, { color: colors.textSecondary }]}>Saved {state.flaggedItems.length}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort library, currently ${activeSort.label}`}
              accessibilityState={{ expanded: choosingSort }}
              aria-expanded={choosingSort}
              onPress={() => setChoosingSort(true)}
              style={({ pressed }) => [styles.sortButton, { backgroundColor: state.librarySort === 'default' ? colors.cardStrong : colors.primarySoft, borderColor: state.librarySort === 'default' ? colors.border : `${colors.primary}48` }, pressed && styles.sortButtonPressed]}
            >
              <Icon name="sort-variant" size={17} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.sortButtonText, { color: state.librarySort === 'default' ? colors.textSecondary : colors.primary }]}>Sort: {activeSort.label}</Text>
              <Icon name="chevron-down" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
        {visibleCourses.length ? (
          <View style={styles.courseList}>
            {visibleCourses.map(({ course, decks, visibleDecks }) => {
              const courseMastery = decks.length ? calculateCourseMastery(decks) : 0;
              const collapsed = normalizedSearch ? false : collapsedCourseIds.includes(course.id);
              const lastStudied = studyHistory.latestByCourse.get(course.id);
              const courseMeta = `${decks.length} study ${decks.length === 1 ? 'pack' : 'packs'}${lastStudied ? ` · Last studied ${formatLastStudied(lastStudied)}` : ''}`;
              return (
                <View key={course.id} style={[styles.classGroup, { backgroundColor: colors.cardStrong, borderColor: `${course.color}38` }]}>
                  <View style={[styles.classAccent, { backgroundColor: course.color }]} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${collapsed ? 'Expand' : 'Collapse'} ${course.name}, ${courseMeta}`}
                    accessibilityHint={normalizedSearch ? 'Matching study packs stay expanded while searching.' : undefined}
                    accessibilityState={{ expanded: !collapsed }}
                    aria-expanded={!collapsed}
                    disabled={Boolean(normalizedSearch)}
                    onPress={() => toggleCourse(course.id)}
                    style={({ pressed }) => [styles.courseHeader, pressed && !normalizedSearch && styles.courseHeaderPressed]}
                  >
                    <View style={styles.courseHeaderMain}>
                      <SubjectIcon subject={course.name} emoji={course.emoji} size={48} animated={false} />
                      <View style={styles.courseHeaderCopy}>
                        <Text numberOfLines={2} style={[styles.courseName, { color: colors.text }]}>{course.name}</Text>
                        <Text numberOfLines={2} style={[styles.courseMeta, { color: colors.textSecondary }]}>{courseMeta}</Text>
                      </View>
                      <CollapseChevron collapsed={collapsed} color={colors.textSecondary} reducedMotion={reducedMotion} />
                    </View>
                  </Pressable>

                  <View style={styles.masteryArea}>
                    <View style={styles.masteryLabelRow}>
                      <Text style={[styles.masteryLabel, { color: colors.textSecondary }]}>{decks.length ? `Estimated mastery — ${courseMastery}%` : 'Ready for your first study pack'}</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`About ${course.name}${decks.length ? ' and estimated mastery' : ''}`}
                        hitSlop={8}
                        onPress={() => setInspectedCourseId(course.id)}
                        style={({ pressed }) => [styles.classInfoButton, pressed && styles.deckRowPressed]}
                      ><Icon name="information-outline" size={17} color={colors.textSecondary} /></Pressable>
                    </View>
                    {decks.length ? <ClassMasteryProgress value={courseMastery} courseName={course.name} reducedMotion={reducedMotion} /> : null}
                  </View>

                  <CollapsibleClassBody expanded={!collapsed} reducedMotion={reducedMotion}>
                    <View style={[styles.classBody, { borderTopColor: colors.border }]}>
                      {decks.length > 0 && !selecting ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Start speed review for ${course.name}`}
                          onPress={() => onOpenSpeedReview(course.id)}
                          style={({ pressed }) => [styles.speedReviewRow, { backgroundColor: colors.purpleSoft }, pressed && styles.deckRowPressed]}
                        >
                          <View style={[styles.speedReviewIcon, { backgroundColor: colors.purple }]}><Icon name="speedometer" size={17} color={colors.primaryText} /></View>
                          <View style={styles.speedReviewCopy}>
                            <Text style={[styles.speedReviewTitle, { color: colors.text }]}>Speed Review</Text>
                            <Text style={[styles.speedReviewSubtitle, { color: colors.textSecondary }]}>Quick audio recap of this class</Text>
                          </View>
                          <Icon name="arrow-right" size={18} color={colors.purple} />
                        </Pressable>
                      ) : null}
                      {decks.length === 0 ? (
                        <View style={[styles.emptyClassCard, { backgroundColor: colors.card, borderColor: `${course.color}42` }]}>
                          <View style={[styles.emptyClassIcon, { backgroundColor: `${course.color}18` }]}>
                            <Icon name="file-plus-outline" size={21} color={course.color} />
                          </View>
                          <View style={styles.emptyClassCopy}>
                            <Text style={[styles.emptyClassTitle, { color: colors.text }]}>Create your first study pack</Text>
                            <Text style={[styles.emptyClassSubtitle, { color: colors.textSecondary }]}>Upload slides, a PDF, or notes. Select multiple PowerPoints to study them together.</Text>
                          </View>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Create a study pack in ${course.name}`} onPress={() => void pickDocument(course)} style={({ pressed }) => [styles.addSlidesButton, { backgroundColor: course.color }, pressed && styles.deckRowPressed]}>
                            <Icon name="plus" size={18} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={[styles.deckList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {visibleDecks.map((deck, index) => {
                            const isSelected = selected.includes(deck.id);
                            const fileVisual = deck.fileType === 'pdf'
                              ? { icon: 'file-pdf-box' as IconName, label: 'PDF' }
                              : deck.fileType === 'pptx'
                                ? { icon: 'microsoft-powerpoint' as IconName, label: 'PowerPoint' }
                                : deck.fileType === 'notes'
                                  ? { icon: 'note-text-outline' as IconName, label: 'Notes' }
                                  : { icon: 'file-presentation-box' as IconName, label: `Sample Pack ${decks.findIndex((item) => item.id === deck.id) + 1}` };
                            return (
                              <React.Fragment key={deck.id}>
                                <Pressable
                                  accessibilityRole={selecting ? 'checkbox' : 'button'}
                                  accessibilityLabel={selecting ? `${isSelected ? 'Deselect' : 'Select'} ${deck.title}` : `Open ${deck.title}`}
                                  accessibilityState={selecting ? { checked: isSelected } : undefined}
                                  aria-checked={selecting ? isSelected : undefined}
                                  onPress={() => selecting ? toggle(deck.id) : onOpenDeck(deck)}
                                  style={({ pressed }) => [styles.deckRow, isSelected && { backgroundColor: colors.primarySoft }, pressed && styles.deckRowPressed]}
                                >
                                  {selecting ? (
                                    <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                                      {isSelected ? <Icon name="check" size={15} color={colors.primaryText} /> : null}
                                    </View>
                                  ) : (
                                    <View style={[styles.deckFileIcon, { backgroundColor: `${course.color}16` }]}>
                                      <Icon name={fileVisual.icon} size={19} color={course.color} />
                                    </View>
                                  )}
                                  <View style={styles.deckCopy}>
                                    <Text numberOfLines={2} style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
                                    <Text numberOfLines={2} style={[styles.deckMeta, { color: colors.textSecondary }]}>
                                      <Text style={[styles.deckKind, { color: colors.textSecondary }]}>{fileVisual.label}</Text>
                                      {` · ${deck.pageCount} ${pageLabel(deck.fileType)} · ${calculateMastery(deck).overall}% mastered`}
                                    </Text>
                                  </View>
                                  <Icon name={selecting ? 'checkbox-multiple-marked-outline' : 'chevron-right'} size={19} color={isSelected ? colors.primary : colors.textMuted} />
                                </Pressable>
                                {index < visibleDecks.length - 1 ? <View style={[styles.deckDivider, { backgroundColor: colors.border }]} /> : null}
                              </React.Fragment>
                            );
                          })}
                        </View>
                      )}

                      {decks.length > 0 && !selecting && !normalizedSearch ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Create a study pack in ${course.name}`}
                          onPress={() => void pickDocument(course)}
                          style={({ pressed }) => [styles.addPackRow, pressed && styles.deckRowPressed]}
                        >
                          <View style={[styles.addPackIcon, { backgroundColor: `${course.color}16` }]}><Icon name="plus" size={16} color={course.color} /></View>
                          <Text style={[styles.addPackText, { color: colors.textSecondary }]}>Create study pack</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </CollapsibleClassBody>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={[styles.emptyLibrary, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
            <View style={[styles.emptyLibraryIcon, { backgroundColor: colors.primarySoft }]}><Icon name={normalizedSearch ? 'magnify-close' : 'bookshelf'} size={25} color={colors.primary} /></View>
            <Text style={[styles.emptyLibraryTitle, { color: colors.text }]}>{normalizedSearch ? 'No library matches' : 'Your library is ready'}</Text>
            <Text style={[styles.emptyLibraryText, { color: colors.textSecondary }]}>{normalizedSearch ? 'Try a class name, study-pack title, or source file name.' : 'Create a class, then add slides, PDFs, or notes.'}</Text>
            {normalizedSearch ? (
              <Pressable onPress={() => setSearchQuery('')} style={styles.emptyLibraryAction}><Text style={[styles.emptyLibraryActionText, { color: colors.primary }]}>Clear search</Text></Pressable>
            ) : (
              <PrimaryButton label="Create your first class" icon="plus" onPress={() => setCreatingClass(true)} style={styles.emptyLibraryButton} />
            )}
          </View>
        )}
      </Screen>

      <Modal visible={choosingSort} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setChoosingSort(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]}>
          <Pressable accessibilityLabel="Close sort options" onPress={() => setChoosingSort(false)} style={StyleSheet.absoluteFill} />
          <View role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel="Sort your library" style={[styles.sortSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
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
                    aria-checked={active}
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

      {inspectedCourse ? (
        <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setInspectedCourseId(null)}>
          <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close class details" onPress={() => setInspectedCourseId(null)} style={StyleSheet.absoluteFill} />
            <View role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel={`${inspectedCourse.course.name} class details`} style={[styles.sortSheet, styles.detailsSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <View style={styles.sheetHeadingRow}>
                <SubjectIcon subject={inspectedCourse.course.name} emoji={inspectedCourse.course.emoji} size={44} animated={false} />
                <View style={styles.sheetHeadingCopy}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{inspectedCourse.course.name}</Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Class details</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss class details" onPress={() => setInspectedCourseId(null)} style={styles.classInfoButton}><Icon name="close" size={22} color={colors.textSecondary} /></Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailsContent}>
                {formatClassAddedDate(inspectedCourse.course.createdAt) ? (
                  <View style={styles.detailsDateRow}>
                    <Icon name="calendar-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailsText, { color: colors.textSecondary }]}>Created {formatClassAddedDate(inspectedCourse.course.createdAt)}</Text>
                  </View>
                ) : null}
                <Text style={[styles.detailsHeading, { color: colors.text }]}>Estimated mastery{inspectedCourse.decks.length ? ` — ${calculateCourseMastery(inspectedCourse.decks)}%` : ''}</Text>
                <Text style={[styles.detailsText, { color: colors.textSecondary }]}>{inspectedCourse.decks.length ? 'Class mastery is the rounded average of the existing mastery scores of its study packs.' : 'Create your first study pack to see an estimated mastery score.'}</Text>
                <Text style={[styles.detailsText, { color: colors.textSecondary }]}>Each pack combines reviewed notes (25%), flashcard confidence (35%), and its latest quiz score (40%). Known flashcards count fully, learning cards count half, and new cards count zero.</Text>
                <Text style={[styles.detailsText, { color: colors.textSecondary }]}>Once a cumulative test is recorded, the weights are notes 20%, flashcards 30%, latest quiz 20%, and latest test 30%.</Text>
                <Text style={[styles.detailsNote, { color: colors.textSecondary, backgroundColor: colors.cardStrong }]}>This is a study estimate, not a predicted exam grade. “Last studied” uses recorded study activity, rather than the date a pack was created or opened.</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}

      <Modal visible={creatingClass} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={closeClassModal}>
        <KeyboardAvoidingView style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.68)' : 'rgba(17,28,78,0.32)' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable accessibilityLabel="Close new class dialog" onPress={closeClassModal} style={StyleSheet.absoluteFill} />
          <View role="dialog" aria-modal accessibilityViewIsModal accessibilityLabel="Create a class" style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
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

              <Text style={[styles.inputLabel, styles.optionLabel, { color: colors.textSecondary }]}>Choose a subject icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.iconOptions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Automatically choose an icon from class name, currently ${suggestedIcon.label}`}
                  accessibilityState={{ selected: selectedEmoji === null }}
                  onPress={() => setSelectedEmoji(null)}
                  style={[styles.iconOption, { backgroundColor: selectedEmoji === null ? colors.primarySoft : colors.backgroundRaised, borderColor: selectedEmoji === null ? colors.primary : colors.border }]}
                >
                  <SubjectIcon subject={newClassName} size={40} animated={false} />
                  <Text style={[styles.iconOptionLabel, { color: selectedEmoji === null ? colors.primary : colors.textSecondary }]}>Auto</Text>
                </Pressable>
                {SUBJECT_ICONS.map((icon) => {
                  const active = selectedEmoji === icon.emoji;
                  return (
                    <Pressable key={icon.id} accessibilityRole="button" accessibilityLabel={`Use ${icon.label} icon`} accessibilityState={{ selected: active }} onPress={() => setSelectedEmoji(icon.emoji)} style={[styles.iconOption, { backgroundColor: active ? colors.primarySoft : colors.backgroundRaised, borderColor: active ? colors.primary : colors.border }]}>
                      <SubjectIcon emoji={icon.emoji} size={40} animated={false} />
                      <Text numberOfLines={1} style={[styles.iconOptionLabel, { color: active ? colors.primary : colors.textSecondary }]}>{icon.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.inputLabel, styles.optionLabel, { color: colors.textSecondary }]}>Choose a color</Text>
              <View style={styles.optionRow}>
                {CLASS_COLORS.map((color) => {
                  const active = selectedColor === color;
                  return <Pressable key={color} accessibilityRole="button" accessibilityLabel="Choose class color" onPress={() => setSelectedColor(color)} style={[styles.colorOption, { backgroundColor: color, borderColor: colors.card }, active && { borderColor: colors.text, borderWidth: 3 }]} />;
                })}
              </View>

              <View style={[styles.previewCard, { backgroundColor: `${selectedColor}16`, borderColor: `${selectedColor}44` }]}>
                <SubjectIcon subject={newClassName} emoji={classEmoji} size={44} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.previewTitle, { color: colors.text }]}>{newClassName.trim() || 'Your new class'}</Text>
                  <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>0 study packs · Ready to learn</Text>
                </View>
              </View>

              <PrimaryButton label="Create class" icon="plus" onPress={createClass} style={styles.createButton} />
              <Pressable accessibilityRole="button" onPress={closeClassModal} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Maybe later</Text></Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  newClassButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  selectButton: { minHeight: 44, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, justifyContent: 'center' },
  selectText: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.9, marginTop: 11 },
  subtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  searchField: { minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 13, paddingRight: 4, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: 10, fontSize: 13 },
  clearSearch: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  continueRow: { minHeight: 76, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 14 },
  continueIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  continueLabel: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  continueTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700', marginTop: 2 },
  continueMeta: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  reviewBanner: { marginTop: 18 },
  reviewBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewSubtitle: { fontSize: 11, marginTop: 3 },
  reviewButton: { minHeight: 48, marginTop: 14 },
  libraryToolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.3 },
  toolbarActions: { flexGrow: 1, flexShrink: 1, flexBasis: 240, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  savedButton: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11 },
  savedButtonText: { fontSize: 11, fontWeight: '800' },
  sortButton: { minHeight: 44, maxWidth: 180, flexShrink: 1, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderRadius: radius.pill },
  sortButtonPressed: { opacity: 0.82 },
  sortButtonText: { flexShrink: 1, fontSize: 11, fontWeight: '800' },
  courseList: { gap: 14 },
  classGroup: { position: 'relative', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  classAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  courseHeader: { minHeight: 72, paddingHorizontal: 14, paddingTop: 13, paddingBottom: 3, paddingLeft: 17 },
  courseHeaderPressed: { opacity: 0.88 },
  courseHeaderMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  courseHeaderCopy: { flex: 1, minWidth: 0 },
  courseName: { fontSize: 17, lineHeight: 23, fontWeight: '800' },
  courseMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  masteryArea: { paddingLeft: 17, paddingRight: 14, paddingBottom: 12 },
  masteryLabelRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  masteryLabel: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  classInfoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  masteryTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  masteryFill: { height: 5, borderRadius: 3 },
  measuredBody: { width: '100%', flexShrink: 0 },
  classBody: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 9 },
  speedReviewRow: { minHeight: 54, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 8, marginBottom: 10 },
  speedReviewIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  speedReviewCopy: { flex: 1, minWidth: 0 },
  speedReviewTitle: { fontSize: 12, fontWeight: '900' },
  speedReviewSubtitle: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  emptyClassCard: { minHeight: 68, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  emptyClassIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyClassCopy: { flex: 1 },
  emptyClassTitle: { fontSize: 13, fontWeight: '800' },
  emptyClassSubtitle: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  addSlidesButton: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  deckList: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  deckRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  deckRowPressed: { opacity: 0.84 },
  deckDivider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  deckFileIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 36, height: 36, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  deckCopy: { flex: 1, minWidth: 0 },
  deckTitle: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  deckKind: { fontWeight: '700' },
  deckMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  addPackRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 8, marginTop: 5 },
  addPackIcon: { width: 27, height: 27, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  addPackText: { fontSize: 12, fontWeight: '700' },
  emptyLibrary: { minHeight: 210, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyLibraryIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyLibraryTitle: { fontSize: 16, fontWeight: '900' },
  emptyLibraryText: { maxWidth: 280, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  emptyLibraryAction: { paddingHorizontal: 16, paddingVertical: 11, marginTop: 6 },
  emptyLibraryActionText: { fontSize: 12, fontWeight: '900' },
  emptyLibraryButton: { width: '100%', minHeight: 48, marginTop: 16 },
  flatCard: { shadowOpacity: 0, elevation: 0 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sortSheet: { width: '100%', maxWidth: 560, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 16 },
  sortOptions: { gap: 9, marginTop: 20 },
  sortOption: { minHeight: 68, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  sortOptionPressed: { opacity: 0.8 },
  sortOptionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sortOptionCopy: { flex: 1 },
  sortOptionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  sortOptionDescription: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  detailsSheet: { maxHeight: '85%' },
  detailsContent: { gap: 14, paddingTop: 18, paddingBottom: 10 },
  detailsDateRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailsHeading: { fontSize: 16, lineHeight: 22, fontWeight: '700', marginTop: 3 },
  detailsText: { flexShrink: 1, fontSize: 13, lineHeight: 20 },
  detailsNote: { fontSize: 12, lineHeight: 18, padding: 12, borderRadius: 12 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '94%', alignSelf: 'center', borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
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
  iconOptions: { gap: 8, paddingVertical: 3 },
  iconOption: { width: 70, minHeight: 72, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 4, padding: 5 },
  iconOptionLabel: { fontSize: 9, fontWeight: '700' },
  colorOption: { width: 31, height: 31, borderRadius: 16, borderWidth: 1 },
  previewCard: { minHeight: 65, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, marginTop: 19 },
  previewTitle: { fontSize: 13, fontWeight: '900' },
  previewMeta: { fontSize: 10, marginTop: 3 },
  createButton: { minHeight: 52, marginTop: 15 },
  cancelButton: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 12, fontWeight: '800' },
});
