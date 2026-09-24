import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Header, Icon, Pill, PrimaryButton, Screen, SectionHeader } from '../components/ui';
import type { IconName } from '../components/ui';
import { useStudyBolt } from '../StudyBoltContext';

const WIDGETS: Array<{ icon: IconName; name: string; size: string; detail: string; preview: string; tone: 'blue' | 'gold' | 'mint' }> = [
  { icon: 'target', name: 'Study Focus', size: 'Small or medium', detail: 'Your next best session, due reviews, weak topics, and estimated time.', preview: 'Study next · 12 due · 18 min', tone: 'blue' },
  { icon: 'calendar-check-outline', name: 'Today’s Study Plan', size: 'Medium', detail: 'Keep your next study block and today’s progress visible.', preview: 'Keep your streak moving · 2/4 blocks', tone: 'gold' },
  { icon: 'book-open-page-variant-outline', name: 'Study Pack Progress', size: 'Large', detail: 'See your current pack and which study tools are ready.', preview: 'Biology 101 · 4/6 tools ready', tone: 'mint' },
];

export function WidgetsScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useStudyBolt();
  const [showSteps, setShowSteps] = useState(false);
  const ios = Platform.OS === 'ios';

  return (
    <Screen>
      <Header title="Study Widgets" subtitle="Your study plan at a glance" onBack={onBack} right={<Pill label={ios ? 'iOS' : 'PREVIEW'} tone={ios ? 'mint' : 'neutral'} />} />

      <Card style={[styles.hero, { backgroundColor: colors.primarySoft, borderColor: `${colors.primary}35` }]}>
        <View style={styles.heroRow}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}><Icon name="view-dashboard-outline" color={colors.primaryText} size={24} /></View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Keep the next step close</Text>
            <Text style={[styles.heroText, { color: colors.textSecondary }]}>StudyBolt widgets turn your plan and priorities into a calm glance before you open the app.</Text>
          </View>
        </View>
      </Card>

      <SectionHeader title="Choose a study view" />
      {WIDGETS.map((widget) => (
        <WidgetOption key={widget.name} widget={widget} colors={colors} />
      ))}

      <SectionHeader title="Add to your Home Screen" />
      <Card style={styles.instructionsCard}>
        <View style={styles.instructionHeader}>
          <View style={[styles.instructionIcon, { backgroundColor: colors.goldSoft }]}><Icon name="plus-circle-outline" color={colors.goldText} size={21} /></View>
          <View style={styles.heroCopy}>
            <Text style={[styles.instructionTitle, { color: colors.text }]}>{ios ? 'Add from your Home Screen' : 'iPhone widgets are ready to configure'}</Text>
            <Text style={[styles.instructionText, { color: colors.textSecondary }]}>{ios ? 'After installing the widget-enabled iOS build, add one from the Home Screen and choose the StudyBolt view that fits your routine.' : 'The widget gallery is available in the iOS build. Android support can be added separately without changing your study data.'}</Text>
          </View>
        </View>
        {ios ? <PrimaryButton label={showSteps ? 'Hide instructions' : 'How to add a widget'} icon={showSteps ? 'chevron-up' : 'plus'} onPress={() => setShowSteps((value) => !value)} style={styles.instructionsButton} /> : null}
        {showSteps ? (
          <View style={[styles.steps, { borderTopColor: colors.border }]}>
            <Step number="1" text="Long-press an empty area on your iPhone Home Screen." colors={colors} />
            <Step number="2" text="Tap Edit, then Add Widget, and search for StudyBolt." colors={colors} />
            <Step number="3" text="Choose a size, add it, then long-press it to switch views when available." colors={colors} last />
          </View>
        ) : null}
      </Card>

      <Text style={[styles.footer, { color: colors.textMuted }]}>Widget data follows the same local StudyBolt state as the app.</Text>
    </Screen>
  );
}

function WidgetOption({ widget, colors }: { widget: typeof WIDGETS[number]; colors: ReturnType<typeof useStudyBolt>['colors'] }) {
  const toneColor = widget.tone === 'mint' ? colors.mint : widget.tone === 'gold' ? colors.goldText : colors.primary;
  const toneBackground = widget.tone === 'mint' ? colors.mintSoft : widget.tone === 'gold' ? colors.goldSoft : colors.primarySoft;
  return (
    <Card style={[styles.widgetCard, { borderColor: colors.border }]}>
      <View style={styles.widgetHeader}>
        <View style={[styles.widgetIcon, { backgroundColor: toneBackground }]}><Icon name={widget.icon} size={21} color={toneColor} /></View>
        <View style={styles.heroCopy}>
          <Text style={[styles.widgetName, { color: colors.text }]}>{widget.name}</Text>
          <Text style={[styles.widgetSize, { color: toneColor }]}>{widget.size}</Text>
        </View>
        <Icon name="check-circle-outline" color={colors.mint} size={20} />
      </View>
      <Text style={[styles.widgetDetail, { color: colors.textSecondary }]}>{widget.detail}</Text>
      <View style={[styles.preview, { backgroundColor: toneBackground }]}>
        <Text style={[styles.previewLabel, { color: toneColor }]}>STUDYBOLT</Text>
        <Text numberOfLines={1} style={[styles.previewText, { color: colors.text }]}>{widget.preview}</Text>
      </View>
    </Card>
  );
}

function Step({ number, text, colors, last = false }: { number: string; text: string; colors: ReturnType<typeof useStudyBolt>['colors']; last?: boolean }) {
  return (
    <View style={[styles.step, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.stepNumber, { backgroundColor: colors.primarySoft }]}><Text style={[styles.stepNumberText, { color: colors.primary }]}>{number}</Text></View>
      <Text style={[styles.stepText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 15 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 14, fontWeight: '900' },
  heroText: { fontSize: 10, lineHeight: 15, marginTop: 4 },
  widgetCard: { padding: 14, marginBottom: 10 },
  widgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  widgetIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  widgetName: { fontSize: 13, fontWeight: '900' },
  widgetSize: { fontSize: 9, fontWeight: '800', marginTop: 2 },
  widgetDetail: { fontSize: 10, lineHeight: 15, marginTop: 11 },
  preview: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 11 },
  previewLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  previewText: { fontSize: 11, fontWeight: '900', marginTop: 3 },
  instructionsCard: { padding: 14 },
  instructionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  instructionTitle: { fontSize: 13, fontWeight: '900' },
  instructionText: { fontSize: 10, lineHeight: 15, marginTop: 3 },
  instructionsButton: { minHeight: 44, marginTop: 13 },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 4 },
  step: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, fontSize: 10, lineHeight: 14 },
  footer: { textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 18, marginBottom: 28 },
});
