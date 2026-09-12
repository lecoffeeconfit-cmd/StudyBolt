import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { radius } from '../theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useStudyBolt();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? colors.text} />;
}

export function BoltLogo({ compact = false }: { compact?: boolean }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoBolt, { backgroundColor: colors.primarySoft }]}>
        <Icon name="lightning-bolt" size={compact ? 21 : 27} color={colors.primary} />
      </View>
      <Text style={[compact ? styles.logoTextCompact : styles.logoText, { color: colors.text }]}>Study Bolt</Text>
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
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
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={(event) => {
        if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress(event);
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor: colors.primary, opacity: disabled ? 0.5 : pressed ? 0.88 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.primaryText} /> : icon ? <Icon name={icon} size={20} color={colors.primaryText} /> : null}
      <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { colors } = useStudyBolt();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
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
          <Pressable accessibilityLabel="Go back" onPress={onBack} hitSlop={12} style={styles.iconButton}>
            <Icon name="chevron-left" size={30} color={colors.text} />
          </Pressable>
        ) : (
          <BoltLogo compact />
        )}
      </View>
      {onBack ? (
        <View style={styles.headerTitleWrap}>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function Pill({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'mint' | 'purple' | 'neutral' }) {
  const { colors } = useStudyBolt();
  const background = tone === 'mint' ? colors.mintSoft : tone === 'purple' ? colors.purpleSoft : tone === 'neutral' ? colors.cardStrong : colors.primarySoft;
  const foreground = tone === 'mint' ? colors.mint : tone === 'purple' ? colors.purple : tone === 'neutral' ? colors.textSecondary : colors.primary;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const { colors } = useStudyBolt();
  const safe = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
      <View style={[styles.progressFill, { backgroundColor: color ?? colors.primary, width: `${safe}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 2,
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
  primaryButtonText: { fontSize: 16, lineHeight: 20, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.3 },
  sectionAction: { fontSize: 13, fontWeight: '700' },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerSide: { minWidth: 88, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, marginTop: 1 },
  iconButton: { width: 42, height: 42, justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
});
