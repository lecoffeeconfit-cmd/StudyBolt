export type VoiceSessionState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'ended';
export type VoiceCommand = 'pause' | 'continue' | 'repeat' | 'back' | 'skip' | 'exit' | 'unknown';

/** Pure command parsing keeps the hands-free controller testable and offline. */
export function parseVoiceCommand(transcript: string): VoiceCommand {
  const value = transcript.trim().toLowerCase();
  if (!value) return 'unknown';
  if (/\b(stop|pause|hold)\b/.test(value)) return 'pause';
  if (/\b(continue|resume|play|start)\b/.test(value)) return 'continue';
  if (/\b(repeat|again|say that again)\b/.test(value)) return 'repeat';
  if (/\b(back|previous|go back)\b/.test(value)) return 'back';
  if (/\b(skip|next|forward)\b/.test(value)) return 'skip';
  if (/\b(exit|leave|close|done)\b/.test(value)) return 'exit';
  return 'unknown';
}

export function interactionStateLabel(state: VoiceSessionState): string {
  switch (state) {
    case 'listening': return 'Listening';
    case 'thinking': return 'Thinking';
    case 'speaking': return 'StudyBolt is speaking';
    case 'paused': return 'Paused';
    case 'ended': return 'Session ended';
    default: return 'Ready when you are';
  }
}

export interface BrowserSpeechInput {
  stop: () => void;
}

/** Optional web adapter. Native builds intentionally return null until a speech
 * recognizer module is installed and granted microphone permission. */
export function startBrowserSpeechInput(onTranscript: (transcript: string) => void, onError?: () => void): BrowserSpeechInput | null {
  if (typeof window === 'undefined') return null;
  const browserWindow = window as typeof window & { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event: any) => onTranscript(String(event.results?.[0]?.[0]?.transcript ?? ''));
  recognition.onerror = () => onError?.();
  try { recognition.start(); } catch { onError?.(); return null; }
  return { stop: () => { try { recognition.stop(); } catch { /* already stopped */ } } };
}
