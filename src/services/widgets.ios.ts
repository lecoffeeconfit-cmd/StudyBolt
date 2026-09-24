import type { StudyBoltState } from '../models';
import { buildSmartStudyBrief } from './adaptiveStudy';

type SnapshotWidget<Props extends object> = {
  updateSnapshot: (props: Props) => void;
};

type StudyFocusWidgetProps = {
  title: string;
  subtitle: string;
  dueReviews: number;
  weakTopics: number;
  minutes: number;
};

type StudyPlanWidgetProps = {
  dayLabel: string;
  nextBlock: string;
  completedBlocks: number;
  totalBlocks: number;
  minutes: number;
};

type StudyPackWidgetProps = {
  courseName: string;
  title: string;
  readyTools: number;
  totalTools: number;
  dueReviews: number;
  prompt: string;
};

type WidgetModule<Props extends object> = { default: SnapshotWidget<Props> };

let widgets: {
  focus: SnapshotWidget<StudyFocusWidgetProps>;
  plan: SnapshotWidget<StudyPlanWidgetProps>;
  pack: SnapshotWidget<StudyPackWidgetProps>;
} | null = null;

try {
  // Expo Go does not include the native widget runtime. Keep this guarded so
  // the main app remains usable until it is installed through a development or
  // production build that includes the widget extension.
  const focus = require('../../widgets/StudyFocusWidget') as WidgetModule<StudyFocusWidgetProps>;
  const plan = require('../../widgets/StudyPlanWidget') as WidgetModule<StudyPlanWidgetProps>;
  const pack = require('../../widgets/StudyPackWidget') as WidgetModule<StudyPackWidgetProps>;
  widgets = { focus: focus.default, plan: plan.default, pack: pack.default };
} catch {
  widgets = null;
}

function isToday(value?: string): boolean {
  if (!value) return false;
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

export function updateStudyBoltWidgets(state: StudyBoltState): void {
  if (!widgets) return;

  try {
    const brief = buildSmartStudyBrief(state);
    const nextItem = brief.items[0];
    const today = state.plan.days.find((day) => isToday(day.date))
      ?? state.plan.days.find((day) => !day.complete)
      ?? state.plan.days[0];
    const recentDeck = [...state.decks].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    const totalTools = recentDeck?.generation ? Object.keys(recentDeck.generation.materials).length : 6;
    const readyTools = recentDeck?.generation
      ? Object.values(recentDeck.generation.materials).filter((material) => material.status === 'ready').length
      : 6;

    widgets.focus.updateSnapshot({
      title: nextItem?.sourceLabel ?? (recentDeck?.courseName || 'Choose a study pack'),
      subtitle: nextItem?.reason ?? 'A focused session is ready when you are.',
      dueReviews: brief.dueReviews,
      weakTopics: brief.weakTopics,
      minutes: brief.estimatedMinutes,
    });

    widgets.plan.updateSnapshot({
      dayLabel: today?.label ?? 'Ready when you are',
      nextBlock: today?.blocks.find((block) => !block.complete)?.label ?? 'Choose your next study block',
      completedBlocks: today?.blocks.filter((block) => block.complete).length ?? 0,
      totalBlocks: today?.blocks.length ?? 0,
      minutes: today?.minutes ?? brief.estimatedMinutes,
    });

    widgets.pack.updateSnapshot({
      courseName: recentDeck?.courseName ?? 'StudyBolt',
      title: recentDeck?.title ?? 'Your Study Pack',
      readyTools,
      totalTools,
      dueReviews: brief.dueReviews,
      prompt: nextItem ? `Next up: ${nextItem.sourceLabel}` : 'Your next best session is ready.',
    });
  } catch {
    // Expo Go and older builds may not contain the native widget runtime.
    widgets = null;
  }
}
