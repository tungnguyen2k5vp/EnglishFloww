import assert from "node:assert/strict";
import {
  DAY,
  initialState,
  newSaved,
  normalize,
  parseVocabulary,
  schedule,
  statistics,
  validateState,
} from "../src/domain.ts";
import { articles, grammarLessons, mediaLessons, words } from "../src/data.ts";
const now = new Date(2026, 9, 22, 12).getTime();
const card = newSaved("habit", "daily", now);
const first = schedule(card, 4, now);
assert.equal(first.interval, 1);
assert.equal(first.due, now + DAY);
assert.equal(first.repetitions, 1);
const second = schedule(first, 4, now + DAY);
assert.equal(second.interval, 6);
const third = schedule(second, 5, now + 7 * DAY);
assert.ok(third.interval > 6);
const failed = schedule(third, 1, now);
assert.equal(failed.repetitions, 0);
assert.equal(failed.lapses, 1);
assert.equal(failed.due, now + 600000);
let hard = card;
for (let i = 0; i < 100; i++) hard = schedule(hard, 1, now);
assert.equal(hard.ease, 1.3);
assert.equal(normalize("  I   READ a book! "), "i read a book");
const state = initialState();
assert.equal(statistics(state, now).streak, 0);
assert.equal(statistics(state, now).accuracy, 0);
state.saved.habit = first;
state.events = [
  { id: "a", at: now - DAY, kind: "time", target: "study", seconds: 60 },
  { id: "b", at: now, kind: "review", target: "habit", correct: true },
  { id: "c", at: now, kind: "review", target: "habit", correct: false },
  { id: "d", at: now, kind: "time", target: "study", seconds: 30 },
];
const stats = statistics(state, now);
assert.equal(stats.streak, 2);
assert.equal(stats.accuracy, 50);
assert.equal(stats.due, 0);
assert.equal(stats.seconds, 90);
assert.equal(stats.todaySeconds, 30);
const attempts = {
  ...state,
  events: [
    ...state.events,
    {
      id: "l1",
      at: now,
      kind: "listening" as const,
      target: "morning-audio:dictation",
    },
    {
      id: "l2",
      at: now,
      kind: "listening" as const,
      target: "morning-audio:comprehension",
    },
  ],
};
assert.equal(
  statistics(attempts, now).completed,
  1,
  "Exercise modes must not inflate completed lesson count",
);
assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
assert.throws(() =>
  validateState({ ...state, profile: { ...state.profile, goal: -1 } }),
);
assert.throws(() => validateState({ ...state, saved: { unknown: card } }));
assert.throws(() =>
  validateState({
    ...state,
    events: [{ id: "bad", at: NaN, kind: "review", target: "x" }],
  }),
);
assert.throws(() => parseVocabulary('[{"term":"broken"}]'));
assert.throws(() =>
  parseVocabulary(JSON.stringify([{ ...words[0], id: "__proto__" }])),
);
assert.deepEqual(
  parseVocabulary(JSON.stringify(words.slice(0, 2))),
  words.slice(0, 2),
);
const ids = new Set(words.map((w) => w.id));
assert.equal(ids.size, words.length);
for (const collection of state.collections)
  for (const id of collection.wordIds)
    assert.ok(ids.has(id), `Missing word ${id}`);
for (const article of articles) {
  assert.ok(article.paragraphs.length >= 3);
  for (const p of article.paragraphs) {
    assert.ok(p.en.length > 80);
    assert.ok(p.vi.length > 80);
  }
}
for (const lesson of [...articles, ...grammarLessons, ...mediaLessons])
  for (const q of lesson.questions) {
    assert.ok(q.options.includes(q.answer));
    assert.ok(q.explanation.length > 10);
  }
for (const lesson of mediaLessons)
  for (let i = 0; i < lesson.segments.length; i++) {
    const s = lesson.segments[i];
    assert.equal(s.start, i ? lesson.segments[i - 1].end : 0);
    assert.ok(s.end > s.start);
  }
console.log(
  "PASS: SM-2 intervals, failures/ease floor, normalization, real statistics, backup/import validation, content relationships and caption timing.",
);
