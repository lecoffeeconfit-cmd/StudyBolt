import { LinearGradient } from 'expo-linear-gradient';
import React, { memo } from 'react';
import { View } from 'react-native';

import { useStudyBolt } from '../StudyBoltContext';
import { classIconColors, getClassIcon } from '../data/classIcons';
import type { StudyClass, StudyPack } from '../models';
import { SubjectIcon } from './SubjectIcon';
import { Icon } from './ui';

type ClassAppearance = Pick<StudyClass, 'name'> & Partial<Pick<StudyClass, 'iconId' | 'emoji' | 'color'>>;

export const ClassIcon = memo(function ClassIcon({ course, size = 40 }: { course: ClassAppearance; size?: number }) {
  const { colors } = useStudyBolt();
  const option = getClassIcon(course.iconId);
  if (!option || 'illustration' in option) {
    return <SubjectIcon subject={course.name} emoji={course.emoji} illustration={option?.illustration} size={size} animated={false} />;
  }

  const palette = classIconColors(option, colors.mode, course.color, colors.cardStrong);
  return (
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, flexShrink: 0 }} pointerEvents="none">
      <LinearGradient colors={palette.surface} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Math.round(size * 0.31), borderWidth: 1, borderColor: palette.rim }}>
        <Icon name={option.glyph} size={Math.round(size * 0.54)} color={palette.ink} />
      </LinearGradient>
    </View>
  );
});

/** Use on class cards and class selectors. Study Pack and community artwork are separate. */
export function ClassIdentity({ course, size = 40, hasAccent = false }: { course: ClassAppearance; size?: number; hasAccent?: boolean }) {
  const { state, colors } = useStudyBolt();
  if (state.classDisplayStyle !== 'minimal') return <ClassIcon course={course} size={size} />;
  if (hasAccent) return null;
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{
    width: 4, height: Math.round(size * 0.74), flexShrink: 0, borderRadius: 3, backgroundColor: course.color || colors.primary,
  }} />;
}

/** Personal packs reflect their class's current icon without rewriting the pack. */
export function PackClassIcon({ pack, size = 40 }: { pack: Pick<StudyPack, 'courseId' | 'courseName' | 'emoji' | 'color'>; size?: number }) {
  const { state } = useStudyBolt();
  const course = state.classes.find(item => item.id === pack.courseId);
  return <ClassIcon course={course && getClassIcon(course.iconId) ? course : { name: pack.courseName, emoji: pack.emoji, color: pack.color }} size={size} />;
}
