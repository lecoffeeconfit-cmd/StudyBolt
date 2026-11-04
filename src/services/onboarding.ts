import type { StudyPack } from '../models';

export const ONBOARDING_SAMPLE_ID = 'biology-cells';

/** A sample action must never fall back to a student's own material. */
export function findOnboardingSample(decks: StudyPack[]): StudyPack | null {
  return decks.find((deck) => (deck.id === ONBOARDING_SAMPLE_ID || deck.id.startsWith(`${ONBOARDING_SAMPLE_ID}-onboarding-`)) && deck.fileType === 'demo' && deck.flashcards.length > 0) ?? null;
}

/** Restore the bundled demo under a free ID so a collision cannot replace personal content. */
export function resolveOnboardingSample(decks: StudyPack[], bundledDecks: StudyPack[]): StudyPack | null {
  const existing = findOnboardingSample(decks);
  if (existing) return existing;
  const bundled = findOnboardingSample(bundledDecks);
  if (!bundled) return null;
  let id = bundled.id;
  let suffix = 1;
  while (decks.some((deck) => deck.id === id)) id = `${ONBOARDING_SAMPLE_ID}-onboarding-${suffix++}`;
  return { ...bundled, id };
}
