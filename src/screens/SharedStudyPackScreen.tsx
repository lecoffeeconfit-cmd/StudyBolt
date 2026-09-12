import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { Card, Icon, PrimaryButton } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { SharedStudyPackContent } from '../models';
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
    void fetchSharedStudyPack(token).then((result) => {
      if (!mounted) return;
      if (result.error || !result.content) {
        setError(result.error ?? 'This Study Pack link is no longer available.');
      } else {
        setContent(result.content);
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
    const copy = cloneSharedStudyPack(content, token);
    addDeck(copy);
    recordStudyEvent({ type: 'shared-pack-saved', deckId: copy.id, courseId: copy.courseId });
    setSaving(false);
    onOpenSavedDeck(copy.id);
  };

  if (loading) {
    return (
      <View style={[styles.state, { backgroundColor: colors.background, paddingTop: insets.top + 40 }]}>
        <View style={[styles.loadingIcon, { backgroundColor: colors.primarySoft }]}><ActivityIndicator color={colors.primary} size="small" /></View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>Opening shared Study Pack</Text>
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>Fetching the study material securely…</Text>
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
      onSaveShared={saveCopy}
      initialTool="overview"
      onBack={onBack}
      onPlan={() => undefined}
    />
  );
}

const styles = StyleSheet.create({
  state: { flex: 1, alignItems: 'center', paddingHorizontal: 30 },
  loadingIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  errorIcon: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  stateTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  stateText: { maxWidth: 330, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 7 },
  stateButton: { minWidth: 210, marginTop: 24 },
  skeletons: { width: '100%', gap: 12, marginTop: 35 },
  skeleton: { height: 24, borderRadius: 9 },
  skeletonLarge: { height: 150 },
});
