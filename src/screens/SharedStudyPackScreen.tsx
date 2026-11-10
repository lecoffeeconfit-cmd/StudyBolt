import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StudyBoltLoading } from '../components/StudyBoltLoading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { Card, Icon, PrimaryButton } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { SharedStudyPackContent, SharedStudyPackPreview } from '../models';
import { incrementSharedPackSave } from '../services/community';
import { cloneSharedStudyPack, fetchSharedStudyPack, sharedContentToStudyPack } from '../services/sharing';
import { StudyPackScreen } from './StudyPackScreen';

export function SharedStudyPackScreen({
  token,
  onBack,
  onRequireAuth,
  onOpenSavedDeck,
}: {
  token: string;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenSavedDeck: (deckId: string) => void;
}) {
  const { colors, state, addDeck, recordStudyEvent } = useStudyBolt();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<SharedStudyPackContent | null>(null);
  const [preview, setPreview] = useState<SharedStudyPackPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recordStudyEventRef = useRef(recordStudyEvent);
  recordStudyEventRef.current = recordStudyEvent;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setContent(null);
    setPreview(null);
    void fetchSharedStudyPack(token).then((result) => {
      if (!mounted) return;
      if (result.error || !result.content) {
        setError(result.error ?? 'This Study Pack link is no longer available.');
      } else {
        setContent(result.content);
        setPreview(result.preview ?? null);
        recordStudyEventRef.current({ type: 'shared-pack-opened' });
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  const saveCopy = () => {
    if (!content || saving) return;
    if (!user) {
      onRequireAuth();
      return;
    }
    const existing = state.decks.find((deck) => deck.sharedFromToken === token);
    if (existing) {
      onOpenSavedDeck(existing.id);
      return;
    }
    setSaving(true);
    const copy = cloneSharedStudyPack(content, token, preview?.metadata);
    addDeck(copy);
    void incrementSharedPackSave(token);
    recordStudyEvent({ type: 'shared-pack-saved', deckId: copy.id, courseId: copy.courseId });
    setSaving(false);
    onOpenSavedDeck(copy.id);
  };

  if (loading) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <StudyBoltLoading colors={colors} message="Opening shared Study Pack…" detail="Fetching the study material securely." />
        <View style={styles.skeletons}><View style={[styles.skeleton, { backgroundColor: colors.cardStrong }]} /><View style={[styles.skeleton, styles.skeletonLarge, { backgroundColor: colors.cardStrong }]} /></View>
      </View>
    );
  }

  if (!content || error) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <View style={[styles.errorIcon, { backgroundColor: `${colors.danger}14` }]}><Icon name="link-off" size={34} color={colors.danger} /></View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>This link isn’t available</Text>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>{error ?? 'The Study Pack may have been deleted or the link may have been disabled.'}</Text>
        <PrimaryButton label="Back to StudyBolt" icon="arrow-left" onPress={onBack} style={styles.stateButton} />
      </View>
    );
  }

  const deck = sharedContentToStudyPack(content, token);
  return (
    <StudyPackScreen
      deckId={deck.id}
      deckOverride={deck}
      shared
      sharedMetadata={preview?.metadata}
      onSaveShared={saveCopy}
      initialTool="overview"
      onBack={onBack}
      onPlan={() => undefined}
      onRequireAuth={onRequireAuth}
    />
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', paddingHorizontal: 30 },
  loadingIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  errorIcon: { width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  stateTitle: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center', maxWidth: '100%', width: '100%' },
  stateText: { maxWidth: '100%', fontSize: 15, lineHeight: 24, textAlign: 'center', marginTop: 10, width: '100%' },
  stateButton: { minWidth: 210, marginTop: 24, minHeight: 52, alignSelf: 'stretch', maxWidth: 360 },
  skeletons: { width: '100%', gap: 14, marginTop: 35, maxWidth: 440 },
  skeleton: { height: 24, borderRadius: 9 },
  skeletonLarge: { height: 150 },
});
