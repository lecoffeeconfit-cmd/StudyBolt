import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { radius, typography } from '../theme';
import { LoadingArtwork } from './StudyBoltLoading';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useStudyBolt();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? colors.text} accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

export function ThemeToggle({ style, size, reducedMotion }: {
  style: StyleProp<ViewStyle>;
  size: number;
  reducedMotion: boolean;
}) {
  const { colors, cycleTheme, themeToggle } = useStudyBolt();
  const indicator = colors.neon?.indicator;
  const animate = Boolean(indicator) && !reducedMotion;
  const reveal = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (!animate) return;
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, reveal]);

  const icon = <Icon
    name={themeToggle.icon}
    size={size}
    color={indicator?.icon ?? colors.primary}
  />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={themeToggle.label}
      accessibilityHint={colors.neon ? `${colors.neon.name} seasonal palette.` : undefined}
      onPress={cycleTheme}
      style={[style, { backgroundColor: indicator?.surface ?? colors.card, borderColor: indicator?.edge ?? colors.border }]}
    >
      {indicator ? (
        <View pointerEvents="none" aria-hidden style={[styles.sparkleHalo, { width: size + 8, height: size + 8, backgroundColor: indicator.halo }]} />
      ) : null}
      {animate ? (
        <Animated.View style={{
          opacity: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.64, 1] }),
          transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }],
        }}>{icon}</Animated.View>
      ) : icon}
    </Pressable>
  );
}

export function FlagButton({ flagged, onPress, label = 'Flag for later' }: { flagged: boolean; onPress: () => void; label?: string }) {
  const { colors } = useStudyBolt();
  return (
    <Pressable aria-pressed={flagged}
      accessibilityRole="button"
      accessibilityLabel={flagged ? 'Remove flag' : label}
      accessibilityState={{ selected: flagged }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.flagButton,
        { backgroundColor: flagged ? `${colors.warning}1C` : colors.cardStrong, borderColor: flagged ? `${colors.warning}66` : colors.border },
        pressed && styles.flagButtonPressed,
      ]}
    >
      <Icon name={flagged ? 'flag' : 'flag-outline'} size={17} color={flagged ? colors.warning : colors.textMuted} />
    </Pressable>
  );
}

export function BoltMark({
  size = 36,
  iconSize = 24,
  animated = true,
  backgroundColor,
  color,
  style,
}: {
  size?: number;
  iconSize?: number;
  animated?: boolean;
  backgroundColor?: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useStudyBolt();
  const reducedMotion = useReducedMotion();
  const charge = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    charge.stopAnimation();
    charge.setValue(0);
    if (!animated || reducedMotion) return;
    const animation = Animated.sequence([
      Animated.delay(380),
      Animated.timing(charge, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [animated, charge, reducedMotion]);

  const motionStyle = animated && !reducedMotion
    ? {
        transform: [
          { scale: charge.interpolate({ inputRange: [0, 0.55, 1], outputRange: [1, 1.09, 1] }) },
          { rotate: charge.interpolate({ inputRange: [0, 0.55, 1], outputRange: ['0deg', '-6deg', '0deg'] }) },
        ],
      }
    : undefined;

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.logoBolt,
        { width: size, height: size, borderRadius: Math.round(size * 0.33), backgroundColor: backgroundColor ?? colors.goldSoft, pointerEvents: 'none' },
        style,
        motionStyle,
      ]}
    >
      <Icon name="lightning-bolt" size={iconSize} color={color ?? colors.goldText} />
    </Animated.View>
  );
}

export function BoltLogo({ compact = false }: { compact?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.logoRow}>
      <BoltMark
        size={36}
        iconSize={compact ? 21 : 27}
        backgroundColor={colors.neon ? colors.primarySoft : colors.primary}
        color={colors.neon?.indicator.icon ?? (colors.mode === 'dark' ? '#FFE68A' : '#FFE04F')}
        style={{
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: colors.mode === 'dark' ? 0.5 : 0.34,
          shadowRadius: 8,
          elevation: 5,
        }}
      />
      <Text style={[compact ? styles.logoTextCompact : styles.logoText, { color: colors.text }]}>Study Bolt</Text>
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { colors } = useStudyBolt();
  const cardStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: colors.shadow,
    },
    style,
  ];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [cardStyle, pressed && { opacity: 0.85 }]}
    >
      {children}
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  icon?: IconName;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useStudyBolt();
  const buttonStyle = colors.neon ? StyleSheet.flatten(style) : undefined;
  const actionGradient = buttonStyle?.backgroundColor === undefined ? colors.neon?.action : undefined;
  return (
    <Pressable aria-disabled={disabled || loading} aria-busy={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={(event) => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress(event);
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.primary, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {actionGradient ? (
        <GradientSurface colors={actionGradient} borderRadius={buttonStyle?.borderRadius ?? radius.md} />
      ) : null}
      {loading ? <LoadingArtwork compact colors={{ ...colors, primary: colors.primaryText }} /> : icon ? <Icon name={icon} size={20} color={colors.primaryText} /> : null}
      <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function GradientSurface({ colors, borderRadius }: { colors: readonly [string, string]; borderRadius: ViewStyle['borderRadius'] }) {
  return (
    <LinearGradient
      pointerEvents="none"
      aria-hidden
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }]}
    />
  );
}

export function NeonOutline({ color, borderRadius }: { color: string; borderRadius: number }) {
  return <View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, { borderWidth: StyleSheet.hairlineWidth, borderColor: color, borderRadius }]} />;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={6} style={styles.sectionActionTarget}>
          <Text style={[styles.sectionAction, { color: colors.neon?.focus ?? colors.primary }]}>{action}</Text>
        </Pressable>
      ) : action ? <Text style={[styles.sectionMetadata, { color: colors.textSecondary }]}>{action}</Text> : null}
    </View>
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useStudyBolt();
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => onBack()} hitSlop={8} style={styles.iconButton}>
            <Icon name="chevron-left" size={30} color={colors.text} />
          </Pressable>
        ) : (
          <BoltLogo compact />
        )}
      </View>
      {onBack ? (
        <View style={styles.headerTitleWrap}>
          <Text accessibilityRole="header" numberOfLines={2} style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={2} style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function Pill({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'gold' | 'mint' | 'purple' | 'neutral' }) {
  const { colors } = useStudyBolt();
  const background = tone === 'gold' ? colors.goldSoft : tone === 'mint' ? colors.mintSoft : tone === 'purple' ? colors.purpleSoft : tone === 'neutral' ? colors.cardStrong : colors.primarySoft;
  const foreground = tone === 'gold' ? colors.goldText : tone === 'mint' ? colors.mint : tone === 'purple' ? colors.purple : tone === 'neutral' ? colors.textSecondary : colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {colors.neon ? <NeonOutline color={tone === 'blue' ? colors.neon.edge : colors.border} borderRadius={radius.pill} /> : null}
      <Text style={[styles.pillText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ progress, color, accessibilityLabel = 'Progress' }: { progress: number; color?: string; accessibilityLabel?: string }) {
  const { colors } = useStudyBolt();
  const safe = Math.max(0, Math.min(100, progress));
  const neon = color === undefined || color === colors.primary ? colors.neon : undefined;
  const fill = neon?.progressFill ?? color ?? colors.primary;
  const highlight = colors.neon && safe > 0
    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neon.progressHighlight }
    : undefined;
  return (
    <View aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe} accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: safe }} style={[styles.progressTrack, { backgroundColor: colors.neon?.progressTrack ?? colors.border }]}>
      <View style={[styles.progressFill, { backgroundColor: fill, width: `${safe}%` }, highlight]}>
        {neon && safe > 0 ? <GradientSurface colors={[neon.progressFill, neon.progressEnd]} borderRadius={radius.pill} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sparkleHalo: { position: 'absolute', borderRadius: radius.pill },
  screen: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 1,
  },
  pressed: { transform: [{ scale: 0.987 }], opacity: 0.92 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoBolt: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
  logoTextCompact: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { ...typography.control, fontSize: 16, lineHeight: 23, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { ...typography.sectionTitle, flex: 1 },
  sectionAction: { ...typography.control },
  sectionActionTarget: { minHeight: 44, justifyContent: 'center', paddingLeft: 10 },
  sectionMetadata: { ...typography.caption, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  header: { minHeight: 52, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerSide: { minWidth: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, lineHeight: 24, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center' },
  headerSubtitle: { ...typography.caption, marginTop: 1, textAlign: 'center' },
  iconButton: { width: 44, height: 44, justifyContent: 'center' },
  flagButton: { width: 44, height: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  flagButtonPressed: { opacity: 0.68, transform: [{ scale: 0.94 }] },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { ...typography.caption, fontWeight: '600' },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
