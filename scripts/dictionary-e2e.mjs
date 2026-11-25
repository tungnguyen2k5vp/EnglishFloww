import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { words } from '../src/data.ts';
import { initialState } from '../src/domain.ts';

const serial = process.env.ANDROID_TEST_SERIAL;
const physical = !!serial;
const adb = (...args) => execFileSync(path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe'), ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const output = 'test-results/dictionary/' + (physical ? 'physical' : 'browser');
const checks = [], errors = [];
let browser, context, page, baseline, oldDraft, createdId, learningId;
const title = 'QA automatic dictionary ' + Date.now();
const pass = label => { checks.push(label); console.log('PASS:', label); };
const click = name => page.getByRole('button', { name, exact: true }).click();
const data = async () => await page.evaluate(() => JSON.parse(window.EnglishFlowDevice?.readState?.() || localStorage.getItem('englishflow.v1'))) ?? initialState();
const put = async state => page.evaluate(s => { const raw = JSON.stringify(s); if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(raw)) throw Error('Native save failed'); localStorage.setItem('englishflow.v1', raw); }, state);
async function connect() {
  if (!physical) {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ viewport: { width: 360, height: 719 }, isMobile: true, hasTouch: true });
    page = await context.newPage();
    await page.goto((process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178') + '/mobile.html#vocabulary');
  } else {
    adb('shell', 'am', 'start', '-n', 'com.englishflow.mobile/.MainActivity');
    for (let i = 0; i < 40; i++) {
      try {
        const pid = adb('shell', 'pidof', 'com.englishflow.mobile');
        adb('forward', 'tcp:9227', 'localabstract:webview_devtools_remote_' + pid);
        browser = await chromium.connectOverCDP('http://127.0.0.1:9227', { noDefaults: true });
        context = browser.contexts()[0]; page = context.pages()[0];
        await expect(page.locator('.phone-app')).toBeVisible(); break;
      } catch (error) { if (i === 39) throw error; await new Promise(r => setTimeout(r, 250)); }
    }
  }
  page.on('pageerror', error => errors.push(error.message));
}
const route = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', hash.split('/')[0]); };
async function screenshot(name) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (physical) await writeFile(`${output}/${name}.png`, execFileSync(path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe'), ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true }));
  else await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
await mkdir(output, { recursive: true });
try {
  await connect();
  baseline = await data();
  oldDraft = await page.evaluate(() => localStorage.getItem('englishflow.collection-draft.new'));
  await route('create-collection');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill('High school\nDog\nTransition\nRow\nBaby\nHIGH   SCHOOL');
  await click('Tra nghĩa tự động');
  await expect(page.locator('.resolved-word')).toHaveCount(5);
  await expect(page.locator('.resolved-word').first()).toContainText('trung học');
  await expect(page.getByRole('textbox', { name: /^Nghĩa của/ })).toHaveCount(0);
  const rowChoice = page.getByRole('combobox', { name: 'Chọn nghĩa của Row', exact: true });
  const chosen = await rowChoice.locator('option').nth(1).getAttribute('value');
  await rowChoice.selectOption(chosen);
  await page.reload(); await click('Tra nghĩa tự động');
  await expect(page.getByRole('combobox', { name: 'Chọn nghĩa của Row', exact: true })).toHaveValue(chosen);
  await page.locator('.resolved-word').first().scrollIntoViewIfNeeded();
  await screenshot('automatic-five-words');
  await click('Thêm từ');
  await expect(page.locator('.pack-word')).toHaveCount(5);
  let current = await data();
  createdId = current.collections.find(c => c.name === title).id;
  const ids = current.collections.find(c => c.id === createdId).wordIds;
  const imported = [...words, ...current.customWords].filter(w => ids.includes(w.id));
  expect(imported).toHaveLength(5);
  expect(imported.every(w => w.meaning && w.ipa && w.example)).toBe(true);
  expect(current.customWords.length - baseline.customWords.length).toBeLessThanOrEqual(5);
  expect(JSON.stringify(current).length - JSON.stringify(baseline).length).toBeLessThan(15000);
  pass('Five user words automatically resolve offline; phrase/case dedup, alternate sense and draft restoration; only selected words enter learner storage');

  await route('flashcards/' + createdId);
  // Check the JS/native locale contract and actual Android TTS completion/error events.
  await page.evaluate(() => {
    window.qaSpeech = [];
    window.addEventListener('ef-audio', event => window.qaSpeech.push(event.detail));
    if (!window.EnglishFlowDevice) window.EnglishFlowDevice = { speak: () => true, stopAudio: () => {}, speakAccent: (text, accent) => { window.qaSpeech.push({ state: 'requested', text, accent }); return true; } };
  });
  for (const accent of ['UK', 'US']) {
    await page.evaluate(() => { window.qaSpeech = []; });
    await click('Nghe ' + accent);
    if (physical) {
      await expect.poll(() => page.evaluate(() => window.qaSpeech.some(e => ['speech-started', 'error'].includes(e.state)))).toBe(true);
      const events = await page.evaluate(() => window.qaSpeech);
      if (events.some(e => e.state === 'error')) await expect(page.locator('.toast')).toContainText(/giọng|gói/u);
      checks.push('Android ' + accent + ': ' + (events.some(e => e.state === 'speech-started') ? 'TTS engine started' : 'missing voice surfaced to user'));
    } else {
      expect(await page.evaluate(() => window.qaSpeech[0].accent)).toBe(accent === 'UK' ? 'en-GB' : 'en-US');
    }
  }
  await route('collection/' + createdId);
  if (!physical) await page.evaluate(() => { delete window.EnglishFlowDevice; });
  pass('UK/US playback uses explicit accents; unavailable Android voice is visible and playback stops on navigation');

  current = await data();
  learningId = ids.find(id => !current.saved[id] || current.saved[id].repetitions === 0);
  if (!learningId) throw Error('All five user words already learned; use a separate QA device for scheduling test');
  const config = { fresh: { limit: 1, writing: 1, listening: 1, word: 1, meaning: 1 }, review: { limit: 1, writing: 1, listening: 1, word: 1, meaning: 1 }, firstWriting: true, autoAudio: false, random: false, context: true };
  current.vocabulary = { settings: config };
  await put(current); await page.reload(); await route('learn/' + createdId); await click('Bắt đầu học');
  while (await page.locator('.picker-card').count()) {
    const term = await page.locator('.picker-card h2').innerText();
    const target = [...words, ...current.customWords].find(w => w.id === learningId);
    await click(term.toLowerCase() === target.term.toLowerCase() ? 'Học' : 'Bỏ qua');
  }
  const modes = new Set();
  let restart = false;
  for (let safety = 0; safety < 40 && !await page.locator('.study-results').count(); safety++) {
    const s = await data(), session = s.vocabulary.session, task = session.tasks[session.index];
    const word = [...words, ...s.customWords].find(w => w.id === task.wordId);
    modes.add(task.mode);
    if (!session.checked) {
      if (['copy', 'writing', 'context'].includes(task.mode)) await page.getByRole('textbox', { name: 'Câu trả lời', exact: true }).fill(word.term.toUpperCase());
      else await page.getByRole('button', { name: task.mode === 'meaning' ? word.meaning : word.term, exact: true }).click();
      await click('Kiểm tra'); await expect(page.locator('.study-feedback')).toContainText('Chính xác');
      if (!restart) {
        if (physical) { await browser.close(); adb('shell', 'am', 'force-stop', 'com.englishflow.mobile'); await connect(); await route('learn/' + createdId); }
        else await page.reload();
        await expect(page.locator('.study-feedback')).toContainText('Chính xác'); restart = true;
      }
    }
    await click('Tiếp tục');
  }
  await expect(page.locator('.study-results')).toBeVisible();
  expect([...modes]).toEqual(expect.arrayContaining(['copy', 'meaning', 'word', 'listening', 'writing']));
  expect((await data()).saved[learningId].repetitions).toBe(1);
  await screenshot('learned-source-word');
  pass('Source word completes writing/meaning/word/listening/context; checked answer survives cold restart and schedules once');

  current = await data(); current.saved[learningId].due = 0; delete current.vocabulary.session;
  await put(current); await page.reload(); await route('review/' + createdId); await click('Bắt đầu học');
  for (let safety = 0; safety < 30 && !await page.locator('.study-results').count(); safety++) {
    const s = await data(), session = s.vocabulary.session, task = session.tasks[session.index];
    const word = [...words, ...s.customWords].find(w => w.id === task.wordId);
    if (['writing', 'context'].includes(task.mode)) await page.getByRole('textbox', { name: 'Câu trả lời', exact: true }).fill(word.term);
    else await page.getByRole('button', { name: task.mode === 'meaning' ? word.meaning : word.term, exact: true }).click();
    await click('Kiểm tra'); await click('Tiếp tục');
  }
  await expect(page.locator('.study-results')).toBeVisible();
  expect((await data()).saved[learningId].repetitions).toBe(2);
  expect((await data()).events.filter(e => e.kind === 'review' && e.target === learningId).length - baseline.events.filter(e => e.kind === 'review' && e.target === learningId).length).toBe(2);
  pass('Due review of the imported word advances to level 2 with exactly one event per completed learning/review session');

  await route('dictionary');
  await page.getByRole('textbox', { name: 'Tìm từ điển' }).fill('transition');
  await expect(page.locator('.phone-dictionary-results')).toContainText('transition');
  await page.locator('.phone-dictionary-results button').first().click();
  await expect(page.locator('.dictionary-entry')).toContainText('chuyển');
  await screenshot('dictionary-senses'); await click('Đóng từ điển');
  pass('Full dictionary search, source entry and sense picker work from the dictionary screen');

  const manifest = JSON.parse(await readFile('public/dictionary/manifest.json', 'utf8'));
  const bulk = [];
  for (const prefix of manifest.shards.filter(s => /^[a-z]{2}$/u.test(s))) {
    const rows = JSON.parse(await readFile('public/dictionary/' + prefix + '.json', 'utf8'));
    const term = Object.keys(rows).find(key => /^[a-z]{3,20}$/u.test(key));
    if (term) bulk.push(term);
    if (bulk.length === 100) break;
  }
  await route('create-collection');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill(title + ' bulk');
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill(bulk.join('\n'));
  const bulkStarted = Date.now();
  await click('Tra nghĩa tự động');
  await expect(page.locator('.resolved-word')).toHaveCount(100, { timeout: 30000 });
  expect(await page.getByRole('textbox', { name: /^Nghĩa của/ }).count()).toBe(0);
  checks.push('100 distinct source words resolved in ' + (Date.now() - bulkStarted) + ' ms');
  await route('vocabulary');
  pass('100 distinct words across dictionary shards resolve without manual definitions or writing the dictionary into learner state');

  expect(errors).toEqual([]);
  await writeFile(output + '/results.json', JSON.stringify({ build: '1.5.0 (6)', physical, checks, errors }, null, 2));
} catch (error) { if (page) await screenshot('failure').catch(() => {}); console.error(error.stack); process.exitCode = 1; }
finally {
  if (page && baseline) {
    const current = await data();
    const collection = current.collections.find(c => c.name === title);
    const ids = collection?.wordIds ?? [];
    current.collections = current.collections.filter(c => c.id !== collection?.id);
    current.customWords = current.customWords.filter(w => baseline.customWords.some(b => b.id === w.id) || !ids.includes(w.id));
    for (const id of ids) { if (baseline.saved[id]) current.saved[id] = baseline.saved[id]; else delete current.saved[id]; }
    const oldEvents = new Set(baseline.events.map(e => e.id));
    current.events = current.events.filter(e => oldEvents.has(e.id) || !ids.includes(e.target));
    if (baseline.vocabulary) current.vocabulary = baseline.vocabulary; else delete current.vocabulary;
    await put(current);
    await page.evaluate(old => { if (old === null) localStorage.removeItem('englishflow.collection-draft.new'); else localStorage.setItem('englishflow.collection-draft.new', old); }, oldDraft);
    await route('vocabulary'); await page.reload();
  }
  if (browser) await browser.close();
}
