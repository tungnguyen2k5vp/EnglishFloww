import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessWriting, loadSpellingWords, validPronunciationReport } from "../src/assessment.ts";
import { writingPrompts, speakingScenarios, countWords } from "../src/learning-content.ts";
import { initialState, validateState } from "../src/domain.ts";

const lexicon = new Set<string>(JSON.parse(readFileSync("public/content/wordlist.json", "utf8")));
const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(readFileSync("public/content/wordlist.json", "utf8"));
  assert.deepEqual(await loadSpellingWords(), lexicon, "The bundled spelling lexicon must pass the runtime loader, including long place names");
} finally { globalThis.fetch = originalFetch; }
const broken = "i has a idea about the enviroment. She go to school every day and we is happy. I did went there yesterday. This is a useful place for learning and talking with friends.";
const improved = "I have an idea about the environment. She goes to school every day and we are happy. I went there yesterday. This is a useful place for learning and talking with friends.";
const before = assessWriting(broken, 80, lexicon), after = assessWriting(improved, 80, lexicon);
assert.ok(before.issues.length >= 6);
assert.ok(before.issues.some(i => i.original === "She go" && i.replacement === "She goes"));
assert.ok(before.issues.some(i => i.original === "enviroment" && i.replacement === "environment"));
assert.ok(before.issues.some(i => i.original === "did went" && i.replacement === "did go"));
assert.ok(after.criteria[0].score > before.criteria[0].score);
for (const issue of before.issues) {
  assert.equal(broken.slice(issue.start, issue.end), issue.original);
  assert.ok(issue.start >= 0 && issue.end <= broken.length && issue.end > issue.start);
}
assert.ok(assessWriting("Does she like this book? Can he go with us? We suggest that he go early to find a seat.", 80, lexicon).issues.every(i => i.kind !== "grammar"), "Questions, modal inversion and subjunctives must not receive false third-person corrections");
assert.ok(assessWriting("She is agree with the plan, and she wants to help us prepare the room for tomorrow's meeting.", 80, lexicon).issues.some(i => i.replacement === "She agrees"));
assert.ok(assessWriting("We have many water bottles and many time slots available for people who want to join our activities.", 80, lexicon).issues.every(i => i.kind !== "grammar"));
assert.ok(assessWriting("We do not have many money. We would like to buy some food for the children at school.", 80, lexicon).issues.some(i => i.replacement === "much money"));
assert.throws(() => assessWriting("Hello", 80, lexicon), /15/);
assert.throws(() => assessWriting("Tôi đang viết một bài bằng tiếng Việt để kiểm tra rằng hệ thống không giả vờ chấm bài viết tiếng Anh.", 80, lexicon), /tiếng Anh/);
assert.throws(() => assessWriting("a".repeat(20001), 80, lexicon));
assert.throws(() => assessWriting(improved, NaN, lexicon));
const repetitive = assessWriting(("apple ".repeat(200) + ".").trim(), 80, lexicon);
assert.ok(repetitive.criteria[3].score < 20 && repetitive.warnings.length && repetitive.score <= 30);
assert.ok(assessWriting(improved, 250, lexicon).score <= 50, "Very short responses cannot receive a high practice index");
const hostile = assessWriting("<script>alert('x')</script> I have an idea about a small library where people can meet, read, and learn together every weekend.", 80, lexicon);
assert.ok(Number.isFinite(hostile.score), "Markup is plain text, never HTML feedback");
const maximum = assessWriting("unrecognizedword ".repeat(1170), 80, lexicon);
assert.ok(maximum.issues.length <= 80 && maximum.score <= 40);

const result = { engine: "phoneme-ctc-1", score: 75, seconds: 2.3, words: [{ word: "hello", score: 75, phones: [{ symbol: "h", score: 75 }] }] };
assert.ok(validPronunciationReport(result));
for (const invalid of [null, {}, { ...result, score: NaN }, { ...result, score: 101 }, { ...result, seconds: 16 }, { ...result, words: [] }, { ...result, words: [{ word: "bad<script>", score: 20, phones: [] }] }]) assert.equal(validPronunciationReport(invalid), false);
const state = initialState();
state.writing = { "email-friend": { text: improved, elapsed: 20, checked: true } };
assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))), state);
assert.throws(() => validateState({ ...state, writing: { bad: { text: "", elapsed: 0, checked: "yes" } } }));
for (const prompt of writingPrompts) {
  assert.ok(countWords(prompt.model) >= prompt.minimum, prompt.id + " model too short");
  assert.ok(prompt.outline.length >= 3 && prompt.prompt.length > 80);
}
assert.equal(new Set(writingPrompts.map(p => p.id)).size, 20);
assert.equal(new Set(speakingScenarios.map(p => p.id)).size, 18);
assert.ok(speakingScenarios.every(s => s.turns.length === 4 && s.turns.every(t => t.length === 5 && t.every(Boolean))));
console.log("PASS: real spelling/grammar corrections, false-positive guards, exact edit ranges, language/length/HTML bounds, rubric limits, bounded feedback, native-score validation, old backups and expanded lesson quality.");
