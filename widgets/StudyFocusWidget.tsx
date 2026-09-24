import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { background, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type StudyFocusWidgetProps = {
  title: string;
  subtitle: string;
  dueReviews: number;
  weakTopics: number;
  minutes: number;
};

function StudyFocusWidget(props: StudyFocusWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const backgroundColor = dark ? '#17243A' : '#EAF3FF';
  const primary = dark ? '#F4C44E' : '#8A5A00';
  const text = dark ? '#F5F8FC' : '#111C4E';
  const muted = dark ? '#C4CFDC' : '#536080';
  const compact = environment.widgetFamily === 'systemSmall';

  return (
    <VStack
      alignment="leading"
      spacing={compact ? 5 : 7}
      modifiers={[padding({ all: compact ? 12 : 15 }), background(backgroundColor), cornerRadius(20)]}
    >
      <Text modifiers={[font({ size: 11, weight: 'bold', design: 'rounded' }), foregroundStyle(primary)]}>STUDYBOLT</Text>
      <Text modifiers={[font({ size: compact ? 18 : 21, weight: 'black', design: 'rounded' }), foregroundStyle(text)]}>{compact ? 'Study next' : 'Your next best session'}</Text>
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(muted)]}>{props.title}</Text>
      {!compact ? <Text modifiers={[font({ size: 11 }), foregroundStyle(muted)]}>{props.subtitle}</Text> : null}
      <HStack spacing={10}>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(text)]}>{props.dueReviews} due</Text>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(text)]}>{props.weakTopics} weak</Text>
        <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle(text)]}>{props.minutes} min</Text>
      </HStack>
    </VStack>
  );
}

export default createWidget('StudyFocusWidget', StudyFocusWidget);
