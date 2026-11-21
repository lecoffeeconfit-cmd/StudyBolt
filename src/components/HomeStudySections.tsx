import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import { typography } from '../theme';
import type { StudyPack, StudyTool } from '../models';
import type { HomeRecentMaterial } from '../services/homeDashboard';
import { SubjectIcon } from './SubjectIcon';
import { Icon, type IconName } from './ui';

import type { HomeTool } from '../services/homeTools';

export const HOME_TOOLS = [
  { id: 'flashcards', title: 'Flashcards', detail: 'Recall key ideas', icon: 'cards-outline', tone: 'primary' },
  { id: 'quiz', title: 'Practice quiz', detail: 'Check understanding', icon: 'clipboard-check-outline', tone: 'mint' },
  { id: 'audio', title: 'StudyCast', detail: 'Learn by listening', icon: 'headphones', tone: 'purple' },
  { id: 'coach', title: 'Study Coach', detail: 'Ask about your notes', icon: 'creation', tone: 'gold' },
] as const;

export function ContinueStudying({ recent, resume, onOpenDeck, onOpenLibrary, onHistory }: {
  recent: HomeRecentMaterial[];
  resume: StudyPack | null;
  onOpenDeck: (deck: StudyPack, tool?: StudyTool) => void;
  onOpenLibrary: () => void;
  onHistory?: () => void;
}) {
  const { colors } = useStudyBolt();
  const packs = recent.filter(item => item.deck.id !== resume?.id).slice(0, resume ? 1 : 2);
  if (!resume && !packs.length) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, styles.fill, { color: colors.text }]}>Continue studying</Text>
        <SmallAction label="Library" onPress={onOpenLibrary} icon="chevron-right" />
      </View>
      <View style={styles.recent}>
        {resume ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Resume StudyCast for ${resume.title}`}
            onPress={() => onOpenDeck(resume, 'audio')}
            style={({ pressed }) => [styles.resume, { backgroundColor: pressed ? colors.cardStrong : colors.purpleSoft, borderColor: colors.border }]}>
            <View style={[styles.resumeIcon, { backgroundColor: colors.card }]}><Icon name="headphones" size={25} color={colors.purple} /></View>
            <View style={styles.fill}>
              <Text style={[styles.linkText, { color: colors.purple }]}>Resume StudyCast</Text>
              <Text style={[typography.cardTitle, { color: colors.text }]}>{resume.title}</Text>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>{resume.courseName} · Saved listening position</Text>
            </View>
            <Icon name="play-circle-outline" size={26} color={colors.purple} />
          </Pressable>
        ) : null}
        {packs.length ? (
          <View style={[styles.packList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {packs.map(({ deck, lastStudiedAt }, index) => (
              <Pressable key={deck.id} accessibilityRole="button" accessibilityLabel={`Open Study Pack ${deck.title}`}
                onPress={() => onOpenDeck(deck)}
                style={({ pressed }) => [styles.packRow, index > 0 && styles.divider, { borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : 'transparent' }]}>
                <SubjectIcon subject={deck.courseName} emoji={deck.emoji} size={39} animated={false} />
                <View style={styles.fill}>
                  <Text style={[typography.cardTitle, { color: colors.text }]}>{deck.title}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {deck.courseName} · {lastStudiedAt ? 'Studied' : 'Added'} {new Date(lastStudiedAt ?? deck.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Icon name="chevron-right" size={19} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {onHistory ? <SmallAction onPress={onHistory} icon="history" label="Class history" leading /> : null}
    </View>
  );
}

export function StudyTools({ available, onTool, onPractice, onCram, onOpenFlagged }: {
  available: ReadonlySet<HomeTool>;
  onTool: (id: HomeTool) => void;
  onPractice?: () => void;
  onCram?: () => void;
  onOpenFlagged: () => void;
}) {
  const { colors } = useStudyBolt();
  const { width, fontScale } = useWindowDimensions();
  const [more, setMore] = useState(false);
  const stacked = width < 350 || fontScale >= 1.3;
  const tones = {
    primary: [colors.primary, colors.primarySoft],
    mint: [colors.mint, colors.mintSoft],
    purple: [colors.purple, colors.purpleSoft],
    gold: [colors.goldText, colors.goldSoft],
  };
  const tools = HOME_TOOLS.filter(tool => available.has(tool.id));
  return (
    <View>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[typography.sectionTitle, styles.fill, { color: colors.text }]}>Study tools</Text>
      </View>
      {tools.length ? (
        <View style={styles.grid}>
          {tools.map(({ id, title, detail, icon, tone }) => {
            const [ink, tint] = tones[tone];
            const core = id === 'flashcards' || id === 'quiz';
            return <Pressable key={id} accessibilityRole="button" accessibilityLabel={title}
              onPress={() => onTool(id)} style={({ pressed }) => [
                styles.tool, stacked && styles.full, !core && styles.compactTool,
                { backgroundColor: pressed ? tint : colors.card, borderColor: colors.border },
              ]}>
              <View style={[styles.toolIcon, { backgroundColor: tint }]}><Icon name={icon} size={core ? 23 : 18} color={ink} /></View>
              <View style={styles.fill}>
                <Text style={[styles.toolTitle, { color: colors.text }]}>{title}</Text>
                {core || stacked ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{detail}</Text> : null}
              </View>
            </Pressable>;
          })}
        </View>
      ) : (
        <Text style={[typography.secondary, { color: colors.textSecondary }]}>Tools appear here as they become ready in your Study Packs.</Text>
      )}
      <SmallAction label="More tools" icon={more ? 'chevron-up' : 'chevron-down'} onPress={() => setMore(!more)} expanded={more} />
      {more ? (
        <View style={styles.extraTools}>
          {onPractice ? <SmallAction label="Practice test" icon="clipboard-text-outline" leading onPress={onPractice} /> : null}
          {onCram ? <SmallAction label="Cram review" icon="fire" leading onPress={onCram} /> : null}
          <SmallAction label="Saved items" icon="flag-outline" leading onPress={onOpenFlagged} />
        </View>
      ) : null}
    </View>
  );
}

function SmallAction({ label, icon, onPress, leading, expanded }: {
  label: string; icon: IconName; onPress: () => void; leading?: boolean; expanded?: boolean;
}) {
  const { colors } = useStudyBolt();
  return (
    <Pressable accessibilityRole="button" accessibilityState={expanded === undefined ? undefined : { expanded }} onPress={onPress}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.68 : 1 }]}>
      {leading ? <Icon name={icon} size={17} color={colors.primary} /> : null}
      <Text style={[styles.linkText, { color: colors.primary }]}>{label}</Text>
      {!leading ? <Icon name={icon} size={17} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, minHeight: 42, marginBottom: 6 },
  fill: { flex: 1, minWidth: 0 },
  recent: { gap: 9 },
  resume: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, padding: 12 },
  resumeIcon: { height: 49, width: 49, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  packList: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  packRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 11, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tool: { minHeight: 77, padding: 10, flexGrow: 1, flexBasis: '47%', minWidth: 0, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { flexBasis: '100%' },
  compactTool: { minHeight: 55 },
  toolIcon: { height: 35, width: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 3, gap: 5 },
  linkText: { fontSize: 13, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  extraTools: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14 },
});
