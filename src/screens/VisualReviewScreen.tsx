import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { Card, Header, Icon, Pill, PrimaryButton, Screen } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { AiVisualAnalysis, AiVisualAnalysisRequest, NoteBlock, StudyPack, VisualKnowledge } from '../models';
import { analyzeVisualWithAi } from '../services/aiTutor';

function pendingVisuals(deck: StudyPack, includeSkipped: boolean): VisualKnowledge[] {
  return (deck.visuals ?? []).filter((visual) => visual.needsUserReview && (includeSkipped
    ? visual.status !== 'resolved_ai'
    : visual.status === 'needs_review' || visual.status === 'analysis_failed' || visual.status === 'allowance_unavailable'));
}

export function VisualReviewScreen({ deckId, onBack }: { deckId: string; onBack: () => void }) {
  const { colors, state, updateDeck } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const deck = state.decks.find((item) => item.id === deckId);
  const visuals = useMemo(() => deck ? pendingVisuals(deck, includeSkipped) : [], [deck, includeSkipped]);

  if (!deck) {
    return <Screen><Text style={{ color: colors.text }}>Study Pack not found.</Text></Screen>;
  }

  const updateVisual = (visualId: string, updater: (visual: VisualKnowledge) => VisualKnowledge) => {
    updateDeck(deck.id, (current) => ({ ...current, visuals: (current.visuals ?? []).map((visual) => visual.id === visualId ? updater(visual) : visual) }));
  };

  const saveAnalysis = (visual: VisualKnowledge, analysis: AiVisualAnalysis) => {
    updateDeck(deck.id, (current) => {
      const nextVisual: VisualKnowledge = {
        ...visual,
        description: analysis.description,
        extractedText: analysis.extractedText.join('\n'),
        labels: analysis.labels,
        concepts: analysis.concepts,
        relationships: analysis.relationships,
        studyRelevance: analysis.studyRelevance,
        visualType: analysis.visualType,
        localConfidence: analysis.confidence,
        status: 'resolved_ai',
        needsUserReview: false,
        analysisSource: 'ai_economy',
        analyzedAt: new Date().toISOString(),
        aiError: undefined,
      };
      return {
        ...current,
        visuals: (current.visuals ?? []).map((item) => item.id === visual.id ? nextVisual : item),
        notes: enrichNotes(current.notes, visual, analysis, false),
        detailedNotes: enrichNotes(current.detailedNotes, visual, analysis, true),
      };
    });
  };

  const skip = (visualId: string) => updateVisual(visualId, (visual) => ({ ...visual, status: 'skipped_by_user' }));

  const analyze = async (visual: VisualKnowledge) => {
    if (!visual.imageDataUrl || !visual.documentId) {
      updateVisual(visual.id, (current) => ({ ...current, status: 'analysis_failed', aiError: 'This visual preview is unavailable. You can still use the surrounding study material.' }));
      return;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      updateVisual(visual.id, (current) => ({ ...current, status: 'allowance_unavailable', aiError: 'Sign in to use optional visual AI analysis.' }));
      return;
    }
    setBusyId(visual.id);
    updateVisual(visual.id, (current) => ({ ...current, status: 'analyzing_ai', aiError: undefined }));
    const request: AiVisualAnalysisRequest = {
      documentId: visual.documentId,
      visualId: visual.id,
      imageDataUrl: visual.imageDataUrl,
      slideNumber: visual.slideNumber,
      slideTitle: visual.slideTitle,
      slideText: visual.nearbyText,
      accessibilityDescription: visual.accessibilityText,
      ocrText: visual.extractedText,
      subject: deck.courseName,
    };
    const result = await analyzeVisualWithAi(request, accessToken);
    if (result.analysis) {
      saveAnalysis(visual, result.analysis);
    } else {
      updateVisual(visual.id, (current) => ({ ...current, status: result.code === 'monthly_limit' || result.code === 'cloud_budget' ? 'allowance_unavailable' : 'analysis_failed', aiError: result.error }));
    }
    setBusyId(null);
  };

  const analyzeAll = () => {
    const selectable = visuals.filter((visual) => visual.status !== 'skipped_by_user');
    if (!selectable.length) return;
    Alert.alert('Analyze visuals with AI?', `This will use your existing StudyBolt AI allowance for up to ${selectable.length} visual${selectable.length === 1 ? '' : 's'}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Analyze ${selectable.length}`, onPress: () => {
        setBatchBusy(true);
        void (async () => {
          for (const visual of selectable) await analyze(visual);
          setBatchBusy(false);
        })();
      } },
    ]);
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 5 }]}>
      <View style={styles.horizontalPadding}>
        <Header title="Visuals to review" subtitle={deck.title} onBack={onBack} right={<Pill label="OPTIONAL AI" tone="purple" />} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, { backgroundColor: colors.primarySoft }]}>
          <Icon name="image-search-outline" color={colors.primary} size={24} />
          <View style={styles.introCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Study material is ready</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>StudyBolt understood most of your presentation. These visuals may contain additional study information.</Text>
          </View>
        </View>
        <View style={styles.actionsRow}>
          <Text style={[styles.count, { color: colors.text }]}>{visuals.length} visual{visuals.length === 1 ? '' : 's'} remaining</Text>
          {visuals.length > 1 ? <PrimaryButton label={batchBusy ? 'Analyzing…' : 'Analyze all'} icon="creation" onPress={analyzeAll} disabled={batchBusy} style={styles.batchButton} /> : null}
        </View>
        {visuals.map((visual) => {
          const busy = busyId === visual.id;
          return (
            <Card key={visual.id} style={styles.visualCard}>
              {visual.imageDataUrl ? <View style={[styles.imageFrame, { backgroundColor: colors.cardStrong }]}><Image source={{ uri: visual.imageDataUrl }} accessibilityLabel="Visual preview" resizeMode="contain" style={styles.webImage} /></View> : <View style={[styles.imageFrame, styles.noImage, { backgroundColor: colors.cardStrong }]}><Icon name="image-off-outline" size={30} color={colors.textMuted} /><Text style={[styles.noImageText, { color: colors.textMuted }]}>Preview unavailable</Text></View>}
              <View style={styles.visualCopy}>
                <View style={styles.visualTop}><Pill label={`SLIDE ${visual.slideNumber}`} tone="blue" /><Text style={[styles.visualType, { color: colors.textMuted }]}>{visual.visualType.replace(/_/g, ' ')}</Text></View>
                <Text style={[styles.visualTitle, { color: colors.text }]}>{visual.slideTitle || 'Untitled slide'}</Text>
                <Text style={[styles.visualReason, { color: colors.textSecondary }]}>{visual.aiError ?? reasonText(visual)}</Text>
                {visual.description ? <Text numberOfLines={4} style={[styles.interpretation, { color: colors.textSecondary }]}>{visual.description}</Text> : null}
                <View style={styles.visualActions}>
                  <PrimaryButton label={busy ? 'Analyzing…' : 'Analyze with AI'} icon="creation" onPress={() => void analyze(visual)} disabled={busy || batchBusy || !visual.imageDataUrl} style={styles.analyzeButton} />
                  <Pressable onPress={() => skip(visual.id)} disabled={busy || batchBusy} style={[styles.skipButton, { borderColor: colors.border }]}><Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text></Pressable>
                </View>
              </View>
            </Card>
          );
        })}
        {visuals.length === 0 ? <Card style={styles.doneCard}><Icon name="check-circle-outline" size={38} color={colors.mint} /><Text style={[styles.doneTitle, { color: colors.text }]}>Nothing else needs review</Text><Text style={[styles.doneText, { color: colors.textSecondary }]}>Your study material is ready. You can return to it anytime.</Text></Card> : null}
        <Pressable onPress={() => setIncludeSkipped((current) => !current)} style={styles.laterButton}><Text style={[styles.laterText, { color: colors.primary }]}>{includeSkipped ? 'Hide skipped visuals' : 'Review skipped visuals later'}</Text></Pressable>
        <PrimaryButton label="Back to Study Pack" icon="arrow-left" onPress={onBack} style={styles.backButton} />
      </ScrollView>
    </View>
  );
}

function enrichNotes(notes: NoteBlock[], visual: VisualKnowledge, analysis: AiVisualAnalysis, detailed: boolean): NoteBlock[] {
  const titleWords = visual.slideTitle.toLowerCase().split(/\s+/).filter((word) => word.length >= 5).slice(0, 4);
  if (!titleWords.length) return notes;
  return notes.map((note) => {
    const noteText = `${note.title} ${note.source.label}`.toLowerCase();
    if (!titleWords.some((word) => noteText.includes(word))) return note;
    const heading = `Visual insight · slide ${visual.slideNumber}`;
    if (note.sections?.some((section) => section.heading === heading)) return note;
    const points = [analysis.description, analysis.studyRelevance, ...analysis.relationships.slice(0, 2)].filter(Boolean);
    if (!points.length) return note;
    const nextSection = { heading, points };
    return {
      ...note,
      ...(detailed ? { sections: [...(note.sections ?? []), nextSection] } : { bullets: [...note.bullets, analysis.description] }),
    };
  });
}

function reasonText(visual: VisualKnowledge): string {
  if (visual.reason === 'microscopy_detail') return 'The image may contain details that are hard to capture from surrounding text.';
  if (visual.reason === 'complex_graph') return 'The graphic may contain relationships or labels beyond the extracted text.';
  if (visual.reason === 'unreadable_labels') return 'Some labels may need a closer look.';
  return 'StudyBolt understood the surrounding lecture material but may be missing details contained in this image.';
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  horizontalPadding: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 10, paddingBottom: 34, gap: 14 },
  intro: { borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12 },
  introCopy: { flex: 1, gap: 5 },
  title: { fontSize: 20, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  count: { fontSize: 14, fontWeight: '800', flex: 1 },
  batchButton: { minHeight: 42, paddingHorizontal: 14 },
  visualCard: { padding: 12, gap: 13 },
  imageFrame: { width: '100%', minHeight: 150, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  webImage: { width: '100%', height: 210 },
  noImage: { gap: 7 },
  noImageText: { fontSize: 12, fontWeight: '700' },
  visualCopy: { gap: 9 },
  visualTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  visualType: { fontSize: 11, textTransform: 'capitalize' },
  visualTitle: { fontSize: 17, fontWeight: '900' },
  visualReason: { fontSize: 13, lineHeight: 18 },
  interpretation: { fontSize: 12, lineHeight: 17 },
  visualActions: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  analyzeButton: { flex: 1, minHeight: 44 },
  skipButton: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  skipText: { fontSize: 13, fontWeight: '800' },
  doneCard: { padding: 28, alignItems: 'center', gap: 9 },
  doneTitle: { fontSize: 18, fontWeight: '900' },
  doneText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  laterButton: { alignItems: 'center', paddingVertical: 7 },
  laterText: { fontSize: 13, fontWeight: '800' },
  backButton: { minHeight: 48 },
});
