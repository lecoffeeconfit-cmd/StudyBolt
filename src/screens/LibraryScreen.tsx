import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import { StudyPack } from '../models';
import { calculateCourseMastery, calculateMastery } from '../services/mastery';

export function LibraryScreen({ onOpenDeck, onCreateReview }: { onOpenDeck: (deck: StudyPack) => void; onCreateReview: (deckIds: string[]) => void }) {
  const { colors, state } = useStudyBolt();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const courses = useMemo(() => {
    const map = new Map<string, StudyPack[]>();
    state.decks.forEach((deck) => map.set(deck.courseId, [...(map.get(deck.courseId) ?? []), deck]));
    return [...map.entries()];
  }, [state.decks]);

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Screen>
      <Header
        title="Library"
        right={
          <Pressable onPress={() => { setSelecting((value) => !value); setSelected([]); }} style={[styles.selectButton, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.selectText, { color: colors.primary }]}>{selecting ? 'Done' : 'Select'}</Text>
          </Pressable>
        }
      />
      <Text style={[styles.title, { color: colors.text }]}>Your library</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Study Packs stay organized by class and remain available offline.</Text>

      {selecting ? (
        <Card style={[styles.reviewBanner, { backgroundColor: colors.purpleSoft }]}>
          <View style={styles.reviewBannerRow}>
            <Icon name="playlist-check" color={colors.purple} size={25} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.reviewTitle, { color: colors.text }]}>Build an exam review</Text>
              <Text style={[styles.reviewSubtitle, { color: colors.textSecondary }]}>Select two or more decks in chapter order.</Text>
            </View>
            <Pill label={`${selected.length} selected`} tone="purple" />
          </View>
          <PrimaryButton label="Create Exam Review" icon="creation" disabled={selected.length < 2} onPress={() => onCreateReview(selected)} style={styles.reviewButton} />
        </Card>
      ) : null}

      <SectionHeader title="Courses" action={`${courses.length} classes`} />
      <View style={styles.courseList}>
        {courses.map(([courseId, decks]) => {
          const courseName = decks[0]?.courseName ?? 'Course';
          const courseMastery = calculateCourseMastery(decks);
          return (
            <View key={courseId}>
              <View style={styles.courseHeader}>
                <View>
                  <Text style={[styles.courseName, { color: colors.text }]}>{courseName}</Text>
                  <Text style={[styles.courseMeta, { color: colors.textMuted }]}>{decks.length} {decks.length === 1 ? 'deck' : 'decks'} · {courseMastery}% estimated mastery</Text>
                </View>
                <View style={[styles.courseIcon, { backgroundColor: `${decks[0]?.color ?? colors.primary}24` }]}>
                  <Text style={styles.courseEmoji}>{decks[0]?.emoji}</Text>
                </View>
              </View>
              <View style={styles.deckList}>
                {decks.sort((a, b) => a.order - b.order).map((deck, index) => {
                  const isSelected = selected.includes(deck.id);
                  return (
                    <Card key={deck.id} onPress={() => selecting ? toggle(deck.id) : onOpenDeck(deck)} style={[styles.deckCard, isSelected && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                      {selecting ? (
                        <View style={[styles.checkbox, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : colors.card }]}>
                          {isSelected ? <Icon name="check" size={15} color="#FFFFFF" /> : null}
                        </View>
                      ) : (
                        <View style={[styles.orderBadge, { backgroundColor: colors.cardStrong }]}>
                          <Text style={[styles.orderText, { color: colors.textSecondary }]}>{index + 1}</Text>
                        </View>
                      )}
                      <View style={styles.deckCopy}>
                        <Text style={[styles.deckTitle, { color: colors.text }]}>{deck.title}</Text>
                        <Text style={[styles.deckMeta, { color: colors.textMuted }]}>{deck.pageCount} slides · {calculateMastery(deck).overall}% mastered</Text>
                      </View>
                      <Icon name={selecting ? 'checkbox-multiple-marked-outline' : 'chevron-right'} color={isSelected ? colors.primary : colors.textMuted} />
                    </Card>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  selectText: { fontSize: 12, fontWeight: '800' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 4 },
  reviewBanner: { marginTop: 20 },
  reviewBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  reviewTitle: { fontSize: 14, fontWeight: '800' },
  reviewSubtitle: { fontSize: 11, marginTop: 3 },
  reviewButton: { minHeight: 48, marginTop: 14 },
  courseList: { gap: 28 },
  courseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  courseName: { fontSize: 17, fontWeight: '800' },
  courseMeta: { fontSize: 11, marginTop: 3 },
  courseIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  courseEmoji: { fontSize: 20 },
  deckList: { gap: 9 },
  deckCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  orderBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontSize: 12, fontWeight: '900' },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  deckCopy: { flex: 1 },
  deckTitle: { fontSize: 13, fontWeight: '800' },
  deckMeta: { fontSize: 10, marginTop: 4 },
});
