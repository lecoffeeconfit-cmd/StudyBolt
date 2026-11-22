import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLASS_ICON_CATEGORIES, CLASS_ICONS, classIconColumns, getClassIcon, recommendClassIcons, searchClassIcons, type ClassIconCategory, type ClassIconOption } from '../data/classIcons';
import { getSubjectIcon } from '../data/subjectIcons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StudyClass } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { ClassIcon, ClassIdentity } from './ClassIdentity';
import { Icon, PrimaryButton } from './ui';

const CLASS_COLOR_FAMILIES = [
  { name: 'Mint', shades: [{ name: 'Classic', color: '#39BFA3' }, { name: 'Deep', color: '#248E77' }, { name: 'Dark', color: '#176B5A' }] },
  { name: 'Rose', shades: [{ name: 'Classic', color: '#F26D8B' }, { name: 'Deep', color: '#D64F72' }, { name: 'Dark', color: '#AD3758' }] },
  { name: 'Blue', shades: [{ name: 'Classic', color: '#418DFF' }, { name: 'Deep', color: '#2863C7' }, { name: 'Dark', color: '#1F4A91' }] },
  { name: 'Amber', shades: [{ name: 'Classic', color: '#F3A633' }, { name: 'Deep', color: '#C98419' }, { name: 'Dark', color: '#9B5B0C' }] },
  { name: 'Violet', shades: [{ name: 'Classic', color: '#7D5CFF' }, { name: 'Deep', color: '#6142C7' }, { name: 'Dark', color: '#473094' }] },
  { name: 'Teal', shades: [{ name: 'Classic', color: '#11A7A2' }, { name: 'Deep', color: '#0D7F7B' }, { name: 'Dark', color: '#075D5A' }] },
];

export function ClassAppearanceEditor({ original, packCount, onClose }: {
  original?: StudyClass;
  packCount: number;
  onClose: () => void;
}) {
  const { colors, state, addClass, editClassAppearance } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const webInsets = useWebViewportInsets();
  const [name, setName] = useState(original?.name ?? '');
  const [color, setColor] = useState(original?.color ?? CLASS_COLOR_FAMILIES[0]!.shades[0]!.color);
  const [iconId, setIconId] = useState(original?.iconId);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<Text>(null);
  const fallbackIcon = getSubjectIcon(name, original?.emoji);
  const preview = { name, emoji: original?.emoji ?? fallbackIcon.emoji, iconId, color };
  const title = browsing ? 'Choose a class icon' : original ? 'Edit class appearance' : 'Create a class';
  const back = () => browsing ? setBrowsing(false) : onClose();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const frame = requestAnimationFrame(() => {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
    });
    return () => cancelAnimationFrame(frame);
  }, [title]);

  const save = () => {
    if (original) {
      if (color !== original.color || iconId !== original.iconId) {
        editClassAppearance(original, {
          ...(color !== original.color ? { color } : {}),
          ...(iconId !== original.iconId ? { iconId } : {}),
        });
      }
    } else {
      const cleanName = name.trim();
      if (!cleanName) return setError('Enter a class name.');
      if (state.classes.some(course => course.name.trim().toLowerCase() === cleanName.toLowerCase())) {
        return setError('You already have a class with that name.');
      }
      const now = Date.now();
      addClass({ ...preview, name: cleanName, id: `class-${now}`, createdAt: new Date(now).toISOString() });
    }
    onClose();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.backdrop, { paddingTop: webInsets.top + insets.top + 8, paddingBottom: webInsets.bottom, backgroundColor: colors.mode === 'dark' ? '#000000AD' : '#111C4E58' }]}>
      <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View role="dialog" aria-modal accessibilityViewIsModal onAccessibilityEscape={back} accessibilityLabel={title}
        style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.neon?.sheetEdge ?? colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.header}>
          <Text ref={heading} accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={browsing ? 'Back to class appearance' : 'Cancel class changes'} onPress={back}
            style={[styles.close, { backgroundColor: colors.cardStrong }]}>
            <Icon name={browsing ? 'arrow-left' : 'close'} size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        {browsing ? (
          <IconPicker course={preview} currentIcon={original?.iconId} editing={Boolean(original)} onSelect={setIconId}
            onKeep={() => { setIconId(original?.iconId); setBrowsing(false); }} packCount={packCount} />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {!original ? <>
              <Text style={[styles.label, { color: colors.text }]}>Class name</Text>
              <TextInput accessibilityLabel="Class name" value={name} onChangeText={text => { setName(text); setError(''); }}
                placeholder="e.g. Anatomy & Physiology" placeholderTextColor={colors.textMuted} returnKeyType="done" selectionColor={colors.neon?.focus}
                style={[styles.field, { backgroundColor: colors.backgroundRaised, color: colors.text, borderColor: error ? colors.danger : colors.border }]} />
              {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
            </> : null}
            <ClassPreview course={preview} packCount={packCount} />
            <Pressable accessibilityRole="button" accessibilityLabel="Browse class icons" accessibilityHint={`Selected: ${getClassIcon(iconId)?.label ?? fallbackIcon.label}`}
              onPress={() => setBrowsing(true)} style={({ pressed }) => [styles.iconField, { backgroundColor: pressed ? colors.primarySoft : colors.backgroundRaised, borderColor: colors.border }]}>
              <ClassIcon course={preview} size={40} />
              <View style={styles.copy}>
                <Text style={[styles.label, { color: colors.text }]}>Class icon</Text>
                <Text style={[styles.detail, { color: colors.textSecondary }]}>{getClassIcon(iconId)?.label ?? (original ? 'Current icon' : `Automatic · ${fallbackIcon.label}`)}</Text>
              </View>
              <Icon name="chevron-right" size={22} color={colors.primary} />
            </Pressable>
            <Text accessibilityRole="header" style={[styles.label, { color: colors.text }]}>Class color</Text>
            <ColorChoices color={color} originalColor={original?.color} onSelect={setColor} />
          </ScrollView>
        )}

        <View style={[styles.footer, { borderColor: colors.border }]}>
          <PrimaryButton label={browsing ? 'Done' : original ? 'Save appearance' : 'Create class'} icon={browsing || original ? 'check' : 'plus'} onPress={browsing ? back : save} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function useWebViewportInsets() {
  const [insets, setInsets] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const top = Math.max(0, Math.ceil(viewport.offsetTop));
      const bottom = Math.max(0, Math.ceil(window.innerHeight - viewport.height - viewport.offsetTop));
      setInsets(previous => previous.top === top && previous.bottom === bottom ? previous : { top, bottom });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return insets;
}

type PreviewClass = Pick<StudyClass, 'name' | 'emoji' | 'iconId' | 'color'>;

function ClassPreview({ course, packCount, animate = false }: { course: PreviewClass; packCount: number; animate?: boolean }) {
  const { colors } = useStudyBolt();
  const reduceMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const lastIconId = useRef(course.iconId);
  useEffect(() => {
    const changed = lastIconId.current !== course.iconId;
    lastIconId.current = course.iconId;
    if (!animate || reduceMotion || !changed) return;
    scale.setValue(0.9);
    const transition = Animated.timing(scale, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    transition.start();
    return () => { transition.stop(); scale.setValue(1); };
  }, [animate, course.iconId, reduceMotion, scale]);
  return (
    <View style={styles.previewGroup}>
      <Text style={[styles.detail, { color: colors.textSecondary }]}>Class card preview</Text>
      <View style={[styles.preview, { backgroundColor: colors.cardStrong, borderColor: colors.neon?.edge ?? colors.border }]}>
        <Animated.View style={{ transform: [{ scale }] }}><ClassIdentity course={course} size={40} /></Animated.View>
        <View style={styles.copy}>
          <Text style={[styles.previewTitle, { color: colors.text }]}>{course.name.trim() || 'Your new class'}</Text>
          <Text style={[styles.detail, { color: colors.textSecondary }]}>{packCount} study {packCount === 1 ? 'pack' : 'packs'}</Text>
        </View>
      </View>
    </View>
  );
}

type Filter = 'recommended' | 'recent' | ClassIconCategory;
const PAGE_SIZE = 24;

function IconPicker({ course, currentIcon, editing, onSelect, onKeep, packCount }: {
  course: PreviewClass;
  currentIcon?: string;
  editing: boolean;
  onSelect: (id: string) => void;
  onKeep: () => void;
  packCount: number;
}) {
  const { state, colors } = useStudyBolt();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('recommended');
  const [choosingCategory, setChoosingCategory] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [width, setWidth] = useState(0);
  const searching = Boolean(query.trim());
  const recent = useMemo(() => (state.recentClassIconIds ?? []).flatMap(id => getClassIcon(id) ?? []), [state.recentClassIconIds]);
  const filters = [{ id: 'recommended' as const, label: 'Recommended' },
    ...(recent.length ? [{ id: 'recent' as const, label: 'Recently used' }] : []), ...CLASS_ICON_CATEGORIES];
  const filterLabel = filters.find(item => item.id === filter)?.label ?? 'Recommended';
  const options = useMemo(() => {
    if (searching) return searchClassIcons(query);
    if (filter === 'recommended') return recommendClassIcons(course.name);
    if (filter === 'recent') return recent;
    return CLASS_ICONS.filter(icon => icon.category === filter);
  }, [course.name, filter, query, recent, searching]);
  const gridWidth = width || Math.min(640, screenWidth) - 36;
  const columns = classIconColumns(gridWidth, fontScale);
  const cellWidth = (gridWidth - (columns - 1) * 8) / columns;
  const shownOptions = options.slice(0, limit);
  const changeQuery = (text: string) => { setQuery(text); setLimit(PAGE_SIZE); };
  const keepLabel = editing ? 'Keep current icon' : 'Use automatic icon';

  return (
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <ClassPreview course={course} packCount={packCount} animate />
      <Pressable accessibilityRole="button" accessibilityLabel={keepLabel} aria-pressed={currentIcon === course.iconId} accessibilityState={{ selected: currentIcon === course.iconId }} onPress={onKeep}
        style={[styles.keep, { borderColor: colors.border, backgroundColor: colors.backgroundRaised }]}>
        <Icon name={currentIcon === course.iconId ? 'check-circle' : 'restore'} size={19} color={colors.primary} />
        <Text style={[styles.label, styles.copy, { color: colors.text }]}>{keepLabel}</Text>
      </Pressable>
      <View style={[styles.search, { backgroundColor: colors.backgroundRaised, borderColor: colors.border }]}>
        <Icon name="magnify" size={21} color={colors.textSecondary} />
        <TextInput accessibilityLabel="Search class icons" placeholder="Search icons" placeholderTextColor={colors.textMuted}
          autoCapitalize="none" autoCorrect={false} returnKeyType="search" value={query} onChangeText={changeQuery}
          selectionColor={colors.neon?.focus} style={[styles.searchInput, { color: colors.text }]} />
        {searching ? <Pressable accessibilityRole="button" accessibilityLabel="Clear icon search" onPress={() => changeQuery('')} style={styles.close}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </Pressable> : null}
      </View>
      {!searching ? (
        <View style={styles.filters}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Icon category, ${filterLabel}`} aria-expanded={choosingCategory} accessibilityState={{ expanded: choosingCategory }}
            onPress={() => setChoosingCategory(value => !value)} style={[styles.categoryField, { borderColor: colors.border, backgroundColor: colors.primarySoft }]}>
            <Icon name="shape-outline" size={19} color={colors.primary} />
            <Text style={[styles.label, styles.copy, { color: colors.text }]}>{filterLabel}</Text>
            <Icon name={choosingCategory ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
          </Pressable>
          {choosingCategory ? <View style={styles.filterChoices}>
            {filters.map(item => <Pressable key={item.id} accessibilityRole="radio" aria-checked={filter === item.id} accessibilityState={{ checked: filter === item.id }}
              onPress={() => { setFilter(item.id); setLimit(PAGE_SIZE); setChoosingCategory(false); }}
              style={[styles.filterChoice, { backgroundColor: filter === item.id ? colors.primarySoft : colors.backgroundRaised, borderColor: filter === item.id ? colors.primary : colors.border }]}>
              <Text style={[styles.detail, { color: colors.text }]}>{item.label}</Text>
              {filter === item.id ? <Icon name="check" size={16} color={colors.primary} /> : null}
            </Pressable>)}
          </View> : null}
        </View>
      ) : <Text accessibilityLiveRegion="polite" style={[styles.detail, { color: colors.textSecondary }]}>{options.length} {options.length === 1 ? 'match' : 'matches'}</Text>}
      {options.length ? (
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.grid}>
          {shownOptions.map(icon => <IconChoice key={icon.id} icon={icon} active={course.iconId === icon.id} width={cellWidth} color={course.color} reducedMotion={reducedMotion} onSelect={onSelect} />)}
        </View>
      ) : <Text style={[styles.detail, { color: colors.textSecondary }]}>Try a subject, object, or course name.</Text>}
      {shownOptions.length < options.length ? <Pressable accessibilityRole="button" onPress={() => setLimit(value => value + PAGE_SIZE)} style={styles.keep}>
        <Text style={[styles.label, { color: colors.primary }]}>Show more icons</Text>
      </Pressable> : null}
    </ScrollView>
  );
}

const IconChoice = memo(function IconChoice({ icon, active, width, color, reducedMotion, onSelect }: { icon: ClassIconOption; active: boolean; width: number; color: string; reducedMotion: boolean; onSelect: (id: string) => void }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={icon.label} aria-checked={active} accessibilityState={{ checked: active }}
      onPress={() => onSelect(icon.id)} style={({ pressed }) => [styles.tile, {
        width, borderColor: active ? colors.neon?.focus ?? colors.primary : colors.border,
        backgroundColor: active || pressed ? colors.primarySoft : colors.backgroundRaised,
      }, pressed && !reducedMotion && styles.tilePressed]}>
      <ClassIcon course={{ name: icon.label, iconId: icon.id, color: active ? color : undefined }} size={42} />
      <Text style={[styles.tileLabel, { color: colors.text }]}>{icon.label}</Text>
      {active ? <View style={[styles.check, { backgroundColor: colors.primary }]}><Icon name="check" size={13} color={colors.primaryText} /></View> : null}
    </Pressable>
  );
});

function ColorChoices({ color, originalColor, onSelect }: { color: string; originalColor?: string; onSelect: (color: string) => void }) {
  const { colors } = useStudyBolt();
  const shades = CLASS_COLOR_FAMILIES.flatMap(family => family.shades.map(shade => ({ label: `${family.name} ${shade.name.toLowerCase()}`, color: shade.color })));
  if (originalColor && !shades.some(shade => shade.color === originalColor)) shades.unshift({ label: 'Original class color', color: originalColor });
  return <View style={styles.swatches}>
    {shades.map(shade => (
      <Pressable key={shade.label} accessibilityRole="radio" accessibilityLabel={shade.label} aria-checked={color === shade.color} accessibilityState={{ checked: color === shade.color }}
        onPress={() => onSelect(shade.color)} style={[styles.swatchButton, { borderColor: color === shade.color ? colors.primary : 'transparent' }]}>
        <View style={[styles.swatch, { backgroundColor: shade.color, borderColor: colors.border }]} />
        {color === shade.color ? <View style={[styles.swatchCheck, { backgroundColor: colors.card }]}><Icon name="check" size={15} color={colors.text} /></View> : null}
      </Pressable>
    ))}
  </View>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '100%', flexShrink: 1, borderWidth: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  title: { fontSize: 21, fontWeight: '800', flex: 1, minWidth: 0 },
  close: { width: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: 12, paddingHorizontal: 18, paddingTop: 3, paddingBottom: 18 },
  footer: { paddingHorizontal: 18, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 13 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  field: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, fontSize: 16 },
  previewGroup: { gap: 6 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 64, padding: 12, borderRadius: 18, borderWidth: 1 },
  previewTitle: { fontSize: 17, fontWeight: '800' },
  iconField: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, padding: 10, borderRadius: 16, borderWidth: 1 },
  keep: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 13, borderWidth: 1, borderColor: 'transparent' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 12, paddingRight: 3, borderWidth: 1, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 48, paddingVertical: 10, paddingRight: 9, fontSize: 16 },
  filters: { gap: 8 },
  categoryField: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1 },
  filterChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterChoice: { minHeight: 44, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { minHeight: 86, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 16 },
  tilePressed: { transform: [{ scale: 0.95 }] },
  tileLabel: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  check: { position: 'absolute', top: 4, right: 4, width: 19, height: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  swatchButton: { width: 44, height: 44, borderWidth: 2, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth },
  swatchCheck: { position: 'absolute', borderRadius: 9, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
});
