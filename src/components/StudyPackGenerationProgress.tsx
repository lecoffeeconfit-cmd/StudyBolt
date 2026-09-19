import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudyPackMaterial } from '../models';
import { AUTOMATIC_STUDY_PACK_MATERIALS, STUDY_PACK_MATERIAL_LABELS } from '../services/documentProcessor';
import { useStudyBolt } from '../StudyBoltContext';
import { Icon } from './ui';

export function StudyPackGenerationProgress() {
  const { colors, state, retryStudyPackMaterial } = useStudyBolt();
  const [expanded, setExpanded] = useState(true);
  const [hiddenDeckIds, setHiddenDeckIds] = useState<string[]>([]);
  const deck = useMemo(() => [...state.decks]
    .filter((item) => item.generation && !hiddenDeckIds.includes(item.id))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0], [hiddenDeckIds, state.decks]);
  const materials = deck?.generation?.materials;
  const ready = materials ? AUTOMATIC_STUDY_PACK_MATERIALS.filter((item) => materials[item].status === 'ready').length : 0;
  const failed = materials ? AUTOMATIC_STUDY_PACK_MATERIALS.filter((item) => materials[item].status === 'failed').length : 0;
  const complete = Boolean(materials && ready === AUTOMATIC_STUDY_PACK_MATERIALS.length);

  useEffect(() => {
    if (!deck) return;
    setExpanded(true);
  }, [deck?.id]);

  useEffect(() => {
    if (!deck || !complete) return;
    const timeout = setTimeout(() => setHiddenDeckIds((current) => [...current, deck.id]), 3200);
    return () => clearTimeout(timeout);
  }, [complete, deck]);

  if (!deck || !materials) return null;

  if (complete) {
    return (
      <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.mint }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check" size={18} color={colors.mint} /></View>
        <Text style={[styles.bannerTitle, { color: colors.text }]}>Study Pack ready</Text>
      </View>
    );
  }

  if (!expanded) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="View Study Pack generation progress" onPress={() => setExpanded(true)} style={[styles.banner, { backgroundColor: colors.card, borderColor: failed ? colors.danger : colors.border }]}>
        <View style={[styles.bannerIcon, { backgroundColor: failed ? `${colors.danger}18` : colors.goldSoft }]}><Icon name={failed ? 'alert-outline' : 'lightning-bolt'} size={18} color={failed ? colors.danger : colors.goldText} /></View>
        <Text numberOfLines={1} style={[styles.bannerTitle, { color: colors.text }]}>{failed ? `${failed} item${failed === 1 ? '' : 's'} need retry` : `Study Pack still building · ${ready} of 6 ready`}</Text>
        <Text style={[styles.viewLabel, { color: colors.primary }]}>View</Text>
      </Pressable>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
      <View style={styles.header}>
        <View style={[styles.panelIcon, { backgroundColor: colors.goldSoft }]}><Icon name="lightning-bolt" size={20} color={colors.goldText} /></View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Building your Study Pack</Text>
          <Text style={[styles.count, { color: colors.textSecondary }]}>{ready} of 6 ready{failed ? ` · ${failed} need retry` : ''}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Collapse progress" onPress={() => setExpanded(false)} hitSlop={10} style={styles.collapseButton}><Icon name="chevron-down" color={colors.textMuted} /></Pressable>
      </View>
      <View style={styles.rows}>
        {AUTOMATIC_STUDY_PACK_MATERIALS.map((material) => (
          <MaterialRow key={material} material={material} deckId={deck.id} status={materials[material]} onRetry={retryStudyPackMaterial} />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>You can start studying anything that’s ready.</Text>
    </View>
  );
}

function MaterialRow({ material, deckId, status, onRetry }: {
  material: StudyPackMaterial;
  deckId: string;
  status: NonNullable<import('../models').StudyPack['generation']>['materials'][StudyPackMaterial];
  onRetry: (deckId: string, material: StudyPackMaterial) => void;
}) {
  const { colors } = useStudyBolt();
  const ready = status.status === 'ready';
  const failed = status.status === 'failed';
  return (
    <View style={styles.row}>
      <View style={[styles.statusIcon, { backgroundColor: ready ? colors.mintSoft : failed ? `${colors.danger}16` : colors.cardStrong }]}>
        <Icon name={ready ? 'check' : failed ? 'alert-outline' : 'circle-small'} size={16} color={ready ? colors.mint : failed ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{STUDY_PACK_MATERIAL_LABELS[material]}</Text>
      {failed ? (
        <Pressable accessibilityRole="button" onPress={() => onRetry(deckId, material)} style={[styles.retry, { backgroundColor: `${colors.danger}12` }]}>
          <Icon name="refresh" size={13} color={colors.danger} />
          <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
        </Pressable>
      ) : (
        <Text style={[styles.state, { color: ready ? colors.mint : colors.textMuted }]}>{ready ? 'Ready' : status.stage || 'Creating…'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', zIndex: 50, elevation: 12, left: 12, right: 12, bottom: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: 14, shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  banner: { position: 'absolute', zIndex: 50, elevation: 12, left: 12, right: 12, bottom: 82, minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bannerIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { flex: 1, fontSize: 12, fontWeight: '900' },
  viewLabel: { fontSize: 11, fontWeight: '900' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  panelIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '900' },
  count: { fontSize: 10, marginTop: 2, fontWeight: '700' },
  collapseButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  rows: { marginTop: 12, gap: 8 },
  row: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 9 },
  statusIcon: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 11, fontWeight: '800' },
  state: { maxWidth: 132, fontSize: 9, fontWeight: '700', textAlign: 'right' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  retryText: { fontSize: 9, fontWeight: '900' },
  hint: { marginTop: 11, fontSize: 10, textAlign: 'center' },
});
