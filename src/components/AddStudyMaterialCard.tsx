import { LoadingArtwork } from './StudyBoltLoading';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { ImportAsset, StudyPack } from '../models';
import type { HomeUploadStatus } from '../services/homeUpload';
import { typography, type AppColors } from '../theme';
import { HomeFileDropArea } from './HomeFileDropArea';
import { Icon } from './ui';
import { GuideAnchor, useGuidanceBlocker } from './StudyGuidance';

type Props = {
  colors: AppColors;
  onPress: () => void;
  onDropAssets: (assets: ImportAsset[]) => boolean;
  opening: boolean;
  featuredInPlan: boolean;
  error: string | null;
  status: HomeUploadStatus | null;
  onOpenPack: (deck: StudyPack) => void;
};

export function AddStudyMaterialCard({ colors, onPress, onDropAssets, opening, featuredInPlan, error, status, onOpenPack }: Props) {
  const reducedMotion = useReducedMotion();
  useGuidanceBlocker(opening);
  if (featuredInPlan && Platform.OS !== 'web' && !error && !status) return null;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {(!featuredInPlan || Platform.OS === 'web') ? (
        <HomeFileDropArea disabled={opening} onDropAssets={onDropAssets}>
          {dragging => (
            <GuideAnchor id={opening || dragging ? undefined : 'home-import'} onActivate={onPress} actionLabel="Add material">
            <Pressable accessibilityRole="button" accessibilityLabel="Add course material" accessibilityState={{ disabled: opening, busy: opening }}
              disabled={opening} onPress={onPress} style={({ pressed }) => [styles.addRow, {
                backgroundColor: dragging || pressed ? colors.primarySoft : 'transparent',
                opacity: opening ? 0.65 : 1,
              }]}>
              <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}><Icon name="file-upload-outline" color={colors.primary} size={25} /></View>
              <View style={styles.copy}>
                <Text style={[typography.cardTitle, { color: colors.text }]}>{dragging ? 'Drop files to continue' : opening ? 'Opening files…' : featuredInPlan ? 'Drop files or browse' : 'Add course material'}</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Slides, documents, images, or notes</Text>
              </View>
              <Icon name="plus" color={colors.primary} size={21} />
            </Pressable>
            </GuideAnchor>
          )}
        </HomeFileDropArea>
      ) : null}
      {error ? <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { backgroundColor: colors.cardStrong }]}>
        <Icon name="alert-circle-outline" color={colors.danger} size={20} />
        <Text style={[typography.secondary, styles.copy, { color: colors.text }]}>{error}</Text>
      </View> : null}
      {status ? <GenerationStatus status={status} colors={colors} reducedMotion={reducedMotion} onOpen={() => onOpenPack(status.deck)} /> : null}
    </View>
  );
}

function GenerationStatus({ status, colors, reducedMotion, onOpen }: { status: HomeUploadStatus; colors: AppColors; reducedMotion: boolean; onOpen: () => void }) {
  const creating = status.kind === 'creating';
  const ready = status.kind === 'ready';
  const title = creating ? 'Creating study tools' : ready ? 'Your Study Pack is ready' : status.failed ? 'Study tools need another try' : 'Check study tool status';
  const action = ready ? 'Open pack' : creating ? 'View progress' : status.failed ? 'Review & retry' : 'View tools';
  const tone = ready ? colors.mode === 'dark' ? colors.mint : '#187D68' : creating ? colors.primary : colors.goldText;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={title + '. ' + status.deck.title + '. ' + status.ready + ' of ' + status.total + ' tools ready. ' + action}
    onPress={onOpen}
    style={({ pressed }) => [styles.generation, { borderTopColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
  >
    {creating && !reducedMotion ? <LoadingArtwork compact colors={{ ...colors, primary: tone }} /> : <Icon name={creating ? 'clock-outline' : ready ? 'check-circle-outline' : 'alert-circle-outline'} color={tone} size={22} />}
    <View style={styles.copy} accessibilityLiveRegion="polite">
      <Text style={[styles.generationTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.generationDetail, { color: colors.textSecondary }]}>{status.deck.title} · {status.ready} / {status.total} tools ready{status.failed ? ' · ' + status.failed + ' need retry' : ''}{status.missing ? ' · Some status information is unavailable' : ''}</Text>
      <Text style={[styles.generationAction, { color: tone }]}>{action} →</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 4 },
  addRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9, borderRadius: 14 },
  tile: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  error: { margin: 7, padding: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  generation: { minHeight: 66, marginTop: 13, paddingTop: 13, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  generationTitle: { fontSize: 14, lineHeight: 21, fontWeight: '600' },
  generationDetail: { fontSize: 13, lineHeight: 20, marginTop: 2 },
  generationAction: { fontSize: 13, lineHeight: 20, fontWeight: '600', marginTop: 3 },
});
