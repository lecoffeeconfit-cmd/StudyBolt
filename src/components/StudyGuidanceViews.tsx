import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { fitGuideSpotlight, type GuideDefinition, type GuideRect, type GuideStep } from '../services/studyGuidance';
import { spacing, typography } from '../theme';
import { Icon, PrimaryButton } from './ui';
import { bottomTabBarTop } from './BottomTabs';
import type { GuidanceAnchor } from './StudyGuidance';

function useGuideFocus(key: string, shown: boolean) {
  const heading = useRef<Text>(null);
  useEffect(() => {
    if (!shown || Platform.OS === 'web') return;
    const frame = requestAnimationFrame(() => {
      if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
    });
    return () => cancelAnimationFrame(frame);
  }, [key, shown]);
  return heading;
}

export function GuidanceSpotlight({ guide, stepIndex, getAnchor, onNext, onSkip, onActivate }: {
  guide: GuideDefinition;
  stepIndex: number;
  getAnchor: (id: string) => GuidanceAnchor | undefined;
  onNext: () => void;
  onSkip: () => void;
  onActivate: (action: () => void) => void;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [shown, setShown] = useState(false);
  const [height, setHeight] = useState(0);
  const [target, setTarget] = useState<{ step: GuideStep; rect: GuideRect } | null>(null);
  const root = useRef<View>(null);
  const step = guide.steps[stepIndex]!;
  const anchor = step.anchor ? getAnchor(step.anchor) : undefined;
  const heading = useGuideFocus(step.title, shown);
  const entrance = useRef(new Animated.Value(1)).current;
  const welcome = guide.kind === 'welcome';
  const pageBottom = guide.page === 'pack' ? insets.bottom + 10 : bottomTabBarTop(insets.bottom) + 12;
  const area = { x: insets.left + 8, y: insets.top + 8, width: Math.max(0, viewport.width - insets.left - insets.right - 16), height: Math.max(0, viewport.height - insets.top - 8 - pageBottom) };
  const cardWidth = Math.min(390, Math.max(0, area.width - 8));
  const layout = fitGuideSpotlight(anchor && target?.step === step ? target.rect : null, area, height);
  const middleX = layout ? layout.bounds.x + layout.bounds.width / 2 : viewport.width / 2;
  const left = Math.max(area.x + 4, Math.min(middleX - cardWidth / 2, area.x + area.width - cardWidth - 4));
  const action = layout ? anchor?.activate : undefined;

  useEffect(() => {
    setTarget(null);
    if (!anchor || !shown) return;
    let live = true;
    const measure = () => root.current?.measureInWindow((originX, originY) => {
      anchor.measure(rect => {
        if (live) setTarget({ step, rect: { ...rect, x: rect.x - originX, y: rect.y - originY } });
      });
    });
    const frame = requestAnimationFrame(measure);
    const unsubscribe = anchor.onLayout(measure);
    return () => { live = false; cancelAnimationFrame(frame); unsubscribe(); };
  }, [anchor, shown, step, viewport.width, viewport.height, window.fontScale]);

  useEffect(() => {
    if (reducedMotion) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const animation = Animated.timing(entrance, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [entrance, reducedMotion, step]);

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType={reducedMotion ? 'none' : 'fade'} onShow={() => setShown(true)} onRequestClose={onSkip}>
      <View ref={root} collapsable={false} style={styles.overlay} accessibilityViewIsModal aria-modal role="dialog" accessibilityLabel={step.title} onLayout={event => {
        const { width, height: nextHeight } = event.nativeEvent.layout;
        setViewport(previous => previous.width === width && previous.height === nextHeight ? previous : { width, height: nextHeight });
      }}>
        {layout ? <SpotlightShade size={viewport} bounds={layout.bounds} color={colors.neon?.glow ?? colors.primary} /> : <View style={[StyleSheet.absoluteFill, styles.shade]} />}
        {layout && action ? <Pressable accessible={false} importantForAccessibility="no" style={[styles.target, { left: layout.bounds.x, top: layout.bounds.y, width: layout.bounds.width, height: layout.bounds.height }]} onPress={() => onActivate(action)} /> : null}
        <Animated.View
          style={[styles.card, { left, width: cardWidth, backgroundColor: colors.card, borderColor: colors.neon?.edge ?? colors.border,
            maxHeight: Math.max(1, area.height), opacity: entrance,
            ...(layout ? { top: layout.cardTop } : welcome ? { top: Math.max(area.y, area.y + (area.height - height) / 2) } : { bottom: pageBottom }) }]}
          onLayout={event => setHeight(event.nativeEvent.layout.height)}
        >
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={styles.cardContent}>
            <View style={styles.cardHeading}>
              <View style={[styles.icon, { backgroundColor: welcome ? colors.goldSoft : colors.primarySoft }]}>
                <Icon name={welcome ? 'lightning-bolt' : 'compass-outline'} color={welcome ? colors.goldText : colors.primary} size={23} />
              </View>
              {guide.steps.length > 1 ? <Text style={[styles.counter, { color: colors.textSecondary }]}>{stepIndex + 1} of {guide.steps.length}</Text> : null}
            </View>
            <Text ref={heading} accessible accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{step.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>
            <View style={styles.actions}>
              <PrimaryButton label={welcome ? 'Start studying' : stepIndex + 1 === guide.steps.length ? 'Got it' : 'Next'} onPress={onNext} />
              {action && anchor?.actionLabel ? <Pressable accessibilityRole="button" onPress={() => onActivate(action)} style={styles.secondary}>
                <Text style={[styles.secondaryText, { color: colors.primary }]}>{anchor.actionLabel}</Text>
              </Pressable> : null}
              <Pressable accessibilityRole="button" onPress={onSkip} style={styles.secondary}>
                <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>{welcome ? 'Explore on my own' : 'Skip'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SpotlightShade({ size, bounds, color }: { size: { width: number; height: number }; bounds: GuideRect; color: string }) {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <View style={[styles.shade, { top: 0, left: 0, right: 0, height: bounds.y }]} />
    <View style={[styles.shade, { top: bottom, bottom: 0, left: 0, right: 0 }]} />
    <View style={[styles.shade, { top: bounds.y, left: 0, width: bounds.x, height: bounds.height }]} />
    <View style={[styles.shade, { top: bounds.y, left: right, width: Math.max(0, size.width - right), height: bounds.height }]} />
    <View style={[styles.ring, { top: bounds.y, left: bounds.x, width: bounds.width, height: bounds.height, borderColor: color }]} />
  </View>;
}

export function GuidanceHelp({ guides, onClose, onReplay, onIntro }: {
  guides: readonly GuideDefinition[]; onClose: () => void; onReplay: (guide: GuideDefinition) => void; onIntro: () => void;
}) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(false);
  const heading = useGuideFocus('Help and tutorials', shown);
  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType={reducedMotion ? 'none' : 'fade'} onRequestClose={onClose} onShow={() => setShown(true)}>
      <View style={[styles.helpOverlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} accessibilityViewIsModal aria-modal role="dialog" accessibilityLabel="Help and tutorials">
        <View style={[styles.helpCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.helpHeader}>
            <Text ref={heading} accessible accessibilityRole="header" style={[styles.title, styles.flex, { color: colors.text }]}>Help &amp; tutorials</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close tutorials" onPress={onClose} style={[styles.close, { backgroundColor: colors.cardStrong }]}><Icon name="close" size={20} /></Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.helpList}>
            {guides.map(guide => <Pressable key={guide.id} accessibilityRole="button" onPress={() => onReplay(guide)} style={({ pressed }) => [styles.helpRow, { backgroundColor: pressed ? colors.primarySoft : colors.cardStrong }]}>
              <Text style={[styles.helpLabel, { color: colors.text }]}>{guide.title}</Text><Icon name="chevron-right" size={18} color={colors.primary} />
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={onIntro} style={({ pressed }) => [styles.helpRow, { backgroundColor: pressed ? colors.primarySoft : colors.cardStrong }]}>
              <Text style={[styles.helpLabel, { color: colors.text }]}>StudyBolt introduction</Text><Icon name="chevron-right" size={18} color={colors.primary} />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function InlineGuidanceTip({ step, onDismiss }: { step: GuideStep; onDismiss: () => void }) {
  const { colors } = useStudyBolt();
  return <View style={[styles.tip, { backgroundColor: colors.primarySoft, borderColor: colors.neon?.edge ?? colors.border }]}>
    <Icon name="lightbulb-outline" size={19} color={colors.goldText} />
    <View style={styles.flex}>
      <Text style={[styles.tipTitle, { color: colors.text }]}>{step.title}</Text>
      <Text style={[styles.tipBody, { color: colors.textSecondary }]}>{step.body}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss tip: ${step.title}`} onPress={onDismiss} style={styles.close}><Icon name="close" size={17} color={colors.textSecondary} /></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1 },
  shade: { position: 'absolute', backgroundColor: 'rgba(9, 15, 31, 0.52)' },
  ring: { position: 'absolute', borderWidth: 2, borderRadius: 16 },
  target: { position: 'absolute' },
  card: { position: 'absolute', borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  cardContent: { gap: 8, padding: spacing.lg },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  counter: { ...typography.caption, fontVariant: ['tabular-nums'] },
  title: { ...typography.sectionTitle, fontWeight: '800' },
  body: typography.body,
  actions: { marginTop: 3, gap: 2 },
  secondary: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  secondaryText: { ...typography.secondary, fontWeight: '700', textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  helpOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, backgroundColor: 'rgba(9, 15, 31, 0.52)' },
  helpCard: { width: '100%', maxWidth: 430, maxHeight: '100%', borderWidth: 1, borderRadius: 22, overflow: 'hidden' },
  helpHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  close: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  helpList: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  helpRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, gap: 8 },
  helpLabel: { ...typography.control, flex: 1, minWidth: 0 },
  tip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 14, padding: 8, marginVertical: 6 },
  tipTitle: { ...typography.secondary, fontWeight: '700' },
  tipBody: typography.caption,
});
