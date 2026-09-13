import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, Screen } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { StudyTool } from '../models';
import { buildMistakeNotebook } from '../services/adaptiveStudy';
import type { MistakeNotebookItem } from '../services/adaptiveStudy';

type NotebookAction = 'review' | 'explain' | 'example';

export function MistakeNotebookScreen({
  onBack,
  onOpenDeck,
}: {
  onBack: () => void;
  onOpenDeck: (deckId: string, tool: StudyTool) => void;
}) {
  const { colors, state } = useStudyBolt();
  const items = useMemo(() => buildMistakeNotebook(state), [state]);
  const [open, setOpen] = useState<{ id: string; action: NotebookAction } | null>(null);
  const dangerous = items.filter((item) => item.confidentlyWrong > 0).length;

  return (
    <Screen>
      <Header title="Mistake Notebook" onBack={onBack} right={<Pill label={`${items.length} to revisit`} tone="purple" />} />
      <View style={[styles.hero, { backgroundColor: colors.purpleSoft }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.card }]}><Icon name="book-alert-outline" size={28} color={colors.purple} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Mistakes worth learning from</Text>
          <Text style={[styles.heroText, { color: colors.textSecondary }]}>Questions appear here after two misses. StudyBolt keeps them in rotation until your recall changes.</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Summary value={items.reduce((sum, item) => sum + item.misses, 0)} label="total misses" color={colors.danger} />
        <Summary value={dangerous} label="confident misses" color={colors.warning} />
        <Summary value={new Set(items.map((item) => item.deckId)).size} label="study packs" color={colors.primary} />
      </View>

      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.heading, { color: colors.text }]}>Needs another look</Text>
          <Text style={[styles.headingHint, { color: colors.textMuted }]}>Most repeated first</Text>
        </View>
        <Pill label="AUTO-COLLECTED" tone="neutral" />
      </View>

      {items.length ? <View style={styles.list}>{items.map((item) => (
        <MistakeCard
          key={item.id}
          item={item}
          activeAction={open?.id === item.id ? open.action : null}
          onAction={(action) => setOpen((current) => current?.id === item.id && current.action === action ? null : { id: item.id, action })}
          onQuiz={() => onOpenDeck(item.deckId, 'quiz')}
        />
      ))}</View> : (
        <Card style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.mintSoft }]}><Icon name="check-all" size={31} color={colors.mint} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing repeated yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Missed questions will collect here automatically after they show a pattern.</Text>
        </Card>
      )}
    </Screen>
  );
}

function MistakeCard({
  item,
  activeAction,
  onAction,
  onQuiz,
}: {
  item: MistakeNotebookItem;
  activeAction: NotebookAction | null;
  onAction: (action: NotebookAction) => void;
  onQuiz: () => void;
}) {
  const { colors } = useStudyBolt();
  const content = activeAction === 'review'
    ? { label: 'CORRECT ANSWER', text: item.answer, icon: 'check-circle-outline' as IconName, color: colors.mint, background: colors.mintSoft }
    : activeAction === 'explain'
      ? { label: 'WHY IT WORKS', text: item.explanation, icon: 'lightbulb-on-outline' as IconName, color: colors.primary, background: colors.primarySoft }
      : activeAction === 'example'
        ? { label: 'CONCRETE EXAMPLE', text: item.example, icon: 'flask-outline' as IconName, color: colors.purple, background: colors.purpleSoft }
        : null;
  return (
    <Card style={[styles.mistakeCard, { borderColor: item.confidentlyWrong ? `${colors.danger}66` : colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.missBadge, { backgroundColor: `${colors.danger}13` }]}>
          <Icon name="refresh" size={15} color={colors.danger} />
          <Text style={[styles.missText, { color: colors.danger }]}>Missed {item.misses} times</Text>
        </View>
        {item.confidentlyWrong ? <Pill label="CONFIDENTLY WRONG" tone="purple" /> : null}
      </View>
      <Text style={[styles.course, { color: colors.textMuted }]}>{item.courseName} · {item.deckTitle} · {item.sourceLabel}</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{item.prompt}</Text>
      <View style={styles.actions}>
        <Action icon="book-open-variant" label="Review" active={activeAction === 'review'} onPress={() => onAction('review')} />
        <Action icon="lightbulb-on-outline" label="Explain" active={activeAction === 'explain'} onPress={() => onAction('explain')} />
        <Action icon="flask-outline" label="Example" active={activeAction === 'example'} onPress={() => onAction('example')} />
      </View>
      {content ? (
        <View style={[styles.detail, { backgroundColor: content.background }]}>
          <View style={styles.detailHeading}><Icon name={content.icon} size={17} color={content.color} /><Text style={[styles.detailLabel, { color: content.color }]}>{content.label}</Text></View>
          <Text style={[styles.detailText, { color: colors.textSecondary }]}>{content.text}</Text>
        </View>
      ) : null}
      <PrimaryButton label="Quiz me" icon="brain" onPress={onQuiz} style={styles.quizButton} />
    </Card>
  );
}

function Action({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable onPress={onPress} style={[styles.action, { backgroundColor: active ? colors.primarySoft : colors.cardStrong, borderColor: active ? colors.primary : colors.border }]}>
      <Icon name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.actionText, { color: active ? colors.primary : colors.textSecondary }]}>{label}</Text>
    </Pressable>
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
  heroTitle: { fontSize: 16, fontWeight: '900' },
  heroText: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  summary: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, paddingVertical: 12, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 8, marginTop: 2, textAlign: 'center' },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 12 },
  heading: { fontSize: 19, fontWeight: '900' },
  headingHint: { fontSize: 9, marginTop: 3 },
  list: { gap: 11 },
  mistakeCard: { padding: 17 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  missBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  missText: { fontSize: 9, fontWeight: '900' },
  course: { fontSize: 8, fontWeight: '700', marginTop: 13 },
  prompt: { fontSize: 16, lineHeight: 22, fontWeight: '800', marginTop: 6 },
  actions: { flexDirection: 'row', gap: 7, marginTop: 15 },
  action: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionText: { fontSize: 8, fontWeight: '800' },
  detail: { borderRadius: 13, padding: 12, marginTop: 10 },
  detailHeading: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  detailLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  detailText: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  quizButton: { minHeight: 47, marginTop: 11 },
  empty: { alignItems: 'center', paddingVertical: 38 },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '900', marginTop: 14 },
  emptyText: { fontSize: 11, lineHeight: 16, textAlign: 'center', maxWidth: 270, marginTop: 5 },
});
