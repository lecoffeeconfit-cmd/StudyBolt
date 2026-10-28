import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { AppColors } from '../theme';

type Props = { colors: AppColors; onPress: () => void | Promise<void>; compact?: boolean };

// These are supported format labels, all served by the same existing picker.
const FORMATS = [
  { label: 'PDF', icon: 'file-pdf-box' },
  { label: 'PowerPoint', icon: 'file-powerpoint-outline' },
  { label: 'Notes', icon: 'note-text-outline' },
] as const;

export function AddStudyMaterialCard({ colors, onPress, compact = false }: Props) {
  const reducedMotion = useReducedMotion();
  const press = useRef(new Animated.Value(0)).current;
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [opening, setOpening] = useState(false);
  const [focused, setFocused] = useState(false);
  const dark = colors.mode === 'dark';
  const accent = dark ? '#A6C5FF' : '#2459BC';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; press.stopAnimation(); };
  }, [press]);
  useEffect(() => { if (reducedMotion) { press.stopAnimation(); press.setValue(0); } }, [press, reducedMotion]);

  const animatePress = (pressed: boolean) => {
    press.stopAnimation();
    Animated.timing(press, {
      toValue: pressed && !reducedMotion ? 1 : 0, duration: reducedMotion ? 0 : 140,
      easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const openPicker = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpening(true);
    try { await onPress(); }
    finally { inFlight.current = false; if (mounted.current) setOpening(false); }
  };

  return (
    <View style={[styles.card, { backgroundColor: dark ? '#192B40' : '#EDF4FF', borderColor: focused ? accent : dark ? '#334D6C' : '#D5E3FA', shadowColor: colors.shadow }]}>
      <View style={styles.heading}>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.icon, { backgroundColor: dark ? '#263F60' : '#DBE8FF' }]}>
          <MaterialCommunityIcons name="file-upload-outline" size={25} color={accent} />
        </View>
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Import Study Materials</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>Turn your course materials into study tools.</Text>
        </View>
      </View>
      {!compact ? <Text style={[styles.startHint, { color: colors.textSecondary }]}>Start with a file from class, or combine PowerPoints into one Study Pack.</Text> : null}
      <View style={styles.formats} accessibilityLabel="Supported files: PDF, PowerPoint, and notes">
        {FORMATS.map((format) => (
          <View key={format.label} style={styles.format}>
            <MaterialCommunityIcons name={format.icon} size={15} color={accent} accessible={false} />
            <Text style={[styles.formatText, { color: colors.textSecondary }]}>{format.label}</Text>
          </View>
        ))}
      </View>
      <Animated.View style={{ transform: reducedMotion ? [] : [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }}>
        <Pressable
          accessibilityRole="button" accessibilityLabel={opening ? 'Opening files' : 'Import Materials'}
          accessibilityHint="Choose a PDF, PowerPoint, or notes file. Multiple files must all be PowerPoints."
          accessibilityState={{ disabled: opening, busy: opening }} disabled={opening}
          onPress={() => { void openPicker(); }} onPressIn={() => animatePress(true)} onPressOut={() => animatePress(false)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={({ pressed }) => [styles.action, { backgroundColor: dark ? '#294467' : '#DCE9FF', opacity: pressed ? 0.8 : 1 }]}
        >
          {opening ? <ActivityIndicator size="small" color={accent} /> : <MaterialCommunityIcons name="upload" size={19} color={accent} accessible={false} />}
          <Text style={[styles.actionText, { color: accent }]}>{opening ? 'Opening files…' : 'Import Materials'}</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={accent} accessible={false} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 16, borderRadius: 21, borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, shadowOpacity: 0.035, elevation: 1 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25 },
  description: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  startHint: { fontSize: 12, lineHeight: 18, marginTop: 12 },
  formats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 13, marginBottom: 13 },
  format: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  formatText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  action: { minHeight: 46, borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '800' },
});
