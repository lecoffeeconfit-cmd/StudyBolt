import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { background, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type StudyPlanWidgetProps = {
  dayLabel: string;
  nextBlock: string;
  completedBlocks: number;
  totalBlocks: number;
  minutes: number;
};

function StudyPlanWidget(props: StudyPlanWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const backgroundColor = dark ? '#202B3B' : '#F0F5FF';
  const text = dark ? '#F5F8FC' : '#111C4E';
  const muted = dark ? '#C4CFDC' : '#536080';
  const accent = dark ? '#8FB8FF' : '#1678FF';

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 15 }), background(backgroundColor), cornerRadius(20)]}>
      <HStack spacing={8}>
        <Text modifiers={[font({ size: 11, weight: 'bold', design: 'rounded' }), foregroundStyle(accent)]}>TODAY’S PLAN</Text>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(muted)]}>{props.dayLabel}</Text>
      </HStack>
      <Text modifiers={[font({ size: 21, weight: 'black', design: 'rounded' }), foregroundStyle(text)]}>Keep your streak moving</Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(muted)]}>{props.nextBlock}</Text>
      <HStack spacing={12}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(text)]}>{props.completedBlocks}/{props.totalBlocks} blocks</Text>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(text)]}>{props.minutes} min planned</Text>
      </HStack>
    </VStack>
  );
}

export default createWidget('StudyPlanWidget', StudyPlanWidget);
