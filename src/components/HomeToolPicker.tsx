import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { StudyPack } from '../models';
import { typography } from '../theme';
import { SubjectIcon } from './SubjectIcon';
import { Icon } from './ui';

export function HomeToolPicker({ label, packs, onSelect, onClose }: {
  label: string; packs: StudyPack[]; onSelect: (pack: StudyPack) => void; onClose: () => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingTop: insets.top + 12 }]}>
        <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View role="dialog" aria-modal accessibilityViewIsModal onAccessibilityEscape={onClose}
          style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[typography.sectionTitle, styles.fill, { color: colors.text }]}>{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Study Pack picker" onPress={onClose}
              style={[styles.close, { backgroundColor: colors.cardStrong }]}><Icon name="close" size={21} /></Pressable>
          </View>
          <Text style={[typography.secondary, { color: colors.textSecondary, marginBottom: 8 }]}>Choose a Study Pack</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }}>
            {packs.map(pack => (
              <Pressable key={pack.id} accessibilityRole="button" onPress={() => onSelect(pack)}
                style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? colors.primarySoft : colors.background, borderColor: colors.border }]}>
                <SubjectIcon subject={pack.courseName} emoji={pack.emoji} size={37} animated={false} />
                <View style={styles.fill}>
                  <Text style={[typography.cardTitle, { color: colors.text }]}>{pack.title}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{pack.courseName}</Text>
                </View>
                <Icon name="chevron-right" size={19} color={colors.primary} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#080F235C' },
  sheet: { width: '100%', maxWidth: 530, maxHeight: '90%', flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  fill: { flex: 1, minWidth: 0 },
  close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  choice: { minHeight: 57, borderRadius: 13, borderWidth: 1, padding: 8, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 9 },
});
