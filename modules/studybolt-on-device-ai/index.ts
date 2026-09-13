import { requireOptionalNativeModule } from 'expo-modules-core';

export interface NativeOnDeviceAIAvailability {
  status: 'available' | 'downloadable' | 'downloading' | 'unavailable';
  provider: 'apple-intelligence' | 'gemini-nano';
  reason: string;
}

export interface NativeOnDeviceAIResult {
  text: string;
  provider: 'apple-intelligence' | 'gemini-nano';
}

interface StudyBoltOnDeviceAINativeModule {
  getAvailability(): Promise<NativeOnDeviceAIAvailability>;
  downloadModel(): Promise<NativeOnDeviceAIAvailability>;
  generate(prompt: string, instructions: string): Promise<NativeOnDeviceAIResult>;
}

export default requireOptionalNativeModule<StudyBoltOnDeviceAINativeModule>('StudyBoltOnDeviceAI');
