declare global {
  interface Window {
    EnglishFlowDevice?: {
      readState?(): string;
      saveState?(json: string): boolean;
      speak(text: string): boolean;
      speakAccent?(text: string, accent: string): boolean;
      download(name: string, text: string): boolean;
      record(): void;
      stopRecording(): void;
      playRecording(): void;
      stopAudio(): void;
      assessPronunciation?(text: string, requestId: string): void;
      cancelAssessment?(): void;
    };
    englishFlowBack?: () => boolean;
  }
}
export const device = () => window.EnglishFlowDevice;
