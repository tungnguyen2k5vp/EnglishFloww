import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { initialState, validateState, newSaved, dayKey } from "../src/domain.ts";
import { articles, grammarLessons, mediaLessons, words } from "../src/data.ts";
import { openContent, libraryPacks, libraryWords } from "../src/open-content-data.ts";
import { countWords, writingChecks, writingPrompts, scenarioLessons } from "../src/learning-content.ts";
import { dailyPlan } from "../src/learning-plan.ts";
import { chainTurn } from "../src/word-chain.ts";

const state = initialState(), now = new Date(2026, 9, 25, 12).getTime();
assert.equal(state.collections.length, 7, "Catalog additions require explicit user action");
assert.equal(libraryPacks.length, 30);
assert.equal(libraryWords.length, 360);
assert.ok(libraryWords.every(w => w.id.startsWith("lib-word-") && w.example.toLowerCase().includes(w.term)));
assert.equal(new Set(words.map(w => w.id)).size, words.length);
const oldCustom = JSON.parse(readFileSync("public/dictionary/pa.json", "utf8")).passport[0];
state.customWords.push(oldCustom);
state.collections[0].wordIds.push(oldCustom.id);
state.saved[oldCustom.id] = newSaved(oldCustom.id, state.collections[0].id, now);
const before = JSON.stringify(state);
assert.deepEqual(validateState(JSON.parse(before)), state, "1.5 custom dictionary IDs remain valid");
state.collections.push(structuredClone(libraryPacks[0]));
state.writing = { "email-friend": { text: "Hello Alex,\n\nLet’s meet tomorrow.", elapsed: 23, submitted: false } };
assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
for (const writing of [{ x: { text: "x".repeat(20001), elapsed: 0 } }, { x: { text: "", elapsed: -1 } }, { x: { text: "", elapsed: NaN } }, JSON.parse('{"__proto__":{"text":"bad","elapsed":0}}'), { x: { text: "", elapsed: 0, submitted: "yes" } }]) assert.throws(() => validateState({ ...state, writing }));
assert.equal(countWords("  I'm learning — one small step.\n\nLet's go!  "), 7);
assert.ok(writingChecks("hi", 80).every(c => !c.passed));
for (const p of writingPrompts) {
  assert.ok(countWords(p.model) >= p.minimum, p.id + " model below target");
  assert.ok(p.outline.length >= 3 && p.prompt.length > 80);
}
assert.equal(scenarioLessons.length, 18);
assert.equal(new Set(scenarioLessons.map(l => l.segments[0].prompt)).size, 18);
assert.ok(scenarioLessons.every(l => l.segments.length === 4 && l.segments.every(s => s.prompt && s.promptVi && s.hint)));
assert.equal(grammarLessons.length, 60);
assert.equal(new Set(grammarLessons.map(l => l.category)).size, 10);
assert.equal(openContent.sentences.length, 226);
assert.equal(openContent.media.length, 35);
const creditIds = new Set(openContent.credits.map(c => c.id));
for (const c of openContent.credits) {
  assert.ok(c.author && c.changes && c.url.startsWith("https://") && c.licenseUrl.startsWith("https://"));
  assert.ok(!/\bNC\b|\bND\b/u.test(c.license));
  if ("asset" in c) assert.equal(createHash("sha256").update(readFileSync("public" + c.asset)).digest("hex"), c.sha256);
}
for (const lesson of [...articles, ...mediaLessons]) for (const id of lesson.credits ?? []) assert.ok(creditIds.has(id), id);
for (const pair of openContent.sentences) { assert.ok(creditIds.has(pair.credit)); assert.ok(pair.en && pair.vi); }
assert.equal(existsSync("public/reference"), false, "Unlicensed APK reference assets must stay out of the release");
const tasks = dailyPlan(state, now);
assert.ok(tasks.every(t => !t.done));
assert.equal(tasks[0].page, "review");
state.events.push({ id: "r", at: now, kind: "reading", target: tasks[1].target!, score: 1, total: 3 });
assert.equal(dailyPlan(state, now)[1].done, true);
assert.equal(dailyPlan(state, now + 86400000)[1].done, false);
assert.equal(dayKey(now), "2026-10-25");
assert.deepEqual(chainTurn(["apple"], "ear", ["apple", "ear", "rabbit"], false), { history: ["apple", "ear"], won: false });
assert.equal(chainTurn(["apple"], "ear", ["apple", "ear"], false).won, true);
console.log("PASS: licensed asset hashes/credits, curated content, legacy backup compatibility, writing boundaries/word count, topic dialogues, real daily progress and local two-player turns.");
