import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../AuthContext';
import { Card, Header, Icon, Pill, PrimaryButton, Screen } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';
import type { AiVisualAnalysis, AiVisualAnalysisRequest, NoteBlock, StudyPack, VisualKnowledge } from '../models';
import { analyzeVisualWithAi, createVisualCardSuggestion } from '../services/aiTutor';
import { immediateVisualImageUri, resolveStoredVisualImageUri, usefulVisuals } from '../services/visuals';

export function VisualReviewScreen({ deckId, onBack }: { deckId: string; onBack: () => void }) {
  const { colors, state, updateDeck } = useStudyBolt();
  const { getAccessToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [previewVisual, setPreviewVisual] = useState<VisualKnowledge | null>(null);
  const [cardVisual, setCardVisual] = useState<VisualKnowledge | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [concept, setConcept] = useState('');
  const deck = state.decks.find((item) => item.id === deckId);
  const visuals = useMemo(() => usefulVisuals(deck?.visuals), [deck?.visuals]);
  const reviewVisuals = visuals.filter((visual) => visual.needsUserReview && visual.status !== 'resolved_ai' && visual.status !== 'skipped_by_user');

  if (!deck) {
    return <Screen><Text style={{ color: colors.text }}>Study Pack not found.</Text></Screen>;
  }

  const updateVisual = (visualId: string, updater: (visual: VisualKnowledge) => VisualKnowledge) => {
    updateDeck(deck.id, (current) => ({
      ...current,
      visuals: (current.visuals ?? []).map((visual) => visual.id === visualId ? updater(visual) : visual),
    }));
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

  const requestFor = (visual: VisualKnowledge): AiVisualAnalysisRequest => ({
    documentId: visual.documentId ?? '',
    visualId: visual.id,
    imageDataUrl: visual.imageDataUrl,
    slideNumber: visual.slideNumber,
    slideTitle: visual.slideTitle || `Slide ${visual.slideNumber}`,
    slideText: visual.nearbyText,
    accessibilityDescription: visual.accessibilityText,
    ocrText: visual.extractedText,
    subject: deck.courseName,
  });

  const analyze = async (visual: VisualKnowledge): Promise<boolean> => {
    if ((!visual.imageDataUrl && !visual.imagePath) || !visual.documentId) {
      updateVisual(visual.id, (current) => ({ ...current, status: 'analysis_failed', aiError: 'This visual preview is unavailable. The rest of your Study Pack is unaffected.' }));
      return false;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      updateVisual(visual.id, (current) => ({ ...current, status: 'allowance_unavailable', aiError: 'Sign in to use optional visual AI analysis.' }));
      return false;
    }
    setBusyId(visual.id);
    updateVisual(visual.id, (current) => ({ ...current, status: 'analyzing_ai', aiError: undefined }));
    const result = await analyzeVisualWithAi(requestFor(visual), accessToken);
    if (result.analysis) saveAnalysis(visual, result.analysis);
    else updateVisual(visual.id, (current) => ({
      ...current,
      status: result.code === 'monthly_limit' || result.code === 'cloud_budget' ? 'allowance_unavailable' : 'analysis_failed',
      aiError: result.error,
    }));
    setBusyId(null);
    return Boolean(!result.analysis && (result.code === 'monthly_limit' || result.code === 'cloud_budget'));
  };

  const analyzeAll = () => {
    if (!reviewVisuals.length) return;
    Alert.alert('Analyze visuals with AI?', `This will use your existing StudyBolt AI allowance for up to ${reviewVisuals.length} visual${reviewVisuals.length === 1 ? '' : 's'}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Analyze ${reviewVisuals.length}`, onPress: () => {
        setBatchBusy(true);
        void (async () => {
          try {
            for (const visual of reviewVisuals) {
              const allowanceStopped = await analyze(visual);
              if (allowanceStopped) break;
            }
          } finally {
            setBatchBusy(false);
          }
        })();
      } },
    ]);
  };

  const skipAnalysis = (visualId: string) => updateVisual(visualId, (visual) => ({ ...visual, status: 'skipped_by_user', aiError: undefined }));

  const suggestCard = async (visual: VisualKnowledge) => {
    setCardVisual(visual);
    setCardBusy(true);
    setCardError(null);
    setQuestion('');
    setAnswer('');
    setConcept('');
    if ((!visual.imageDataUrl && !visual.imagePath) || !visual.documentId) {
      setCardBusy(false);
      setCardError('This visual does not have a saved image preview, so StudyBolt cannot make a grounded card from it.');
      return;
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setCardBusy(false);
      setCardError('Sign in to create an AI-assisted visual flashcard.');
      return;
    }
    const result = await createVisualCardSuggestion(requestFor(visual), accessToken);
    setCardBusy(false);
    if (!result.suggestion) {
      setCardError(result.error ?? 'StudyBolt could not suggest a visual card right now.');
      return;
    }
    if (result.suggestion.confidence < 0.6) {
      setCardError('This image and its slide text do not support a reliable flashcard suggestion. Try another visual.');
      return;
    }
    setQuestion(result.suggestion.question);
    setAnswer(result.suggestion.answer);
    setConcept(result.suggestion.concept);
  };

  const addCard = () => {
    if (!cardVisual || !question.trim() || !answer.trim()) return;
    const source = sourceForSlide(deck, cardVisual.slideNumber);
    updateDeck(deck.id, (current) => ({
      ...current,
      flashcards: [...current.flashcards, {
        id: `visual-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        front: question.trim(),
        back: answer.trim(),
        explanation: concept.trim() ? `Visual concept: ${concept.trim()}` : undefined,
        confidence: 'new',
        source,
        imageUrl: immediateVisualImageUri(cardVisual),
        imagePath: cardVisual.imagePath,
        sourceSlide: cardVisual.slideNumber,
        visualId: cardVisual.id,
      }],
    }));
    setCardVisual(null);
    Alert.alert('Visual card added', 'The new card is ready in this Study Pack’s Flashcards.');
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: insets.top + 5 }]}>
      <View style={styles.horizontalPadding}>
        <Header title="Visuals" subtitle={deck.title} onBack={onBack} right={<Pill label={`${visuals.length} SAVED`} tone="purple" />} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.intro, { backgroundColor: colors.primarySoft }]}>
          <Icon name="image-multiple-outline" color={colors.primary} size={24} />
          <View style={styles.introCopy}>
            <Text style={[styles.title, { color: colors.text }]}>Saved from your slides</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>Useful diagrams, charts, and images stay connected to the slide they came from.</Text>
          </View>
        </View>
        {reviewVisuals.length > 0 ? (
          <View style={[styles.reviewHint, { backgroundColor: colors.purpleSoft }]}>
            <Icon name="creation" size={18} color={colors.purple} />
            <Text style={[styles.reviewHintText, { color: colors.textSecondary }]}>{reviewVisuals.length} visual{reviewVisuals.length === 1 ? '' : 's'} can optionally be analyzed for extra detail. Analysis only runs when you choose it.</Text>
            {reviewVisuals.length > 1 ? <Pressable accessibilityRole="button" disabled={batchBusy} onPress={analyzeAll} style={styles.batchAction}><Text style={[styles.batchActionText, { color: colors.purple }]}>{batchBusy ? 'Analyzing…' : 'Analyze all'}</Text></Pressable> : null}
          </View>
        ) : null}
        {visuals.map((visual) => {
          const busy = busyId === visual.id;
          const canAnalyze = Boolean((visual.imageDataUrl || visual.imagePath) && visual.documentId);
          const needsAnalysis = visual.needsUserReview && visual.status !== 'resolved_ai';
          return (
            <Card key={visual.id} style={styles.visualCard}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Open visual from slide ${visual.slideNumber}`} onPress={() => setPreviewVisual(visual)}>
                <VisualImage visual={visual} height={210} />
              </Pressable>
              <View style={styles.visualCopy}>
                <View style={styles.visualTop}>
                  <Pill label={`SLIDE ${visual.slideNumber}`} tone="blue" />
                  <Text style={[styles.visualType, { color: colors.textMuted }]}>{visual.visualType.replace(/_/g, ' ')}</Text>
                </View>
                <Text style={[styles.visualTitle, { color: colors.text }]}>{visual.slideTitle || visual.concepts?.[0] || `Slide ${visual.slideNumber} visual`}</Text>
                {needsAnalysis ? <Text style={[styles.reviewReason, { color: colors.textSecondary }]}>{visual.aiError ?? reasonText(visual)}</Text> : null}
                {visual.description || visual.altText ? <Text numberOfLines={3} style={[styles.interpretation, { color: colors.textSecondary }]}>{visual.description || visual.altText}</Text> : null}
                {visual.aiError ? <Text style={[styles.errorText, { color: colors.danger }]}>{visual.aiError}</Text> : null}
                <View style={styles.visualActions}>
                  <PrimaryButton label="Make flashcard" icon="cards-outline" onPress={() => void suggestCard(visual)} disabled={!canAnalyze} style={styles.cardButton} />
                  {needsAnalysis ? (
                    <>
                      <Pressable accessibilityRole="button" disabled={busy || batchBusy || !canAnalyze} onPress={() => void analyze(visual)} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: !canAnalyze ? 0.45 : pressed ? 0.72 : 1 }]}>
                        {busy ? <ActivityIndicator size="small" color={colors.purple} /> : <Icon name="creation" size={16} color={colors.purple} />}
                        <Text style={[styles.secondaryButtonText, { color: colors.purple }]}>{busy ? 'Analyzing…' : visual.status === 'skipped_by_user' ? 'Analyze later' : 'Analyze'}</Text>
                      </Pressable>
                      {visual.status !== 'skipped_by_user' ? <Pressable accessibilityRole="button" disabled={busy || batchBusy} onPress={() => skipAnalysis(visual.id)} style={({ pressed }) => [styles.skipButton, { opacity: pressed ? 0.65 : 1 }]}><Text style={[styles.skipButtonText, { color: colors.textMuted }]}>Skip</Text></Pressable> : null}
                    </>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
        {visuals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name="image-off-outline" size={38} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No study visuals found</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>This presentation did not contain useful diagrams or images. Your other study materials are still available.</Text>
          </Card>
        ) : null}
        <PrimaryButton label="Back to Study Pack" icon="arrow-left" onPress={onBack} style={styles.backButton} />
      </ScrollView>

      <Modal visible={Boolean(previewVisual)} transparent animationType="fade" onRequestClose={() => setPreviewVisual(null)}>
        <View style={styles.previewRoot}>
          <Pressable accessibilityLabel="Close visual preview" style={StyleSheet.absoluteFill} onPress={() => setPreviewVisual(null)} />
          <View style={[styles.previewSheet, { backgroundColor: colors.backgroundRaised, borderColor: colors.border }]}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}><Text style={[styles.previewTitle, { color: colors.text }]}>{previewVisual?.slideTitle || 'Visual preview'}</Text><Text style={[styles.previewMeta, { color: colors.textMuted }]}>Source: Slide {previewVisual?.slideNumber}</Text></View>
              <Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => setPreviewVisual(null)}><Icon name="close" color={colors.textMuted} /></Pressable>
            </View>
            {previewVisual ? <VisualImage visual={previewVisual} height={420} /> : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(cardVisual)} transparent animationType="slide" onRequestClose={() => setCardVisual(null)}>
        <View style={styles.cardModalRoot}>
          <Pressable accessibilityLabel="Close visual card editor" style={StyleSheet.absoluteFill} onPress={() => setCardVisual(null)} />
          <View style={[styles.cardSheet, { backgroundColor: colors.backgroundRaised, borderColor: colors.border }]}>
            <View style={styles.previewHeader}>
              <View style={{ flex: 1 }}><Text style={[styles.previewTitle, { color: colors.text }]}>Create visual card</Text><Text style={[styles.previewMeta, { color: colors.textMuted }]}>Review and edit before adding</Text></View>
              <Pressable accessibilityLabel="Close" hitSlop={10} onPress={() => setCardVisual(null)}><Icon name="close" color={colors.textMuted} /></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {cardVisual ? <VisualImage visual={cardVisual} height={170} /> : null}
              {cardBusy ? <View style={styles.suggestionLoading}><ActivityIndicator color={colors.primary} /><Text style={[styles.suggestionText, { color: colors.textSecondary }]}>Creating a source-grounded suggestion…</Text></View> : null}
              {cardError ? <View style={[styles.cardError, { backgroundColor: `${colors.danger}12` }]}><Icon name="alert-circle-outline" color={colors.danger} size={18} /><Text style={[styles.cardErrorText, { color: colors.danger }]}>{cardError}</Text></View> : null}
              {!cardBusy && question ? (
                <>
                  <EditorField label="QUESTION" value={question} onChangeText={setQuestion} colors={colors} />
                  <EditorField label="ANSWER" value={answer} onChangeText={setAnswer} colors={colors} />
                  <EditorField label="CONCEPT" value={concept} onChangeText={setConcept} colors={colors} singleLine />
                  <PrimaryButton label="Add to flashcards" icon="plus" onPress={addCard} disabled={!question.trim() || !answer.trim()} style={styles.addCardButton} />
                  <Pressable onPress={() => setCardVisual(null)} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></Pressable>
                </>
              ) : null}
              {!cardBusy && cardError ? <Pressable onPress={() => setCardVisual(null)} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text></Pressable> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function VisualImage({ visual, height }: { visual: VisualKnowledge; height: number }) {
  const { colors } = useStudyBolt();
  const fallback = immediateVisualImageUri(visual);
  const [uri, setUri] = useState(fallback);
  useEffect(() => {
    let mounted = true;
    setUri(fallback);
    void resolveStoredVisualImageUri(visual.imagePath, fallback).then((resolved) => {
      if (mounted && resolved) setUri(resolved);
    });
    return () => { mounted = false; };
  }, [fallback, visual.imagePath]);
  if (!uri) {
    return <View style={[styles.imageFrame, styles.noImage, { height, backgroundColor: colors.cardStrong }]}><Icon name="chart-box-outline" size={34} color={colors.textMuted} /><Text style={[styles.noImageText, { color: colors.textMuted }]}>Structured visual from slide {visual.slideNumber}</Text></View>;
  }
  return <View style={[styles.imageFrame, { height, backgroundColor: colors.cardStrong }]}><Image source={{ uri }} accessibilityLabel={`Visual from slide ${visual.slideNumber}`} resizeMode="contain" onError={() => setUri(undefined)} style={styles.image} /></View>;
}

function EditorField({ label, value, onChangeText, colors, singleLine = false }: { label: string; value: string; onChangeText: (value: string) => void; colors: ReturnType<typeof useStudyBolt>['colors']; singleLine?: boolean }) {
  return <View style={styles.editorField}><Text style={[styles.editorLabel, { color: colors.textMuted }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={!singleLine} placeholderTextColor={colors.textMuted} style={[styles.editorInput, !singleLine && styles.editorInputMultiline, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} /></View>;
}

function sourceForSlide(deck: StudyPack, slideNumber: number) {
  const section = deck.outline.find((item) => rangeIncludesSlide(item.range, slideNumber)) ?? deck.outline[0];
  return { sectionId: section?.id ?? 'visuals', label: `Slide ${slideNumber}` };
}

function rangeIncludesSlide(value: string, slideNumber: number): boolean {
  const numbers = [...value.matchAll(/\d+/g)].map((match) => Number(match[0])).filter(Number.isFinite);
  if (numbers.length === 1) return numbers[0] === slideNumber;
  if (numbers.length >= 2) return slideNumber >= Math.min(numbers[0]!, numbers[1]!) && slideNumber <= Math.max(numbers[0]!, numbers[1]!);
  return false;
}

function reasonText(visual: VisualKnowledge): string {
  if (visual.reason === 'microscopy_detail') return 'The image may contain details that are hard to capture from surrounding text.';
  if (visual.reason === 'complex_graph') return 'The graphic may contain relationships or labels beyond the extracted text.';
  if (visual.reason === 'unreadable_labels') return 'Some labels may need a closer look.';
  return 'StudyBolt understood the surrounding lecture material but may be missing details contained in this image.';
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

const styles = StyleSheet.create({
  page: { flex: 1 },
  horizontalPadding: { paddingHorizontal: 20 },
  content: { padding: 20, paddingTop: 10, paddingBottom: 42, gap: 14 },
  intro: { borderRadius: 18, padding: 16, flexDirection: 'row', gap: 12 },
  introCopy: { flex: 1, gap: 5 },
  title: { fontSize: 20, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19 },
  reviewHint: { borderRadius: 14, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  reviewHintText: { flex: 1, fontSize: 11, lineHeight: 16 },
  batchAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 5 },
  batchActionText: { fontSize: 11, fontWeight: '900' },
  visualCard: { padding: 12, gap: 13 },
  imageFrame: { width: '100%', borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  noImage: { gap: 7, paddingHorizontal: 20 },
  noImageText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  visualCopy: { gap: 9 },
  visualTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  visualType: { fontSize: 11, textTransform: 'capitalize' },
  visualTitle: { fontSize: 17, fontWeight: '900' },
  reviewReason: { fontSize: 12, lineHeight: 17 },
  interpretation: { fontSize: 12, lineHeight: 17 },
  errorText: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  visualActions: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  cardButton: { flex: 1, minHeight: 44 },
  secondaryButton: { minHeight: 44, paddingHorizontal: 13, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 12, fontWeight: '800' },
  skipButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  skipButtonText: { fontSize: 12, fontWeight: '800' },
  emptyCard: { padding: 28, alignItems: 'center', gap: 9 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  previewRoot: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(13,18,38,0.65)' },
  previewSheet: { width: '100%', maxWidth: 620, alignSelf: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 14 },
  previewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  previewTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  previewMeta: { fontSize: 11, marginTop: 3 },
  cardModalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(13,18,38,0.45)' },
  cardSheet: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingTop: 16 },
  suggestionLoading: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 10 },
  suggestionText: { fontSize: 12 },
  cardError: { borderRadius: 14, padding: 12, marginTop: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardErrorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  editorField: { marginTop: 13 },
  editorLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6 },
  editorInput: { minHeight: 47, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12 },
  editorInputMultiline: { minHeight: 82, textAlignVertical: 'top' },
  addCardButton: { marginTop: 18 },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  cancelText: { fontSize: 13, fontWeight: '800' },
  backButton: { minHeight: 48, marginTop: 2 },
});
