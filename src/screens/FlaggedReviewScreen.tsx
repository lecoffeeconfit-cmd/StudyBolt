import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, FlagButton, Header, Icon, Pill, Screen } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { FlaggedItem, FlaggedItemKind, StudyTool } from '../models';

type ReviewMode = 'all' | 'powerpoint' | 'subject';

const MODES: Array<{ id: ReviewMode; label: string; icon: IconName }> = [
  { id: 'all', label: 'All', icon: 'view-list-outline' },
  { id: 'powerpoint', label: 'PowerPoint', icon: 'file-presentation-box' },
  { id: 'subject', label: 'Subject', icon: 'school-outline' },
];

const KIND_META: Record<FlaggedItemKind, { label: string; icon: IconName; colorKey: 'warning' | 'primary' | 'purple' }> = {
  note: { label: 'NOTE', icon: 'note-text-outline', colorKey: 'primary' },
  flashcard: { label: 'FLASHCARD', icon: 'cards-outline', colorKey: 'purple' },
  quiz: { label: 'QUIZ QUESTION', icon: 'clipboard-text-outline', colorKey: 'warning' },
};

function dateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toolFor(kind: FlaggedItemKind): StudyTool {
  return kind === 'note' ? 'notes' : kind === 'flashcard' ? 'flashcards' : 'quiz';
}

export function FlaggedReviewScreen({
  onBack,
  onOpenDeck,
}: {
  onBack: () => void;
  onOpenDeck: (deckId: string, tool: StudyTool) => void;
}) {
  const { colors, state, removeFlag } = useStudyBolt();
  const [mode, setMode] = useState<ReviewMode>('all');
  const items = useMemo(() => [...state.flaggedItems].sort((a, b) => dateValue(b.flaggedAt) - dateValue(a.flaggedAt)), [state.flaggedItems]);
  const courses = new Set(items.map((item) => item.courseId)).size;
  const decks = new Set(items.map((item) => item.deckId)).size;

  const groups = useMemo(() => {
    if (mode === 'all') return [];
    const grouped = new Map<string, FlaggedItem[]>();
    items.forEach((item) => {
      const key = mode === 'powerpoint' ? item.deckId : item.courseId;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });
    return [...grouped.entries()].map(([key, groupedItems]) => {
      const first = groupedItems[0]!;
      const deck = state.decks.find((candidate) => candidate.id === first.deckId);
      return {
        key,
        title: mode === 'powerpoint' ? first.deckTitle : first.courseName,
        subtitle: mode === 'powerpoint'
          ? `${first.courseName} · ${groupedItems.length} saved ${groupedItems.length === 1 ? 'item' : 'items'}`
          : `${new Set(groupedItems.map((item) => item.deckId)).size} PowerPoints · ${groupedItems.length} saved ${groupedItems.length === 1 ? 'item' : 'items'}`,
        emoji: mode === 'powerpoint' ? deck?.emoji ?? '📄' : state.classes.find((course) => course.id === first.courseId)?.emoji ?? '📚',
        color: mode === 'powerpoint' ? deck?.color ?? colors.primary : state.classes.find((course) => course.id === first.courseId)?.color ?? colors.primary,
        items: groupedItems,
      };
    });
  }, [colors.primary, items, mode, state.classes, state.decks]);

  return (
    <Screen>
      <Header title="Flagged for later" onBack={onBack} right={<Pill label={`${items.length} saved`} tone="purple" />} />

      <View style={[styles.hero, { backgroundColor: colors.mode === 'dark' ? '#30291D' : '#FFF4DB' }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.card }]}><Icon name="flag" size={27} color={colors.warning} /></View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>A queue for the tricky parts</Text>
          <Text style={[styles.heroText, { color: colors.textSecondary }]}>Flag anything that needs another pass. It stays here until you’re ready to clear it.</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Summary value={items.length} label="saved items" color={colors.warning} />
        <Summary value={decks} label="PowerPoints" color={colors.primary} />
        <Summary value={courses} label="subjects" color={colors.purple} />
      </View>

      <View style={[styles.modeSwitcher, { backgroundColor: colors.cardStrong }]}>
        {MODES.map((candidate) => {
          const active = mode === candidate.id;
          return (
            <Pressable
              key={candidate.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(candidate.id)}
              style={[styles.mode, active && { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}
            >
              <Icon name={candidate.icon} size={16} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.modeText, { color: active ? colors.text : colors.textMuted }]}>{candidate.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.modeDescription, { color: colors.textSecondary }]}>
        {mode === 'all' ? 'One mixed queue across every class.' : mode === 'powerpoint' ? 'Keep each presentation’s flagged ideas together.' : 'See the concepts you saved across a whole subject.'}
      </Text>

      {!items.length ? (
        <Card style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}><Icon name="flag-outline" size={32} color={colors.primary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing flagged yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>When a note, flashcard, or quiz question feels worth another look, tap its flag and it’ll show up here.</Text>
        </Card>
      ) : mode === 'all' ? (
        <View style={styles.list}>{items.map((item) => <FlaggedCard key={item.id} item={item} onRemove={() => removeFlag(item.id)} onOpen={() => onOpenDeck(item.deckId, toolFor(item.kind))} />)}</View>
      ) : (
        <View style={styles.groupList}>
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupIcon, { backgroundColor: `${group.color}20` }]}><Text style={styles.groupEmoji}>{group.emoji}</Text></View>
                <View style={styles.groupCopy}>
                  <Text style={[styles.groupTitle, { color: colors.text }]}>{group.title}</Text>
                  <Text style={[styles.groupSubtitle, { color: colors.textMuted }]}>{group.subtitle}</Text>
                </View>
              </View>
              <View style={styles.list}>{group.items.map((item) => <FlaggedCard key={item.id} item={item} onRemove={() => removeFlag(item.id)} onOpen={() => onOpenDeck(item.deckId, toolFor(item.kind))} />)}</View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function FlaggedCard({ item, onRemove, onOpen }: { item: FlaggedItem; onRemove: () => void; onOpen: () => void }) {
  const { colors } = useStudyBolt();
  const [revealed, setRevealed] = useState(item.kind === 'note');
  const meta = KIND_META[item.kind];
  const accent = colors[meta.colorKey];
  const canReveal = item.kind !== 'note';

  return (
    <Card style={[styles.itemCard, { borderColor: `${accent}44` }]}>
      <View style={styles.itemTop}>
        <View style={[styles.kindBadge, { backgroundColor: `${accent}16` }]}>
          <Icon name={meta.icon} size={15} color={accent} />
          <Text style={[styles.kindText, { color: accent }]}>{meta.label}</Text>
        </View>
        <FlagButton flagged onPress={onRemove} label="Remove flag" />
      </View>
      <Text style={[styles.itemContext, { color: colors.textMuted }]}>{item.courseName} · {item.deckTitle}</Text>
      <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.itemPrompt, { color: colors.text }]}>{item.prompt}</Text>

      {revealed ? (
        <View style={[styles.answerBlock, { backgroundColor: item.kind === 'quiz' ? colors.mintSoft : colors.primarySoft }]}>
          <View style={styles.answerHeading}>
            <Icon name={item.kind === 'note' ? 'lightbulb-on-outline' : 'check-circle-outline'} size={16} color={item.kind === 'quiz' ? colors.mint : colors.primary} />
            <Text style={[styles.answerLabel, { color: item.kind === 'quiz' ? colors.mint : colors.primary }]}>{item.kind === 'note' ? 'KEY POINTS' : 'ANSWER'}</Text>
          </View>
          <Text style={[styles.answerText, { color: colors.textSecondary }]}>{item.answer}</Text>
          {item.explanation ? <Text style={[styles.explanation, { color: colors.textMuted }]}>{item.explanation}</Text> : null}
        </View>
      ) : null}

      <View style={styles.itemActions}>
        {canReveal ? (
          <Pressable onPress={() => setRevealed((value) => !value)} style={[styles.secondaryAction, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>{revealed ? 'Hide answer' : 'Reveal answer'}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onOpen} style={[styles.openAction, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.openActionText, { color: colors.primary }]}>Open in pack</Text>
          <Icon name="arrow-right" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <View style={[styles.sourceRow, { borderTopColor: colors.border }]}>
        <Icon name="source-branch" size={14} color={colors.textMuted} />
        <Text style={[styles.sourceText, { color: colors.textMuted }]}>{item.source.label}</Text>
      </View>
    </Card>
  );
}

function Summary({ value, label, color }: { value: number; label: string; color: string }) {
  const { colors } = useStudyBolt();
  return (
    <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 16, fontWeight: '900' },
  heroText: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  summary: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingVertical: 12, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 8, marginTop: 2, textAlign: 'center' },
  modeSwitcher: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4, marginTop: 22 },
  mode: { flex: 1, minHeight: 42, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modeText: { fontSize: 10, fontWeight: '900' },
  modeDescription: { fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 13 },
  list: { gap: 11 },
  groupList: { gap: 25 },
  group: { gap: 11 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  groupEmoji: { fontSize: 21 },
  groupCopy: { flex: 1 },
  groupTitle: { fontSize: 16, fontWeight: '900' },
  groupSubtitle: { fontSize: 10, marginTop: 3 },
  itemCard: { padding: 16 },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  kindBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  kindText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  itemContext: { fontSize: 9, fontWeight: '700', marginTop: 13 },
  itemTitle: { fontSize: 13, fontWeight: '900', marginTop: 5 },
  itemPrompt: { fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 7 },
  answerBlock: { borderRadius: 13, padding: 12, marginTop: 12 },
  answerHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answerLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  answerText: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  explanation: { fontSize: 10, lineHeight: 15, marginTop: 8 },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryAction: { flex: 1, minHeight: 41, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryActionText: { fontSize: 9, fontWeight: '900' },
  openAction: { flex: 1, minHeight: 41, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  openActionText: { fontSize: 9, fontWeight: '900' },
  sourceRow: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  sourceText: { fontSize: 9, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 38, marginTop: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 14 },
  emptyText: { maxWidth: 280, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 5 },
});
