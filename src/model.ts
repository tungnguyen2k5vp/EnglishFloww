export type Level = "A2" | "B1" | "B2";
export type Word = {
  id: string;
  term: string;
  ipa: string;
  pos: string;
  meaning: string;
  example: string;
  level: Level;
  topic: string;
  source?: string;
  lemma?: string;
  pronunciations?: { ipa: string; region: string }[];
};
export type Question = {
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};
export type Article = {
  credits?: string[];
  id: string;
  title: string;
  subtitle: string;
  level: Level;
  topic: string;
  kind: string;
  scene: string;
  minutes: number;
  paragraphs: { en: string; vi: string }[];
  questions: Question[];
};
export type Segment = { start: number; end: number; en: string; vi: string; prompt?: string; promptVi?: string; hint?: string };
export type MediaLesson = {
  credits?: string[];
  id: string;
  title: string;
  description: string;
  level: Level;
  topic: string;
  type: "audio" | "video";
  src: string;
  duration: string;
  scene: string;
  segments: Segment[];
  questions: Question[];
};
export type GrammarLesson = {
  id: string;
  title: string;
  category: string;
  level: Level;
  explanation: string;
  formula: string;
  examples: string[];
  questions: Question[];
};
export type SavedWord = {
  wordId: string;
  collectionId: string;
  note: string;
  due: number;
  interval: number;
  ease: number;
  repetitions: number;
  lapses: number;
  added: number;
};
export type Collection = {
  id: string;
  name: string;
  description: string;
  level: Level;
  topic: string;
  wordIds: string[];
};
export type StudyEvent = {
  id: string;
  at: number;
  kind: "review" | "reading" | "listening" | "grammar" | "practice" | "time";
  target: string;
  correct?: boolean;
  seconds?: number;
  score?: number;
  total?: number;
  mistakes?: string[];
};
export type AppState = {
  writing?: Record<string, { text: string; elapsed: number; submitted?: boolean; checked?: boolean }>;
  vocabulary?: { settings: VocabSettings; session?: VocabSession };
  version: 1;
  profile: {
    name: string;
    goal: number;
    level: Level;
    theme: "light" | "dark";
  };
  saved: Record<string, SavedWord>;
  collections: Collection[];
  customWords: Word[];
  bookmarks: string[];
  reading: Record<string, number>;
  media: Record<string, number>;
  searches: string[];
  events: StudyEvent[];
};
export type VocabMode = "meaning" | "word" | "listening" | "writing" | "context";
export type VocabSettings = {
  fresh: { limit: number; meaning: number; word: number; listening: number; writing: number };
  review: { limit: number; meaning: number; word: number; listening: number; writing: number };
  firstWriting: boolean; random: boolean; autoAudio: boolean; context: boolean;
};
export type VocabTask = { wordId: string; mode: VocabMode | "intro" | "copy"; retry?: boolean };
export type VocabSession = {
  id: string; collectionId: string; kind: "learn" | "review"; started: number;
  wordIds: string[]; tasks: VocabTask[]; index: number; answer: string;
  checked: boolean; correct: boolean; mistakes: string[]; skipped: string[];
  committed: string[]; attempts: number; hits: number;
};
