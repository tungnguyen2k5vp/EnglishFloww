import { seedCollections, words } from "./data.ts";
import type { AppState, SavedWord, StudyEvent, Word } from "./model.ts";
import { validVocabulary } from "./vocabulary-study.ts";
export const DAY = 86_400_000;
export const STORAGE_KEY = "englishflow.v1";
export const initialState = (): AppState => ({
  version: 1,
  profile: { name: "Bạn", goal: 15, level: "B1", theme: "light" },
  saved: {},
  collections: structuredClone(seedCollections),
  customWords: [],
  bookmarks: [],
  reading: {},
  media: {},
  searches: [],
  events: [],
});
export const normalize = (s: string) =>
  s
    .normalize("NFC")
    .replace(/[’ʼ]/gu, "'")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ");
export const dayKey = (at: number) => new Date(at).toLocaleDateString("en-CA");
export function newSaved(
  wordId: string,
  collectionId: string,
  now = Date.now(),
): SavedWord {
  return {
    wordId,
    collectionId,
    note: "",
    due: now,
    interval: 0,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
    added: now,
  };
}
// SM-2, with Again/Hard/Good/Easy mapped to quality 1/3/4/5. A failed card returns in 10 minutes.
export function schedule(
  card: SavedWord,
  quality: 1 | 3 | 4 | 5,
  now = Date.now(),
): SavedWord {
  const ease = Math.max(
    1.3,
    card.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02),
  );
  const repetitions = quality < 3 ? 0 : card.repetitions + 1;
  const interval =
    quality < 3
      ? 0
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.max(1, Math.round(card.interval * ease));
  return {
    ...card,
    ease,
    repetitions,
    interval,
    due: now + (quality < 3 ? 600_000 : interval * DAY),
    lapses: card.lapses + (quality < 3 ? 1 : 0),
  };
}
export const event = (
  kind: StudyEvent["kind"],
  target: string,
  extra: Partial<StudyEvent> = {},
): StudyEvent => ({
  id: crypto.randomUUID(),
  at: Date.now(),
  kind,
  target,
  ...extra,
});
export function statistics(state: AppState, now = Date.now()) {
  const today = dayKey(now);
  const reviews = state.events.filter((e) => e.kind === "review");
  const days = new Set(state.events.map((e) => dayKey(e.at)));
  const cursor = new Date(now);
  let streak = 0;
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const seconds = state.events
    .filter((e) => e.kind === "time")
    .reduce((n, e) => n + (e.seconds ?? 0), 0);
  const todaySeconds = state.events
    .filter((e) => e.kind === "time" && dayKey(e.at) === today)
    .reduce((n, e) => n + (e.seconds ?? 0), 0);
  return {
    streak,
    seconds,
    todaySeconds,
    due: Object.values(state.saved).filter((c) => c.due <= now).length,
    learned: Object.values(state.saved).filter((c) => c.repetitions > 0).length,
    accuracy: reviews.length
      ? Math.round(
          (reviews.filter((e) => e.correct).length / reviews.length) * 100,
        )
      : 0,
    reviews: reviews.length,
    completed: new Set(
      state.events
        .filter((e) => ["reading", "grammar", "listening"].includes(e.kind))
        .map((e) => e.target.split(":")[0]),
    ).size,
  };
}
function fail(): never {
  throw new Error(
    "Tệp dữ liệu không hợp lệ hoặc không đúng phiên bản EnglishFlow. Dữ liệu hiện tại chưa bị thay đổi.",
  );
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 500): v is string =>
  typeof v === "string" && v.length <= max;
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const level = (v: unknown) => ["A2", "B1", "B2"].includes(v as string);
const safeId = (v: unknown): v is string =>
  str(v, 100) &&
  v.length > 0 &&
  !["__proto__", "constructor", "prototype"].includes(v);
export function validateWord(v: unknown): v is Word {
  return (
    record(v) &&
    safeId(v.id) &&
    str(v.term, 100) &&
    v.term.trim().length > 0 &&
    str(v.ipa, 150) &&
    str(v.pos, 50) &&
      str(v.meaning, 1000) &&
    str(v.example, 1000) &&
    level(v.level) &&
      str(v.topic, 100) &&
      (v.source === undefined || str(v.source, 200)) &&
      (v.lemma === undefined || str(v.lemma, 100)) &&
      (v.pronunciations === undefined || Array.isArray(v.pronunciations) && v.pronunciations.length <= 20 && v.pronunciations.every(p => record(p) && str(p.ipa, 150) && str(p.region, 100)))
  );
}
export function validateState(value: unknown): AppState {
  if (!record(value) || value.version !== 1 || !record(value.profile)) fail();
  const p = value.profile;
  if (
    !str(p.name, 60) ||
    !num(p.goal) ||
    (p.goal as number) < 5 ||
    (p.goal as number) > 120 ||
    !level(p.level) ||
    !["light", "dark"].includes(p.theme as string)
  )
    fail();
  if (
    !Array.isArray(value.customWords) ||
    value.customWords.length > 10000 ||
    !value.customWords.every(validateWord)
  )
    fail();
  const ids = new Set(
    [...words, ...(value.customWords as Word[])].map((w) => w.id),
  );
  if (
    new Set((value.customWords as Word[]).map((w) => w.id)).size !==
      value.customWords.length ||
    (value.customWords as Word[]).some((w) =>
      words.some((seed) => seed.id === w.id),
    )
  )
    fail();
  if (
    !Array.isArray(value.collections) ||
    !value.collections.length ||
    !value.collections.every(
      (c) =>
        record(c) &&
        safeId(c.id) &&
        str(c.name, 80) &&
        c.name.trim().length > 0 &&
        str(c.description, 500) &&
        level(c.level) &&
        str(c.topic, 100) &&
        Array.isArray(c.wordIds) &&
        c.wordIds.every((id) => str(id) && ids.has(id)),
    )
  )
    fail();
  const collectionIds = new Set(value.collections.map((c) => c.id));
  if (value.writing !== undefined && (!record(value.writing) || Object.keys(value.writing).length > 100 || !Object.entries(value.writing).every(([id, draft]) => safeId(id) && record(draft) && str(draft.text, 20000) && num(draft.elapsed) && (draft.elapsed as number) <= 604800 && (draft.submitted === undefined || typeof draft.submitted === "boolean") && (draft.checked === undefined || typeof draft.checked === "boolean")))) fail();
  if (value.vocabulary !== undefined && !validVocabulary(value.vocabulary, ids, collectionIds)) fail();
  if (collectionIds.size !== value.collections.length || !record(value.saved))
    fail();
  for (const [id, c] of Object.entries(value.saved)) {
    if (
      !record(c) ||
      c.wordId !== id ||
      !ids.has(id) ||
      !collectionIds.has(c.collectionId) ||
      !str(c.note, 2000) ||
      !["due", "interval", "ease", "repetitions", "lapses", "added"].every(
        (k) => num(c[k]),
      ) ||
      (c.ease as number) < 1.3
    )
      fail();
  }
  if (
    !Array.isArray(value.bookmarks) ||
    !value.bookmarks.every((x) => str(x, 100)) ||
    !Array.isArray(value.searches) ||
    !value.searches.every((x) => str(x, 100))
  )
    fail();
  for (const key of ["reading", "media"])
    if (!record(value[key]) || !Object.values(value[key]).every(num)) fail();
  if (
    !Array.isArray(value.events) ||
    !value.events.every(
      (e) =>
        record(e) &&
        str(e.id, 100) &&
        num(e.at) &&
        [
          "review",
          "reading",
          "listening",
          "grammar",
          "practice",
          "time",
        ].includes(e.kind as string) &&
        str(e.target, 200) &&
        (e.correct === undefined || typeof e.correct === "boolean") &&
        ["seconds", "score", "total"].every(
          (k) => e[k] === undefined || num(e[k]),
        ) &&
        (e.mistakes === undefined ||
          (Array.isArray(e.mistakes) &&
            e.mistakes.every((x: unknown) => str(x, 1000)))),
    )
  )
    fail();
  return value as AppState;
}
export function parseVocabulary(text: string): Word[] {
  const data = JSON.parse(text);
  if (
    !Array.isArray(data) ||
    !data.length ||
    data.length > 10000 ||
    !data.every(validateWord) ||
    new Set(data.map((w) => w.id)).size !== data.length
  )
    throw new Error(
      "Cần một mảng JSON gồm các từ hợp lệ, tối đa 10.000 từ và không trùng ID.",
    );
  return data;
}
