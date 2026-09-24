import type { StudyBoltState } from '../models';

/** Web and Android keep the app fully functional until native widget support is enabled there. */
export function updateStudyBoltWidgets(_state: StudyBoltState): void {
  // Intentionally empty on platforms without the iOS widget runtime.
}
