import React, { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Card, Icon, Screen as BaseScreen } from './ui';
import type { IconName } from './ui';
import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { radius, typography } from '../theme';

/** Opt-in presentation for remaining pages; protected screens keep their existing primitives. */
export function PageEntrance({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const settle = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    settle.stopAnimation();
    if (reducedMotion) { settle.setValue(1); return; }
    settle.setValue(0);
    const animation = Animated.timing(settle, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, settle]);
  return <Animated.View style={[style, { opacity: settle.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }), transform: [{ translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }]}>{children}</Animated.View>;
}

export function PolishedScreen({ children, scroll = true, animate = true }: { children: ReactNode; scroll?: boolean; animate?: boolean }) {
  const contentStyle = [styles.content, !scroll && styles.fill];
  return <BaseScreen scroll={scroll}>{animate ? <PageEntrance style={contentStyle}>{children}</PageEntrance> : <View style={contentStyle}>{children}</View>}</BaseScreen>;
}

export function PolishedSectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useStudyBolt();
  return <View style={styles.heading}>
    <Text accessibilityRole="header" style={[styles.headingTitle, { color: colors.text }]}>{title}</Text>
    {action ? onAction ? <Pressable accessibilityRole="button" accessibilityLabel={action + ': ' + title} onPress={onAction} style={({ pressed }) => [styles.headingAction, { opacity: pressed ? 0.65 : 1 }]}><Text style={[styles.actionText, { color: colors.primary }]}>{action}</Text><Icon name="chevron-right" size={16} color={colors.primary} /></Pressable> : <Text style={[styles.metadata, { color: colors.textSecondary }]}>{action}</Text> : null}
  </View>;
}

export function PageIntro({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  const { colors } = useStudyBolt();
  return <Card style={[styles.intro, { backgroundColor: colors.primarySoft }]}>
    <View style={[styles.introIcon, { backgroundColor: colors.card }]}><Icon name={icon} color={colors.primary} size={25} /></View>
    <View style={styles.copy}><Text accessibilityRole="header" style={[styles.introTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.introText, { color: colors.textSecondary }]}>{description}</Text></View>
  </Card>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  fill: { flex: 1 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 3, marginTop: 26, marginBottom: 12 },
  headingTitle: { ...typography.sectionTitle, maxWidth: '100%' },
  metadata: { ...typography.caption, maxWidth: '100%' },
  headingAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  actionText: { ...typography.caption, fontWeight: '600' },
  intro: { padding: 20, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  introIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  introTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', letterSpacing: -0.35 },
  introText: { ...typography.secondary, marginTop: 6 },
});
