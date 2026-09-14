import type { Voice } from 'expo-speech';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AiTutorAction, AiTutorQuota, AiTutorResponse } from '../models';
import { useStudyBolt } from '../StudyBoltContext';
import { radius } from '../theme';
import { Icon, Pill, PrimaryButton } from './ui';
import type { IconName } from './ui';

function SheetFrame({
  visible,
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  icon: IconName;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.34)' }]}>
        <Pressable accessibilityLabel={`Close ${title}`} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.headingRow}>
            <View style={[styles.headingIcon, { backgroundColor: colors.primarySoft }]}><Icon name={icon} size={22} color={colors.primary} /></View>
            <View style={styles.headingCopy}><Text style={[styles.title, { color: colors.text }]}>{title}</Text><Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text></View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SpeedPickerSheet({ visible, rates, selected, onSelect, onClose }: { visible: boolean; rates: number[]; selected: number; onSelect: (rate: number) => void; onClose: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <SheetFrame visible={visible} title="Playback speed" subtitle="Choose the pace that feels comfortable" icon="speedometer" onClose={onClose}>
      <View style={styles.rateGrid}>
        {rates.map((rate) => {
          const active = rate === selected;
          const label = `${Number.isInteger(rate) ? rate.toFixed(1) : rate.toString()}×`;
          return (
            <Pressable
              key={rate}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onSelect(rate)}
              style={[styles.rateOption, { backgroundColor: active ? colors.primarySoft : colors.cardStrong, borderColor: active ? colors.primary : colors.border }]}
            >
              <Text style={[styles.rateText, { color: active ? colors.primary : colors.text }]}>{label}</Text>
              {active ? <Icon name="check-circle" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SheetFrame>
  );
}

export function VoicePickerSheet({ visible, voices, selectedIdentifier, onSelect, onPreview, onClose }: { visible: boolean; voices: Voice[]; selectedIdentifier?: string; onSelect: (voice?: Voice) => void; onPreview: (voice?: Voice) => void; onClose: () => void }) {
  const { colors } = useStudyBolt();
  const options: Array<Voice | undefined> = [undefined, ...voices];
  return (
    <SheetFrame visible={visible} title="Voice" subtitle="Device voices work without AI" icon="account-voice" onClose={onClose}>
      <ScrollView style={styles.voiceList} contentContainerStyle={styles.voiceListContent} showsVerticalScrollIndicator={false}>
        {options.map((voice, index) => {
          const active = voice ? voice.identifier === selectedIdentifier : !selectedIdentifier;
          const key = voice?.identifier ?? 'device-default';
          return (
            <View key={key} style={[styles.voiceRow, index < options.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => onSelect(voice)} style={styles.voiceSelect}>
                <View style={[styles.radio, { borderColor: active ? colors.mint : colors.border }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.mint }]} /> : null}</View>
                <View style={styles.voiceCopy}><Text numberOfLines={1} style={[styles.voiceName, { color: colors.text }]}>{voice?.name ?? 'Device default'}</Text><Text style={[styles.voiceLanguage, { color: colors.textMuted }]}>{voice ? voice.language : 'Uses your system preference'}</Text></View>
              </Pressable>
              <Pressable accessibilityLabel={`Preview ${voice?.name ?? 'device default voice'}`} onPress={() => onPreview(voice)} hitSlop={6} style={[styles.previewButton, { backgroundColor: colors.mintSoft }]}><Icon name="play" size={17} color={colors.mint} /></Pressable>
            </View>
          );
        })}
      </ScrollView>
    </SheetFrame>
  );
}

const SHORTCUTS: Array<{ id: Exclude<AiTutorAction, 'ask'>; label: string; icon: IconName }> = [
  { id: 'explain', label: 'Explain this', icon: 'lightbulb-on-outline' },
  { id: 'teach', label: 'Teach me', icon: 'school-outline' },
  { id: 'quick-answer', label: 'Quick answer', icon: 'flash-outline' },
  { id: 'deep-dive', label: 'Deep dive', icon: 'arrow-expand-down' },
  { id: 'socratic', label: 'Socratic guide', icon: 'head-question-outline' },
  { id: 'simplify', label: 'Simplify', icon: 'creation' },
  { id: 'example', label: 'Give an example', icon: 'flask-outline' },
  { id: 'quiz', label: 'Quiz me', icon: 'brain' },
];

export function AskStudyBoltSheet({
  visible,
  sectionTitle,
  signedIn,
  configured,
  quota,
  loading,
  error,
  response,
  provider,
  providerDetail,
  onAsk,
  onRetry,
  onSpeak,
  onResume,
  onRequireAuth,
  onClose,
  onQuizAnswered,
  initialQuestion,
}: {
  visible: boolean;
  sectionTitle: string;
  signedIn: boolean;
  configured: boolean;
  quota?: AiTutorQuota;
  loading: boolean;
  error?: string;
  response?: AiTutorResponse;
  provider: 'on-device' | 'cloud' | 'checking';
  providerDetail: string;
  onAsk: (action: AiTutorAction, question?: string) => void;
  onRetry: () => void;
  onSpeak: (text: string) => void;
  onResume: () => void;
  onRequireAuth?: () => void;
  onClose: () => void;
  onQuizAnswered: (correct: boolean) => void;
  initialQuestion?: string;
}) {
  const { colors } = useStudyBolt();
  const [question, setQuestion] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuestion('');
      setSelectedOption(null);
    } else if (initialQuestion) {
      setQuestion(initialQuestion);
    }
  }, [initialQuestion, visible]);

  useEffect(() => setSelectedOption(null), [response?.quiz?.question]);

  const submitQuestion = () => {
    const next = question.trim();
    if (!next || loading) return;
    onAsk('ask', next);
  };

  const chooseOption = (index: number) => {
    if (selectedOption !== null || !response?.quiz) return;
    setSelectedOption(index);
    onQuizAnswered(index === response.quiz.correctIndex);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.34)' }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Close Ask StudyBolt" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.askSheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.headingRow}>
            <View style={[styles.askIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="creation" size={24} color={colors.purple} /></View>
            <View style={styles.headingCopy}><Text style={[styles.title, { color: colors.text }]}>Ask StudyBolt</Text><Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>Paused at: {sectionTitle}</Text></View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <ScrollView style={styles.askScroll} contentContainerStyle={styles.askContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.providerRow, { backgroundColor: provider === 'on-device' ? colors.mintSoft : colors.primarySoft }]}>
              <Icon name={provider === 'on-device' ? 'cellphone-lock' : provider === 'checking' ? 'cellphone-cog' : 'cloud-lock-outline'} size={19} color={provider === 'on-device' ? colors.mint : colors.primary} />
              <View style={styles.providerCopy}>
                <Text style={[styles.providerTitle, { color: provider === 'on-device' ? colors.mint : colors.primary }]}>{provider === 'on-device' ? 'ON-DEVICE · PRIVATE' : provider === 'checking' ? 'CHECKING PHONE AI' : 'SECURE CLOUD'}</Text>
                <Text style={[styles.providerDetail, { color: colors.textSecondary }]}>{providerDetail}</Text>
              </View>
            </View>
            {provider === 'cloud' && quota ? <View style={styles.quotaRow}><Pill label={`${quota.remaining} StudyBolt AI interactions remaining`} tone={quota.remaining > 2 ? 'purple' : 'neutral'} /><Text style={[styles.quotaPlan, { color: colors.textMuted }]}>{quota.plan === 'premium' ? 'Premium' : 'Free'} · this period</Text></View> : null}
            {provider === 'cloud' && quota?.softWarning ? <View style={[styles.quotaWarning, { backgroundColor: colors.primarySoft }]}><Icon name="information-outline" size={17} color={colors.primary} /><Text style={[styles.quotaWarningText, { color: colors.textSecondary }]}>You’re approaching this period’s secure-cloud AI limit. Cached and on-device answers do not consume it.</Text></View> : null}

            {!signedIn || !configured ? (
              <View style={[styles.tutorState, { backgroundColor: colors.primarySoft }]}>
                <Icon name={!signedIn ? 'account-lock-outline' : 'cloud-alert-outline'} size={26} color={colors.primary} />
                <Text style={[styles.tutorStateTitle, { color: colors.text }]}>{!signedIn ? 'Sign in to ask StudyBolt' : 'StudyBolt AI isn’t connected yet'}</Text>
                <Text style={[styles.tutorStateText, { color: colors.textSecondary }]}>{!signedIn ? 'Your normal device-voice StudyCast remains available without an account.' : 'Add the secure backend configuration to enable contextual questions. Listening still works offline.'}</Text>
                {!signedIn && onRequireAuth ? <Pressable onPress={onRequireAuth} style={[styles.signInButton, { backgroundColor: colors.card }]}><Text style={[styles.signInText, { color: colors.primary }]}>Sign in</Text><Icon name="arrow-right" size={17} color={colors.primary} /></Pressable> : null}
              </View>
            ) : null}

            {signedIn && configured && !response && !loading && !error ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
                <View style={styles.shortcuts}>
                  {SHORTCUTS.map((item) => (
                    <Pressable key={item.id} onPress={() => onAsk(item.id)} style={[styles.shortcut, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
                      <Icon name={item.icon} size={18} color={colors.purple} />
                      <Text style={[styles.shortcutText, { color: colors.text }]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {loading ? (
              <View style={styles.thinking}>
                <View style={[styles.thinkingBolt, { backgroundColor: colors.purpleSoft }]}><Icon name="creation" size={25} color={colors.purple} /></View>
                <ActivityIndicator color={colors.purple} />
                <Text style={[styles.thinkingTitle, { color: colors.text }]}>{provider === 'on-device' ? 'Your phone is connecting the ideas…' : 'StudyBolt is connecting the ideas…'}</Text>
                <Text style={[styles.thinkingText, { color: colors.textMuted }]}>{provider === 'on-device' ? 'Processing this section privately on your device.' : 'Using this section and its nearby context.'}</Text>
              </View>
            ) : null}

            {error && !loading ? (
              <View style={[styles.errorBox, { backgroundColor: `${colors.danger}12` }]}>
                <Icon name="alert-circle-outline" size={25} color={colors.danger} />
                <Text style={[styles.errorTitle, { color: colors.text }]}>StudyBolt couldn’t answer that right now</Text>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                <View style={styles.errorActions}><Pressable onPress={onRetry} style={[styles.inlineAction, { backgroundColor: colors.card }]}><Text style={[styles.inlineActionText, { color: colors.primary }]}>Try again</Text></Pressable><Pressable onPress={onResume} style={[styles.inlineAction, { backgroundColor: colors.primarySoft }]}><Text style={[styles.inlineActionText, { color: colors.primary }]}>Resume Study</Text></Pressable></View>
              </View>
            ) : null}

            {response?.kind === 'answer' ? (
              <View style={[styles.answerBox, { backgroundColor: colors.purpleSoft }]}>
                <View style={styles.answerHeading}><View style={[styles.answerAvatar, { backgroundColor: colors.purple }]}><Icon name="lightning-bolt" size={17} color="#FFFFFF" /></View><Text style={[styles.answerLabel, { color: colors.purple }]}>STUDYBOLT</Text></View>
                <Text style={[styles.answerText, { color: colors.text }]}>{response.answer}</Text>
                <Pressable accessibilityRole="button" onPress={() => onSpeak(response.answer)} style={[styles.speakButton, { backgroundColor: colors.card }]}><Icon name="volume-high" size={18} color={colors.purple} /><Text style={[styles.speakText, { color: colors.purple }]}>Read answer aloud</Text></Pressable>
              </View>
            ) : null}

            {response?.kind === 'quiz' && response.quiz ? (
              <View style={styles.quizBlock}>
                <Pill label="QUICK CHECK" tone="purple" />
                <Text style={[styles.quizQuestion, { color: colors.text }]}>{response.quiz.question}</Text>
                <View style={styles.quizOptions}>
                  {response.quiz.options.map((option, index) => {
                    const answered = selectedOption !== null;
                    const correct = index === response.quiz!.correctIndex;
                    const selected = index === selectedOption;
                    const backgroundColor = answered && correct ? colors.mintSoft : answered && selected ? `${colors.danger}12` : colors.cardStrong;
                    const borderColor = answered && correct ? colors.mint : answered && selected ? colors.danger : colors.border;
                    return <Pressable key={`${index}-${option}`} disabled={answered} onPress={() => chooseOption(index)} style={[styles.quizOption, { backgroundColor, borderColor }]}><Text style={[styles.optionLetter, { color: answered && correct ? colors.mint : colors.textMuted }]}>{String.fromCharCode(65 + index)}</Text><Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>{answered && correct ? <Icon name="check-circle" size={18} color={colors.mint} /> : null}</Pressable>;
                  })}
                </View>
                {selectedOption !== null ? (
                  <View style={[styles.quizFeedback, { backgroundColor: selectedOption === response.quiz.correctIndex ? colors.mintSoft : colors.primarySoft }]}><Text style={[styles.quizFeedbackTitle, { color: selectedOption === response.quiz.correctIndex ? colors.mint : colors.primary }]}>{selectedOption === response.quiz.correctIndex ? 'Correct' : 'Not quite'}</Text><Text style={[styles.quizFeedbackText, { color: colors.textSecondary }]}>{response.quiz.explanation}</Text></View>
                ) : null}
                {selectedOption !== null ? <Pressable onPress={() => onAsk('quiz')} style={[styles.anotherButton, { backgroundColor: colors.purpleSoft }]}><Icon name="refresh" size={18} color={colors.purple} /><Text style={[styles.anotherText, { color: colors.purple }]}>Another question</Text></Pressable> : null}
              </View>
            ) : null}

            {signedIn && configured && !loading ? (
              <View style={styles.askAnything}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ASK ANYTHING</Text>
                <View style={[styles.inputRow, { backgroundColor: colors.cardStrong, borderColor: colors.border }]}>
                  <TextInput accessibilityLabel="Question for StudyBolt" value={question} onChangeText={setQuestion} onSubmitEditing={submitQuestion} returnKeyType="send" placeholder="What does this part mean?" placeholderTextColor={colors.textMuted} multiline style={[styles.questionInput, { color: colors.text }]} />
                  <Pressable accessibilityLabel="Send question" disabled={!question.trim()} onPress={submitQuestion} style={[styles.sendButton, { backgroundColor: question.trim() ? colors.primary : colors.border }]}><Icon name="arrow-up" size={19} color={question.trim() ? colors.primaryText : colors.textMuted} /></Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <PrimaryButton label="Resume Study" icon="play" onPress={onResume} style={styles.resumeButton} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '82%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  askSheet: { width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '92%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 16 : 18, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, marginBottom: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  askIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 11, marginTop: 2 },
  close: { width: 34, height: 34, alignItems: 'flex-end', justifyContent: 'center' },
  rateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 18 },
  rateOption: { width: '48.5%', minHeight: 52, borderRadius: 15, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  rateText: { fontSize: 15, fontWeight: '900' },
  voiceList: { maxHeight: 430, marginTop: 13 },
  voiceListContent: { paddingBottom: 3 },
  voiceRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 9 },
  voiceSelect: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11, alignSelf: 'stretch' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  voiceCopy: { flex: 1, minWidth: 0 },
  voiceName: { fontSize: 12, fontWeight: '800' },
  voiceLanguage: { fontSize: 9, marginTop: 3 },
  previewButton: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  askScroll: { marginTop: 12 },
  askContent: { paddingBottom: 12 },
  quotaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quotaPlan: { fontSize: 8, fontWeight: '700' },
  quotaWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, borderRadius: 11, padding: 9, marginTop: 8 },
  quotaWarningText: { flex: 1, fontSize: 9, lineHeight: 13 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 },
  providerCopy: { flex: 1, minWidth: 0 },
  providerTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  providerDetail: { fontSize: 9, lineHeight: 14, marginTop: 2 },
  sectionLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginBottom: 9 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { width: '48.5%', minHeight: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11 },
  shortcutText: { flex: 1, fontSize: 10, fontWeight: '800' },
  tutorState: { alignItems: 'center', borderRadius: 16, padding: 18, marginTop: 12 },
  tutorStateTitle: { fontSize: 14, fontWeight: '900', marginTop: 8 },
  tutorStateText: { maxWidth: 320, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },
  signInButton: { minHeight: 39, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, marginTop: 11 },
  signInText: { fontSize: 10, fontWeight: '900' },
  thinking: { alignItems: 'center', paddingVertical: 29, gap: 8 },
  thinkingBolt: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  thinkingTitle: { fontSize: 13, fontWeight: '900' },
  thinkingText: { fontSize: 9 },
  errorBox: { alignItems: 'center', borderRadius: 16, padding: 17 },
  errorTitle: { fontSize: 13, fontWeight: '900', marginTop: 7 },
  errorText: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 4 },
  errorActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  inlineAction: { minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13 },
  inlineActionText: { fontSize: 10, fontWeight: '900' },
  answerBox: { borderRadius: 17, padding: 15 },
  answerHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  answerAvatar: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  answerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  answerText: { fontSize: 12, lineHeight: 19, marginTop: 11 },
  speakButton: { alignSelf: 'flex-start', minHeight: 39, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, marginTop: 13 },
  speakText: { fontSize: 10, fontWeight: '900' },
  quizBlock: { alignItems: 'flex-start' },
  quizQuestion: { fontSize: 17, lineHeight: 23, fontWeight: '900', marginTop: 12 },
  quizOptions: { alignSelf: 'stretch', gap: 8, marginTop: 13 },
  quizOption: { minHeight: 52, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  optionLetter: { width: 22, fontSize: 10, fontWeight: '900' },
  optionText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  quizFeedback: { alignSelf: 'stretch', borderRadius: 14, padding: 12, marginTop: 10 },
  quizFeedbackTitle: { fontSize: 11, fontWeight: '900' },
  quizFeedbackText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  anotherButton: { minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, marginTop: 10 },
  anotherText: { fontSize: 10, fontWeight: '900' },
  askAnything: { marginTop: 17 },
  inputRow: { minHeight: 51, maxHeight: 108, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 7 },
  questionInput: { flex: 1, minHeight: 36, maxHeight: 90, fontSize: 11, lineHeight: 16, paddingHorizontal: 5, paddingVertical: 8 },
  sendButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  resumeButton: { marginTop: 4 },
});
