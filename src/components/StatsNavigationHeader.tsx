import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { radius, spacing, typography, type AppColors } from '../theme';
import { Icon, GradientSurface, type IconName } from './ui';
import { GuideAnchor } from './StudyGuidance';

const categories = [
  { id: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { id: 'insights', label: 'Insights', icon: 'chart-box-plus-outline' },
  { id: 'mastery', label: 'Mastery', icon: 'brain' },
  { id: 'quizzes', label: 'Quizzes', icon: 'clipboard-check-outline' },
  { id: 'activity', label: 'Activity', icon: 'chart-timeline-variant' },
  { id: 'methods', label: 'Methods', icon: 'shape-outline' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

export type StatsTab = typeof categories[number]['id'];

const scopes = [
  { all: false, label: 'Selected class', icon: 'book-open-variant' },
  { all: true, label: 'All classes', icon: 'bookshelf' },
] as const satisfies readonly { all: boolean; label: string; icon: IconName }[];

const accentText = (colors: AppColors) => colors.mode === 'light' ? '#0E5FC9' : colors.primary;

export function StatsProgressHeader({ scope, onAbout }: {
  scope?: { allClasses: boolean; className?: string; onChange: (allClasses: boolean) => void };
  onAbout: () => void;
}) {
  const { colors } = useStudyBolt();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const accent = accentText(colors);
  const edge = colors.neon?.edge ?? (colors.mode === 'light' ? '#CFE1FA' : colors.border);
  const stackScope = fontScale > 1.6 || (width < 360 && fontScale > 1.25);
  const scopeDescription = scope?.allClasses ? 'Combined progress across classes' : scope?.className;

  const gradient = colors.neon?.hero ?? colors.night?.hero;
  return (
    <View style={[styles.header, { backgroundColor: colors.primarySoft, borderColor: edge }]}>
      {gradient ? <GradientSurface colors={gradient} borderRadius={styles.header.borderRadius} /> : null}
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your progress</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>See what you know and what to practice next.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About your statistics and data scope"
          onPress={onAbout}
          style={({ pressed }) => [styles.help, { backgroundColor: pressed ? colors.cardStrong : colors.card, borderColor: edge }]}
        >
          <Icon name="information-outline" color={accent} size={21} />
        </Pressable>
      </View>
      {scope ? (
        <View style={styles.scope}>
          <GuideAnchor id="stats-scope">
          <View
            accessibilityRole="tablist"
            accessibilityLabel="Statistics scope"
            style={[styles.scopeOptions, { backgroundColor: colors.cardStrong, borderColor: edge }]}
          >
            {scopes.map(option => (
              <StatsOption
                key={option.label}
                label={option.label}
                icon={option.icon}
                active={scope.allClasses === option.all}
                basis={stackScope ? '100%' : '46%'}
                reducedMotion={reducedMotion}
                onPress={() => scope.onChange(option.all)}
                colors={colors}
                scopeOption
              />
            ))}
          </View>
          </GuideAnchor>
          {scopeDescription ? (
            <Text style={[styles.scopeDescription, { color: colors.textSecondary }]}>
              {scope?.allClasses ? scopeDescription : `Showing ${scopeDescription}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function StatsCategories({ selected, onChange }: { selected: StatsTab; onChange: (tab: StatsTab) => void }) {
  const { colors } = useStudyBolt();
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const columns = fontScale > 1.9 ? 1
    : fontScale > 1.35 || (width < 360 && fontScale > 1.25) ? 2
      : width > 740 ? 6 : 3;
  const stackIcon = columns === 3 && (width < 375 || fontScale > 1.12);
  const basis = columns === 1 ? '100%' : columns === 2 ? '46%' : columns === 3 ? '29%' : '14%';

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Statistics sections" style={styles.categories}>
      {categories.map(item => (
        <StatsOption
          key={item.id}
          active={selected === item.id}
          basis={basis}
          colors={colors}
          icon={item.icon}
          label={item.label}
          onPress={() => onChange(item.id)}
          reducedMotion={reducedMotion}
          stackIcon={stackIcon}
        />
      ))}
    </View>
  );
}

function StatsOption({ active, basis, colors, icon, label, onPress, reducedMotion, scopeOption, stackIcon }: {
  active: boolean;
  basis?: '100%' | '46%' | '29%' | '14%';
  colors: AppColors;
  icon: IconName;
  label: string;
  onPress: () => void;
  reducedMotion: boolean;
  scopeOption?: boolean;
  stackIcon?: boolean;
}) {
  const selection = useRef(new Animated.Value(active ? 1 : 0)).current;
  const color = active ? accentText(colors) : colors.textSecondary;
  const focusBorder = colors.neon?.edge ?? (colors.mode === 'light' ? '#B8D5FA' : colors.primary);

  useEffect(() => {
    if (reducedMotion) {
      selection.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(selection, {
      toValue: active ? 1 : 0, duration: 150, useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, reducedMotion, selection]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      aria-selected={active}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        stackIcon && styles.stackedIcon,
        {
          flexBasis: basis ?? 'auto',
          backgroundColor: scopeOption ? 'transparent' : pressed ? colors.cardStrong : colors.card,
          borderColor: scopeOption ? 'transparent' : colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <Animated.View style={[styles.selection, { backgroundColor: scopeOption ? colors.card : colors.primarySoft, borderColor: focusBorder, opacity: selection }]} />
      <Icon name={icon} size={16} color={color} />
      <Text style={[styles.optionLabel, { color, fontWeight: active ? '800' : '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  copy: { flex: 1, minWidth: 0 },
  title: { ...typography.pageTitle, letterSpacing: -0.55 },
  subtitle: { ...typography.secondary, marginTop: 2 },
  help: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  scope: { gap: 5 },
  scopeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 3, borderRadius: 15, borderWidth: 1 },
  scopeDescription: { ...typography.caption, marginHorizontal: 3 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  option: { flexDirection: 'row', flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 0, borderWidth: 1, borderRadius: 11, gap: 5, paddingHorizontal: 7, paddingVertical: 7 },
  stackedIcon: { flexDirection: 'column', gap: 2 },
  selection: { ...StyleSheet.absoluteFill, margin: -1, borderRadius: 11, borderWidth: 1, pointerEvents: 'none' },
  optionLabel: { ...typography.caption, fontSize: 13, lineHeight: 19, textAlign: 'center', flexShrink: 1 },
});
