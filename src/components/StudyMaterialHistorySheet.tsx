import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StudyPack } from '../models';
import { documentIcon, getImportDocumentType } from '../services/documentTypes';
import type { StudySemester } from '../services/studyMaterialHistory';
import type { AppColors } from '../theme';
import { Icon } from './ui';

interface Props {
  semesters: StudySemester[];
  colors: AppColors;
  reducedMotion: boolean;
  onClose: () => void;
  onOpenPack: (deck: StudyPack) => void;
}

export function StudyMaterialHistorySheet({ semesters, colors, reducedMotion, onClose, onOpenPack }: Props) {
  const insets = useSafeAreaInsets();
  const [selectedTerm, setSelectedTerm] = useState<string | null>(semesters[0]?.label ?? null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 12 }]}>
        <Pressable accessible={false} importantForAccessibility="no" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View role="dialog" aria-modal accessibilityViewIsModal onAccessibilityEscape={onClose} style={[
          styles.sheet,
          { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) },
        ]}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="history" color={colors.primary} size={22} />
            </View>
            <Text accessibilityRole="header" style={[styles.title, styles.copy, { color: colors.text }]}>Class history</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close class history" onPress={onClose} style={({ pressed }) => [
              styles.close, { backgroundColor: colors.cardStrong, opacity: pressed ? 0.7 : 1 },
            ]}>
              <Icon name="close" color={colors.textSecondary} size={21} />
            </Pressable>
          </View>
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            Grouped by when the pack was added. Spring is Jan–May, Summer is Jun–Jul, and Fall is Aug–Dec.
          </Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {semesters.map(semester => {
              const expanded = selectedTerm === semester.label;
              return (
                <View key={semester.label} style={[styles.term, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => {
                    setSelectedTerm(expanded ? null : semester.label);
                    setSelectedClass(null);
                  }} style={({ pressed }) => [styles.disclosure, { backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}>
                    <Icon name="calendar-blank-outline" size={20} color={colors.primary} />
                    <View style={styles.copy}>
                      <Text style={[styles.termName, { color: colors.text }]}>{semester.label}</Text>
                      <Text style={[styles.detail, { color: colors.textSecondary }]}>{semester.packCount} {semester.packCount === 1 ? 'Study Pack' : 'Study Packs'}</Text>
                    </View>
                    <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.primary} />
                  </Pressable>
                  {expanded ? semester.classes.map(course => {
                    const open = selectedClass === course.id;
                    return <View key={course.id} style={[styles.classGroup, { borderTopColor: colors.border }]}>
                      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setSelectedClass(open ? null : course.id)} style={({ pressed }) => [
                        styles.disclosure, { backgroundColor: pressed ? colors.primarySoft : 'transparent' },
                      ]}>
                        <View style={[styles.classDot, { backgroundColor: course.color }]} />
                        <Text style={[styles.copy, styles.className, { color: colors.text }]}>{course.name}</Text>
                        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                      </Pressable>
                      {open ? <View style={styles.packs}>
                        {course.packs.map(({ deck, filenames }) => <View key={deck.id} style={[styles.pack, { backgroundColor: colors.cardStrong }]}>
                          <Pressable accessibilityRole="button" accessibilityLabel={`Open Study Pack, ${deck.title}`} onPress={() => onOpenPack(deck)} style={({ pressed }) => [styles.packLink, pressed && { opacity: 0.7 }]}>
                            <Text style={[styles.copy, styles.className, { color: colors.primary }]}>{deck.title}</Text>
                            <Icon name="chevron-right" size={19} color={colors.primary} />
                          </Pressable>
                          {filenames.map((name, index) => {
                            const type = getImportDocumentType(name);
                            return <View key={`${index}:${name}`} style={styles.file}>
                              <Icon name={type ? documentIcon(type) : 'file-document-outline'} size={16} color={type === 'powerpoint' ? colors.goldText : colors.textSecondary} />
                              <Text style={[styles.copy, styles.detail, { color: colors.textSecondary }]}>{name}</Text>
                            </View>;
                          })}
                        </View>)}
                      </View> : null}
                    </View>;
                  }) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#09132688' },
  sheet: { maxWidth: 580, width: '100%', maxHeight: '100%', flexShrink: 1, borderWidth: 1, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '700', letterSpacing: -0.35 },
  copy: { flex: 1, minWidth: 0 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 13, lineHeight: 20, marginTop: 8, marginBottom: 14 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  list: { gap: 9, paddingBottom: 8 },
  term: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  disclosure: { minHeight: 48, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  termName: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  classGroup: { borderTopWidth: StyleSheet.hairlineWidth },
  classDot: { width: 8, height: 8, borderRadius: 4 },
  className: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  detail: { fontSize: 12, lineHeight: 19 },
  packs: { paddingHorizontal: 10, paddingBottom: 10, gap: 8 },
  pack: { borderRadius: 11, paddingHorizontal: 10, paddingBottom: 8 },
  packLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  file: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingVertical: 2 },
});
