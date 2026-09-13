import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DiscoverStudySet } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { Card, Icon, Pill } from './ui';

function ageLabel(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 'Recently updated';
  const days = Math.max(0, Math.floor((Date.now() - time) / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 30) return `Updated ${days}d ago`;
  const months = Math.floor(days / 30);
  return `Updated ${months}mo ago`;
}

export function CommunitySetCard({ set, onPress }: { set: DiscoverStudySet; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={[styles.icon, { backgroundColor: colors.purpleSoft }]}>
        <Icon name="book-open-page-variant-outline" size={23} color={colors.purple} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{set.title}</Text>
          <Pill label={set.subject || 'Study'} tone="purple" />
        </View>
        <Text numberOfLines={1} style={[styles.course, { color: colors.textSecondary }]}>{set.classLabel ?? set.courseName}</Text>
        {set.description ? <Text numberOfLines={2} style={[styles.description, { color: colors.textMuted }]}>{set.description}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{set.itemCount} items</Text>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <Text numberOfLines={1} style={[styles.creator, { color: colors.textMuted }]}>by {set.creatorDisplayName}</Text>
          {set.saveCount > 0 ? (
            <><View style={[styles.dot, { backgroundColor: colors.textMuted }]} /><Text style={[styles.meta, { color: colors.textMuted }]}>{set.saveCount} saved</Text></>
          ) : null}
        </View>
        <Text style={[styles.age, { color: colors.textMuted }]}>{ageLabel(set.updatedAt)}</Text>
      </View>
      <Icon name="chevron-right" color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 13, shadowOpacity: 0, elevation: 0 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  course: { fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  description: { fontSize: 10, lineHeight: 14, marginTop: 5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meta: { fontSize: 9, fontWeight: '700' },
  creator: { flexShrink: 1, fontSize: 9, fontWeight: '700' },
  dot: { width: 3, height: 3, borderRadius: 2 },
  age: { fontSize: 8, marginTop: 4 },
});
