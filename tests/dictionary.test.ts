import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { lookupDictionary, resolveDictionary } from "../src/dictionary-service.ts";
import { initialState, validateState, validateWord } from "../src/domain.ts";
import { startStudy, checkStudy, defaultVocabSettings } from "../src/vocabulary-study.ts";

const paths: string[] = [];
let fail = "", corrupt = "";
globalThis.fetch = (async (url: string | URL | Request) => {
  const path = String(url);
  paths.push(path);
  if (path === fail) { fail = ""; throw Error("Interrupted read"); }
  if (path === corrupt) return new Response('{"bad":[{"meaning":"invalid"}]}');
  try { return new Response(await readFile(new URL("../public" + path, import.meta.url), "utf8")); }
  catch { return new Response("", { status: 404 }); }
}) as typeof fetch;
const rows = await resolveDictionary(["High   school", "Dog", "Transition", "Row", "Baby"]);
assert.ok(rows.every(r => r.length && r.every(validateWord)));
assert.match(rows[0][0].meaning, /trung học/iu);
assert.match(rows[1][0].meaning, /chó/iu);
assert.ok(rows.every(r => r[0].ipa && r[0].example && r[0].source));
assert.ok(rows[3].length > 1, "Ambiguous words retain all source senses");
assert.equal((await lookupDictionary("high school."))[0].id, rows[0][0].id);
assert.equal(paths.filter(p => p === "/dictionary/hi.json").length, 1);
const forms = await lookupDictionary("danced");
assert.ok(forms.some(w => w.lemma === "dance" && w.pos === "động từ"));
assert.ok(forms.every(w => !w.lemma || !w.ipa), "Lemma IPA must not be labelled as the surface pronunciation");
assert.deepEqual(await lookupDictionary("zzzxqv999 impossible word"), []);
assert.ok(!paths.includes("/dictionary/zz.json"), "Absent prefixes use the bundled inventory, avoiding SPA HTML fallbacks");
assert.deepEqual(await lookupDictionary("__proto__"), []);
assert.ok((await lookupDictionary("constructor")).length);
await assert.rejects(resolveDictionary(Array(101).fill("dog")), /100/u);
const before = performance.now();
const hundred = await resolveDictionary(Array.from({ length: 100 }, (_, i) => ["high school", "dog", "transition", "row", "baby"][i % 5]));
assert.equal(hundred.length, 100);
assert.ok(hundred.every(r => r.length));
assert.ok(performance.now() - before < 5000);
fail = "/dictionary/ze.json";
await assert.rejects(lookupDictionary("zebra"), /Interrupted/u);
assert.ok((await lookupDictionary("zebra")).length, "Failed shard can be retried");
corrupt = "/dictionary/qu.json";
await assert.rejects(lookupDictionary("quartz"), /không hợp lệ/u);
corrupt = "";
assert.ok((await lookupDictionary("quartz")).length);
let state = initialState();
state.customWords = rows.map(r => r[0]);
state.collections.push({ ...state.collections[0], id: "qa-source", name: "Source words", wordIds: state.customWords.map(w => w.id) });
state = validateState(JSON.parse(JSON.stringify(state)));
state.vocabulary = { settings: { ...defaultVocabSettings(), firstWriting: true } };
state.vocabulary.session = startStudy(state, "qa-source", "learn", Date.now(), [rows[0][0].id]);
const session = state.vocabulary.session;
assert.equal(checkStudy(state, session.id, 0, " HIGH   SCHOOL ").vocabulary!.session!.correct, true);
assert.equal(checkStudy(state, session.id, 0, "high schools").vocabulary!.session!.correct, false);
assert.equal(checkStudy(state, session.id, 0, "high school!!!").vocabulary!.session!.correct, false);
console.log("PASS: real reference corpus, five user words, source senses/IPA/examples, morphology, safe keys, bounded bulk, failed/corrupt reads with retry, backup and strict spelling");
