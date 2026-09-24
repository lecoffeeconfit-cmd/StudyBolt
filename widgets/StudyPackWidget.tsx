import { Text, VStack } from '@expo/ui/swift-ui';
import { background, cornerRadius, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type StudyPackWidgetProps = {
  courseName: string;
  title: string;
  readyTools: number;
  totalTools: number;
  dueReviews: number;
  prompt: string;
};

function StudyPackWidget(props: StudyPackWidgetProps, environment: WidgetEnvironment) {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const backgroundColor = dark ? '#172E2A' : '#E7F8F2';
  const text = dark ? '#F5F8FC' : '#111C4E';
  const muted = dark ? '#C4D8D0' : '#536080';
  const accent = dark ? '#78C9AE' : '#138265';

  return (
    <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 17 }), background(backgroundColor), cornerRadius(20)]}>
      <Text modifiers={[font({ size: 11, weight: 'bold', design: 'rounded' }), foregroundStyle(accent)]}>{props.courseName.toUpperCase()}</Text>
      <Text modifiers={[font({ size: 22, weight: 'black', design: 'rounded' }), foregroundStyle(text)]}>{props.title}</Text>
      <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(muted)]}>{props.prompt}</Text>
      <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(text)]}>{props.readyTools}/{props.totalTools} study tools ready · {props.dueReviews} reviews waiting</Text>
    </VStack>
  );
}

export default createWidget('StudyPackWidget', StudyPackWidget);
