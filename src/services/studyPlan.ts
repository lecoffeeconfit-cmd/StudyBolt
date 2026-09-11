import { StudyPack, StudyPlan, StudyPlanDay } from '../models';
import { calculateMastery } from './mastery';

const TARGET_DAYS: Record<StudyPlan['target'], number> = {
  tomorrow: 1,
  'two-days': 2,
  'one-week': 7,
  custom: 4,
};

export function buildStudyPlan(target: StudyPlan['target'], decks: StudyPack[]): StudyPlan {
  const days = TARGET_DAYS[target];
  const materialUnits = decks.reduce((sum, deck) => sum + deck.pageCount + deck.flashcards.length * 1.5, 0);
  const averageMastery = decks.length
    ? decks.reduce((sum, deck) => sum + calculateMastery(deck).overall, 0) / decks.length
    : 0;
  const totalMinutes = Math.max(45, Math.round(materialUnits * (1.25 - averageMastery / 160)));
  const minutesPerDay = Math.max(20, Math.ceil(totalMinutes / days / 5) * 5);

  const planDays: StudyPlanDay[] = Array.from({ length: days }, (_, index) => {
    const isLast = index === days - 1;
    const noteMinutes = Math.max(10, Math.round(minutesPerDay * (isLast ? 0.2 : 0.35)));
    const cardMinutes = Math.max(10, Math.round(minutesPerDay * 0.35));
    const quizMinutes = Math.max(10, minutesPerDay - noteMinutes - cardMinutes);
    return {
      id: `plan-${target}-${index}`,
      label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : `Day ${index + 1}`,
      subtitle: isLast ? 'Retrieve first, then review weak spots' : 'Short, focused study blocks',
      minutes: noteMinutes + cardMinutes + quizMinutes,
      complete: false,
      blocks: [
        { label: isLast ? 'Weak Concepts' : 'Simplified Notes', minutes: noteMinutes },
        { label: 'Active Recall Cards', minutes: cardMinutes },
        { label: isLast ? 'Exam Review Quiz' : 'Practice Quiz', minutes: quizMinutes },
      ],
    };
  });

  return { target, remindersEnabled: true, days: planDays };
}
