import type { Voice } from 'expo-speech';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { getNarrationSpeechOptions, type NarrationPreferences } from '../services/narration';
import { useStudyBolt } from '../StudyBoltContext';
import { Icon } from './ui';

type SettingsTab = 'language' | 'voice';

export function narrationLanguageLabel(language: string | null): string {
  if (!language) return 'Device language';
  const normalizedLanguage = language.replaceAll('_', '-');
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(normalizedLanguage) ?? language;
  } catch {
    return language;
  }
}

export function NarrationSettingsSheet({
  visible,
  voices,
  preferences,
  loading,
  onChange,
  onClose,
}: {
  visible: boolean;
  voices: Voice[];
  preferences: NarrationPreferences;
  loading: boolean;
  onChange: (preferences: NarrationPreferences) => void;
  onClose: () => void;
}) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [tab, setTab] = useState<SettingsTab>('language');
  const [search, setSearch] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const previewingRef = useRef(false);
  const wasVisible = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;
  const previewGeneration = useRef(0);

  useEffect(() => {
    if (!previewing || reducedMotion) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 430, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 430, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [previewing, pulse, reducedMotion]);

  useEffect(() => () => {
    if (previewingRef.current) void Speech.stop();
  }, []);

  useEffect(() => {
    if (!visible) {
      previewGeneration.current += 1;
      if (wasVisible.current && previewingRef.current) {
        previewingRef.current = false;
        setPreviewing(false);
        void Speech.stop();
      }
      wasVisible.current = false;
    } else {
      if (!wasVisible.current) {
        setTab('language');
        setSearch('');
      }
      wasVisible.current = true;
    }
  }, [visible]);

  const languages = useMemo(() => [...new Set(voices.map((voice) => voice.language))]
    .map((code) => ({ code, label: narrationLanguageLabel(code) }))
    .sort((a, b) => a.label.localeCompare(b.label)), [voices]);
  const visibleLanguages = languages.filter(({ code, label }) => `${label} ${code}`.toLowerCase().includes(search.trim().toLowerCase()));
  const visibleVoices = voices.filter((voice) => (!preferences.language || voice.language === preferences.language)
    && `${voice.name} ${voice.language}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedVoice = voices.find((voice) => voice.identifier === preferences.voiceIdentifier);

  const preview = (voice?: Voice) => {
    const generation = ++previewGeneration.current;
    previewingRef.current = true;
    setPreviewing(true);
    void Speech.stop().then(async () => {
      const options = await getNarrationSpeechOptions({
        language: voice?.language ?? preferences.language ?? undefined,
        voice: voice?.identifier,
        rate: 0.92,
        onDone: () => { if (generation === previewGeneration.current) { previewingRef.current = false; setPreviewing(false); } },
        onStopped: () => { if (generation === previewGeneration.current) { previewingRef.current = false; setPreviewing(false); } },
        onError: () => { if (generation === previewGeneration.current) { previewingRef.current = false; setPreviewing(false); } },
      });
      if (generation === previewGeneration.current) Speech.speak('1, 2, 3.', options);
    }).catch(() => { previewingRef.current = false; setPreviewing(false); });
  };

  const stopPreview = () => {
    previewGeneration.current += 1;
    previewingRef.current = false;
    setPreviewing(false);
    void Speech.stop();
  };

  const selectLanguage = (language: string | null) => {
    const firstVoice = language
      ? voices.find((voice) => voice.language === language && voice.quality === Speech.VoiceQuality.Enhanced)
        ?? voices.find((voice) => voice.language === language)
      : undefined;
    setSearch('');
    onChange({ language, voiceIdentifier: firstVoice?.identifier ?? null });
  };

  const selectVoice = (voice?: Voice) => {
    onChange({ language: voice?.language ?? preferences.language, voiceIdentifier: voice?.identifier ?? null });
  };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.mode === 'dark' ? 'rgba(0,0,0,0.72)' : 'rgba(17,28,78,0.38)' }]}>
        <Pressable accessibilityLabel="Close narration settings" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.shadow, paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.heading}>
            <View style={[styles.headingIcon, { backgroundColor: colors.purpleSoft }]}><Icon name="headphones" size={22} color={colors.purple} /></View>
            <View style={styles.headingCopy}>
              <Text style={[styles.title, { color: colors.text }]}>Narration</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Make StudyBolt sound like you</Text>
            </View>
            <Pressable accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}><Icon name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>

          <View style={[styles.previewCard, { backgroundColor: colors.primarySoft }]}>
            <Animated.View style={[styles.previewOrb, { backgroundColor: colors.primary, opacity, transform: [{ scale }] }]}><Icon name="waveform" size={21} color={colors.primaryText} /></Animated.View>
            <View style={styles.previewCopy}>
              <Text style={[styles.previewLabel, { color: colors.textMuted }]}>CURRENT VOICE</Text>
              <Text numberOfLines={1} style={[styles.previewVoice, { color: colors.text }]}>{selectedVoice?.name ?? 'Phone default voice'}</Text>
              <Text numberOfLines={1} style={[styles.previewLanguage, { color: colors.textSecondary }]}>{narrationLanguageLabel(preferences.language)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={previewing ? 'Stop voice preview' : 'Preview current narration voice'} onPress={() => previewing ? stopPreview() : preview(selectedVoice)} style={({ pressed }) => [styles.previewButton, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
              <Icon name={previewing ? 'stop' : 'play'} size={17} color={colors.primary} />
            </Pressable>
          </View>

          <View style={[styles.segmented, { backgroundColor: colors.cardStrong }]}>
            {(['language', 'voice'] as const).map((item) => {
              const active = tab === item;
              return (
                <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => { setTab(item); setSearch(''); }} style={[styles.segment, active && { backgroundColor: colors.card, shadowColor: colors.shadow }]}>
                  <Icon name={item === 'language' ? 'translate' : 'account-voice'} size={16} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.segmentText, { color: active ? colors.primary : colors.textMuted }]}>{item === 'language' ? 'Language' : 'Voice'}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            accessibilityLabel={tab === 'language' ? 'Search languages' : 'Search voices'}
            value={search}
            onChangeText={setSearch}
            placeholder={tab === 'language' ? 'Find a language' : 'Find a voice'}
            placeholderTextColor={colors.textMuted}
            style={[styles.search, { backgroundColor: colors.cardStrong, borderColor: colors.border, color: colors.text }]}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {tab === 'language' ? <>
              <Text style={[styles.listLabel, { color: colors.textMuted }]}>SPOKEN LANGUAGE</Text>
              <OptionRow
                title="Device language"
                detail="Follow your phone’s default"
                active={!preferences.language}
                color={colors.primary}
                textColor={colors.text}
                mutedColor={colors.textMuted}
                borderColor={colors.border}
                onSelect={() => selectLanguage(null)}
              />
              {visibleLanguages.map(({ code, label }) => (
                <OptionRow key={code} title={label} detail={code} active={preferences.language === code} color={colors.primary} textColor={colors.text} mutedColor={colors.textMuted} borderColor={colors.border} onSelect={() => selectLanguage(code)} />
              ))}
              {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
              {!loading && !languages.length ? <EmptyState text="No built-in speech languages were found on this phone." /> : null}
              {!loading && languages.length > 0 && !visibleLanguages.length ? <EmptyState text="No languages match that search." /> : null}
            </> : <>
              <View style={styles.voiceListHeading}>
                <Text style={[styles.listLabel, { color: colors.textMuted }]}>{preferences.language ? narrationLanguageLabel(preferences.language).toUpperCase() : 'AVAILABLE PHONE VOICES'}</Text>
                <Pressable accessibilityRole="button" onPress={() => setTab('language')} style={styles.changeLanguage}><Text style={[styles.changeLanguageText, { color: colors.primary }]}>Change</Text><Icon name="chevron-right" size={15} color={colors.primary} /></Pressable>
              </View>
              <OptionRow
                title="Phone default voice"
                detail={preferences.language ? `Use the default for ${narrationLanguageLabel(preferences.language)}` : 'Use your phone’s selected voice'}
                active={!preferences.voiceIdentifier}
                color={colors.mint}
                textColor={colors.text}
                mutedColor={colors.textMuted}
                borderColor={colors.border}
                onSelect={() => selectVoice()}
                onPreview={() => preview()}
              />
              {visibleVoices.map((voice) => (
                <OptionRow key={voice.identifier} title={voice.name} detail={`${narrationLanguageLabel(voice.language)}${voice.quality === Speech.VoiceQuality.Enhanced ? ' · Enhanced' : ''}`} active={preferences.voiceIdentifier === voice.identifier} color={colors.mint} textColor={colors.text} mutedColor={colors.textMuted} borderColor={colors.border} onSelect={() => selectVoice(voice)} onPreview={() => preview(voice)} />
              ))}
              {loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
              {!loading && !visibleVoices.length ? <EmptyState text={preferences.language ? 'No voices are installed for this language. Choose another language or add voices in your phone settings.' : 'No built-in voices were found on this phone.'} /> : null}
            </>}
          </ScrollView>

          <Text style={[styles.footnote, { color: colors.textMuted }]}>Uses voices installed on your phone. Narration follows your selected language when the study text supports it; it doesn’t translate the material.</Text>
        </View>
      </View>
    </Modal>
  );
}

function OptionRow({ title, detail, active, color, textColor, mutedColor, borderColor, onSelect, onPreview }: {
  title: string;
  detail: string;
  active: boolean;
  color: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  onSelect: () => void;
  onPreview?: () => void;
}) {
  return (
    <View style={[styles.optionRow, { borderBottomColor: borderColor }]}>
      <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onSelect} style={styles.optionSelect}>
        <View style={[styles.radio, { borderColor: active ? color : borderColor }]}>{active ? <View style={[styles.radioDot, { backgroundColor: color }]} /> : null}</View>
        <View style={styles.optionCopy}><Text numberOfLines={1} style={[styles.optionTitle, { color: textColor }]}>{title}</Text><Text numberOfLines={1} style={[styles.optionDetail, { color: mutedColor }]}>{detail}</Text></View>
      </Pressable>
      {onPreview ? <Pressable accessibilityRole="button" accessibilityLabel={`Preview ${title}`} onPress={onPreview} hitSlop={6} style={[styles.rowPreview, { backgroundColor: `${color}1B` }]}><Icon name="play" size={15} color={color} /></Pressable> : null}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  const { colors } = useStudyBolt();
  return <View style={styles.emptyState}><Icon name="information-outline" size={18} color={colors.textMuted} /><Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '91%', alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingTop: 10, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 14 },
  handle: { width: 42, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  headingIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { flex: 1 },
  title: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { fontSize: 10, marginTop: 2 },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  previewCard: { minHeight: 78, borderRadius: 19, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  previewOrb: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  previewCopy: { flex: 1, minWidth: 0 },
  previewLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  previewVoice: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  previewLanguage: { fontSize: 10, marginTop: 2 },
  previewButton: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmented: { minHeight: 44, borderRadius: 15, padding: 4, flexDirection: 'row', gap: 4, marginBottom: 11 },
  segment: { flex: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentText: { fontSize: 11, fontWeight: '800' },
  search: { minHeight: 43, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, fontSize: 12, marginBottom: 10 },
  list: { flexGrow: 0, flexShrink: 1, minHeight: 115 },
  listContent: { paddingBottom: 5 },
  loading: { marginVertical: 22 },
  listLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.85 },
  voiceListHeading: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  changeLanguage: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  changeLanguageText: { fontSize: 10, fontWeight: '800' },
  optionRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  optionSelect: { flex: 1, minWidth: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 12, fontWeight: '800' },
  optionDetail: { fontSize: 9, marginTop: 3 },
  rowPreview: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 7 },
  emptyState: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 7 },
  emptyText: { flex: 1, fontSize: 10, lineHeight: 15 },
  footnote: { fontSize: 9, lineHeight: 14, paddingTop: 10, paddingBottom: 4 },
});
