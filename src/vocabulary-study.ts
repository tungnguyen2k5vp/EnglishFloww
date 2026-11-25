import type { AppState, SavedWord, VocabSession, VocabSettings, VocabTask, Word } from "./model.ts";
import { words } from "./data.ts";
import { DAY, newSaved, normalize } from "./domain.ts";
import { normalizeDictionaryInput } from "./english-morphology.ts";

// APK 10.4.16: t0 constants + SpacedRepetition.getNextMemoLevel; retain existing due dates until answered.
export function scheduleVocabulary(card: SavedWord, correct: boolean, now = Date.now()): SavedWord {
  const repetitions = correct ? Math.min(11, card.repetitions + 1) : card.repetitions ? Math.max(1, card.repetitions - 1) : 0;
  const interval = !correct || repetitions === 1 ? 2 / 24 : [0, 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89][repetitions];
  return { ...card, repetitions, interval, due: now + interval * DAY, lapses: card.lapses + Number(!correct) };
}

export const defaultVocabSettings = (): VocabSettings => ({
  fresh: { limit: 5, writing: 2, listening: 1, word: 1, meaning: 1 },
  review: { limit: 5, writing: 1, listening: 1, word: 1, meaning: 1 },
  firstWriting: true, random: false, autoAudio: false, context: false,
});
export const vocabWords = (s: AppState) => [...words, ...s.customWords];
export function collectionWords(s: AppState, id: string | null) {
  const ids = new Set([...(id ? s.collections.find(c => c.id === id)?.wordIds ?? [] : s.collections.flatMap(c => c.wordIds)), ...Object.values(s.saved).filter(w => !id || w.collectionId === id).map(w => w.wordId)]);
  const dictionary = new Map(vocabWords(s).map(w => [w.id, w]));
  return [...ids].map(id => dictionary.get(id)).filter((w): w is Word => !!w);
}
export function eligibleWords(s: AppState, id: string | null, kind: "learn" | "review", now = Date.now()) {
  return collectionWords(s, id).filter(w => w.meaning.trim() && (kind === "learn" ? !s.saved[w.id] || s.saved[w.id].repetitions === 0 : s.saved[w.id]?.due <= now));
}
export function startStudy(s: AppState, id: string | null, kind: "learn" | "review", now = Date.now(), selected?: string[]): VocabSession {
  const settings = s.vocabulary?.settings ?? defaultVocabSettings();
  const config = kind === "learn" ? settings.fresh : settings.review;
  let pool = eligibleWords(s, id, kind, now);
  if (selected) pool = selected.map(id => pool.find(w => w.id === id)).filter((w): w is Word => !!w);
  if (kind === "review") pool.sort((a, b) => s.saved[a.id].due - s.saved[b.id].due);
  if (kind === "learn" && settings.random) {
    pool = [...pool];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  }
  const wordIds = pool.slice(0, config.limit).map(w => w.id);
  const tasks: VocabTask[] = [];
  if (kind === "learn") for (const wordId of wordIds) { if (!selected) tasks.push({ wordId, mode: "intro" }); if (settings.firstWriting) tasks.push({ wordId, mode: "copy" }); }
  for (const mode of ["meaning", "word", "listening", "writing"] as const) for (let i = 0; i < config[mode]; i++) for (const wordId of wordIds) tasks.push({ wordId, mode });
  if (settings.context) for (const w of pool.slice(0, config.limit)) if (contextPrompt(w)) tasks.push({ wordId: w.id, mode: "context" });
  return { id: crypto.randomUUID(), collectionId: id ?? "", kind, started: now, wordIds, tasks, index: 0, answer: "", checked: false, correct: false, mistakes: [], skipped: [], committed: [], attempts: 0, hits: 0 };
}
export function contextPrompt(w: Word) {
  // ponytail: only exact term occurrences become gaps; inflected examples need a lemmatizer.
  const escaped = w.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(?<![a-z])" + escaped + "(?![a-z])", "ig");
  return re.test(w.example) ? w.example.replace(re, "______") : "";
}
export function expectedAnswer(task: VocabTask, word: Word) { return task.mode === "meaning" ? word.meaning : word.term; }
export function checkStudy(s: AppState, sessionId: string, index: number, answer: string): AppState {
  const session = s.vocabulary?.session;
  if (!session || session.id !== sessionId || session.index !== index || session.checked || !answer.trim()) return s;
  const task = session.tasks[index], word = vocabWords(s).find(w => w.id === task?.wordId);
  if (!word) return s;
  const correct = task.mode === "intro" || (task.mode === "meaning" ? normalize(answer) === normalize(word.meaning) : normalizeDictionaryInput(answer) === normalizeDictionaryInput(word.term));
  const counted = !["intro", "copy"].includes(task.mode);
  return { ...s, vocabulary: { ...s.vocabulary!, session: { ...session, answer: answer.slice(0, 500), checked: true, correct, attempts: session.attempts + Number(counted), hits: session.hits + Number(counted && correct), mistakes: correct || session.mistakes.includes(word.id) ? session.mistakes : [...session.mistakes, word.id] } } };
}
export function advanceStudy(s: AppState, sessionId: string, index: number, skip = false, now = Date.now()): AppState {
  const current = s.vocabulary?.session;
  if (!current || current.id !== sessionId || current.index !== index || (!skip && !current.checked)) return s;
  const task = current.tasks[index];
  if (!task) return s;
  let tasks = [...current.tasks];
  const failed = skip || !current.correct && tasks.filter(t => t.wordId === task.wordId && t.retry).length >= 4;
  if (failed) tasks = tasks.filter((t, i) => i <= index || t.wordId !== task.wordId);
  else if (!current.correct) tasks.push({ ...task, retry: true });
  const session = { ...current, tasks, index: index + 1, answer: "", checked: false, correct: false, skipped: failed ? [...new Set([...current.skipped, task.wordId])] : current.skipped };
  const saved = { ...s.saved }, events = [...s.events];
  if (!session.committed.includes(task.wordId) && !tasks.slice(session.index).some(t => t.wordId === task.wordId)) {
    const card = saved[task.wordId] ?? newSaved(task.wordId, current.collectionId || s.collections.find(c => c.wordIds.includes(task.wordId))?.id || s.collections[0].id, now);
    const failed = session.skipped.includes(task.wordId);
    saved[task.wordId] = scheduleVocabulary(card, !failed, now);
    events.push({ id: current.id + ":" + index, kind: "review", at: now, target: task.wordId, correct: !failed && !session.mistakes.includes(task.wordId) });
    session.committed = [...session.committed, task.wordId];
  }
  return { ...s, saved, events, vocabulary: { ...s.vocabulary!, session } };
}
export function studyChoices(s: AppState, task: VocabTask, index: number) {
  const all = vocabWords(s), ids = s.vocabulary?.session?.wordIds ?? [];
  const dictionary = [...ids.map(id => all.find(w => w.id === id)!).filter(Boolean), ...all.filter(w => !ids.includes(w.id))], word = dictionary.find(w => w.id === task.wordId)!;
  const answer = expectedAnswer(task, word);
  const options = [answer, ...new Set(dictionary.filter(w => w.id !== word.id).map(w => task.mode === "meaning" ? w.meaning : w.term).filter(t => t.trim() && normalize(t) !== normalize(answer)))].slice(0, 4);
  return options.map((_, i) => options[(i + index + 1) % options.length]);
}
export function parseWordLines(text: string) {
  const lines = text.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  if (lines.length > 100) throw Error("Mỗi bộ từ chỉ được thêm tối đa 100 từ một lần.");
  if (lines.some(t => t.length > 100 || /[\u0000-\u001f]/.test(t))) throw Error("Mỗi dòng cần một từ hoặc cụm từ, tối đa 100 ký tự.");
  return [...new Map(lines.map(t => [normalize(t), t])).values()];
}

export function validVocabulary(value: unknown, ids: Set<string>, collections: Set<string>): boolean {
  if (!value || typeof value !== "object") return false;
  const { settings, session: x } = value as NonNullable<AppState["vocabulary"]>;
  if (!settings || !["fresh", "review"].every(k => { const c = settings[k as "fresh" | "review"]; return c && Number.isInteger(c.limit) && c.limit >= 1 && c.limit <= 20 && [c.meaning, c.word, c.listening, c.writing].every(n => Number.isInteger(n) && n >= 0 && n <= 5) && c.meaning + c.word + c.listening + c.writing > 0; }) || ![settings.firstWriting, settings.random, settings.autoAudio, settings.context].every(v => typeof v === "boolean")) return false;
  const list = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 20 && v.every(id => typeof id === "string" && ids.has(id)) && new Set(v).size === v.length;
  return x === undefined || !!x && typeof x.id === "string" && x.id.length <= 100 && typeof x.collectionId === "string" && (!x.collectionId || collections.has(x.collectionId)) && ["learn", "review"].includes(x.kind) && Number.isFinite(x.started) && x.started >= 0 && list(x.wordIds) && list(x.mistakes) && list(x.skipped) && list(x.committed) && [x.mistakes, x.skipped, x.committed].every(a => a.every(id => x.wordIds.includes(id))) && Array.isArray(x.tasks) && x.tasks.length <= 20000 && x.tasks.every(t => t && x.wordIds.includes(t.wordId) && ["intro", "copy", "meaning", "word", "listening", "writing", "context"].includes(t.mode) && (t.retry === undefined || typeof t.retry === "boolean")) && Number.isInteger(x.index) && x.index >= 0 && x.index <= x.tasks.length && typeof x.answer === "string" && x.answer.length <= 1000 && typeof x.checked === "boolean" && typeof x.correct === "boolean" && [x.attempts, x.hits].every(n => Number.isInteger(n) && n >= 0) && x.hits <= x.attempts;
}
