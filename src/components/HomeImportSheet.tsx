import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_TYPED_SOURCE_CHARS } from '../services/documentProcessor';
import type { AppColors } from '../theme';
import { Icon, PrimaryButton } from './ui';

export function HomeImportSheet({ colors, reducedMotion, choosingFiles, onChooseFiles, onContinue, onClose }: {
  colors: AppColors;
  reducedMotion: boolean;
  choosingFiles: boolean;
  onChooseFiles: () => void;
  onContinue: (notes: string) => void;
  onClose: () => void;
}) {
  const { top, bottom } = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const notes = draft.trim();
  const tooLong = notes.length > MAX_TYPED_SOURCE_CHARS;
  const close = () => { if (!choosingFiles) onClose(); };

  return <Modal visible transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { paddingTop: top + 12 }]}>
      {!editing ? <Pressable accessible={false} importantForAccessibility="no" onPress={close} style={StyleSheet.absoluteFill} /> : null}
      <View role="dialog" aria-modal accessibilityViewIsModal onAccessibilityEscape={close} style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(bottom, 14) }]}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{editing ? 'Paste or type notes' : 'Add study material'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Close notes editor' : 'Close import options'} disabled={choosingFiles} onPress={close} style={[styles.close, { backgroundColor: colors.cardStrong }]}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.scroll}>
          {editing ? <>
            <TextInput
              autoFocus
              multiline
              accessibilityLabel="Study notes"
              placeholder="Paste a study guide or type a few notes and questions."
              placeholderTextColor={colors.textMuted}
              value={draft}
              onChangeText={setDraft}
              style={[styles.editor, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            />
            {tooLong ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>These notes are too long for one Study Pack. Try a shorter section.</Text> : null}
            <PrimaryButton label="Continue" icon="arrow-right" disabled={!notes || tooLong} onPress={() => onContinue(notes)} />
          </> : <>
            <PrimaryButton label="Choose Files" icon="folder-open-outline" loading={choosingFiles} onPress={onChooseFiles} />
            <Pressable accessibilityRole="button" disabled={choosingFiles} onPress={() => setEditing(true)} style={({ pressed }) => [styles.secondary, { opacity: choosingFiles || pressed ? 0.6 : 1 }]}>
              <Icon name="note-text-outline" size={18} color={colors.primary} />
              <Text style={[styles.secondaryText, { color: colors.primary }]}>Paste or type notes</Text>
            </Pressable>
          </>}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#09132688' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '100%', flexShrink: 1, borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  close: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { gap: 8, paddingTop: 8 },
  editor: { height: 150, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, textAlignVertical: 'top', fontSize: 16, lineHeight: 23 },
  secondary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  secondaryText: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
