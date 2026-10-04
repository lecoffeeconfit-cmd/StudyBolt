import { requireOptionalNativeModule } from 'expo-modules-core';

interface StudyBoltBackgroundPlaybackNativeModule {
  start(title: string): Promise<void>;
  stop(): Promise<void>;
}

export default requireOptionalNativeModule<StudyBoltBackgroundPlaybackNativeModule>('StudyBoltBackgroundPlayback');
