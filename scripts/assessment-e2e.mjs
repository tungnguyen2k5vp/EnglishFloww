import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { initialState } from '../src/domain.ts';
import { openContent } from '../src/open-content-data.ts';

const serial = process.env.ANDROID_TEST_SERIAL;
if (serial && !serial.startsWith('emulator-')) throw Error('Use a disposable emulator for assessment fixtures.');
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const pkg = 'com.englishflow.mobile';
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8_000_000 }).trim();
const output = 'test-results/assessment/' + (serial ? 'emulator' : 'browser');
const checks = [], errors = [], measurements = {};
let browser, page, baseline, airplane, wifi, recording;
const pass = label => { checks.push(label); console.log('PASS:', label); };
const click = name => page.getByRole('button', { name, exact: true }).click();
const state = () => page.evaluate(() => JSON.parse(window.EnglishFlowDevice?.readState?.() || localStorage.getItem('englishflow.v1') || 'null'));
const scores = async () => (await state()).events.filter(e => e.target.startsWith('pronunciation:'));
const put = value => page.evaluate(value => { const raw = JSON.stringify(value); if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(raw)) throw Error('Native save failed'); localStorage.setItem('englishflow.v1', raw); }, value);
const go = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', hash.split('/')[0]); };
async function shot(name) { await page.screenshot({ path: `${output}/${name}.png`, fullPage: !serial }); }
async function connect() {
  if (serial) {
    adb('shell', 'am', 'start', '-W', '-n', pkg + '/.MainActivity');
    await expect(async () => {
      adb('forward', 'tcp:9237', 'localabstract:webview_devtools_remote_' + adb('shell', 'pidof', pkg));
      browser = await chromium.connectOverCDP('http://127.0.0.1:9237', { noDefaults: true });
      page = browser.contexts()[0].pages()[0]; await expect(page.locator('.phone-app')).toBeVisible();
    }).toPass({ timeout: 20000 });
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    await page.goto((process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178') + '/mobile.html');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; }); await page.reload();
  }
  page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
}
async function fixture(file) {
  adb('push', file, '/data/local/tmp/englishflow-assessment-fixture');
  adb('shell', 'run-as', pkg, 'cp', '/data/local/tmp/englishflow-assessment-fixture', 'files/shadowing.m4a');
  const copied = execFileSync(adbPath, ['-s', serial, 'exec-out', 'run-as', pkg, 'cat', 'files/shadowing.m4a'], { windowsHide: true });
  expect(createHash('sha256').update(copied).digest('hex')).toBe(createHash('sha256').update(await readFile(file)).digest('hex'));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('ef-audio', { detail: { state: 'ready' } })));
}
await mkdir(output, { recursive: true });
try {
  await connect(); baseline = await state();
  if (serial) {
    airplane = adb('shell', 'settings', 'get', 'global', 'airplane_mode_on'); wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on');
    adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable'); adb('shell', 'svc', 'wifi', 'disable');
    if (adb('shell', 'run-as', pkg, 'ls', 'files').includes('shadowing.m4a')) recording = execFileSync(adbPath, ['-s', serial, 'exec-out', 'run-as', pkg, 'cat', 'files/shadowing.m4a'], { windowsHide: true });
  }
  await put(initialState()); await page.reload();
  await go('writing/email-friend');
  const draft = 'I have an idea about the enviroment. She go to school every day and we enjoy reading books together. We want to help our friends learn useful things.';
  await page.getByRole('textbox', { name: 'Bài viết của bạn' }).fill(draft);
  await click('Chấm bài tự động');
  await expect(page.locator('.writing-auto-result')).toContainText('enviroment');
  const issue = page.locator('.writing-issues article').filter({ has: page.locator('mark', { hasText: /^She go$/ }) });
  await expect(issue).toContainText('She goes'); await shot('writing-feedback');
  await issue.getByRole('button').click();
  await expect(page.getByRole('textbox', { name: 'Bài viết của bạn' })).toHaveValue(draft.replace('She go', 'She goes'));
  expect((await state()).writing['email-friend'].checked).toBe(false);
  await expect(page.locator('.writing-auto-result')).toHaveCount(0);
  await click('Chấm bài tự động'); await expect(page.locator('.writing-auto-result')).toBeVisible();
  if (serial) { await browser.close(); adb('shell', 'am', 'force-stop', pkg); await connect(); await go('writing/email-friend'); }
  else await page.reload();
  await expect(page.locator('.writing-auto-result')).toContainText('enviroment');
  expect((await state()).writing['email-friend'].checked).toBe(true);
  expect((await state()).saved).toEqual(initialState().saved);
  pass('Local Writing grade, exact suggestion application, invalidation and regrading survive reload/process death without changing SRS');

  await go('writing'); await expect(page.locator('.learning-list > button')).toHaveCount(20);
  await page.getByRole('combobox', { name: 'Trình độ đề viết' }).selectOption('B2');
  expect(await page.locator('.learning-list > button').count()).toBeGreaterThan(0);
  await expect(page.locator('.learning-list')).not.toContainText('A2 ·');
  await page.getByRole('textbox', { name: 'Tìm đề viết' }).fill('zzunknown'); await expect(page.locator('.learning-list > button')).toHaveCount(0);
  await go('catalog'); await page.getByRole('combobox', { name: 'Trình độ bộ từ' }).selectOption('B2');
  await expect(page.locator('.pack-card').first()).toContainText('B2');
  const pack = openContent.packs.at(-1);
  await go('collection/' + pack.id); await expect(page.locator('.pack-preview .pack-word')).toHaveCount(12);
  await click('Thêm bộ từ vào thư viện'); expect((await state()).collections).toHaveLength(8);
  expect((await state()).saved).toEqual(initialState().saved);
  await go('listening'); await expect(page.locator('.media-catalog > button')).toHaveCount(38);
  await page.getByRole('combobox', { name: 'Trình độ bài nghe' }).selectOption('A2');
  await expect(page.locator('.media-catalog')).not.toContainText('· B2');
  await go('sentences'); await expect(page.locator('.learning-hero')).toContainText('226');
  await page.getByRole('combobox', { name: 'Trình độ câu song ngữ' }).selectOption('B2');
  await expect(page.locator('.sentence-card')).toBeVisible(); await shot('expanded-sentences');
  pass('Expanded Writing/audio/sentence/pack libraries and level filters work; adding a pack keeps review schedules');

  const article = openContent.articles.at(-1);
  await go('reading/' + article.id);
  await expect(page.locator('.phone-reader > h1')).toHaveText(article.title);
  await expect(page.locator('.reading-paragraph')).toHaveCount(3);
  await click('Hiện bản dịch'); await expect(page.locator('.reading-paragraph .translation')).toHaveCount(3);
  await click('Kiểm tra đọc hiểu'); await expect(page.locator('.quiz-panel')).toBeVisible();
  await shot('expanded-reading');
  pass('New original bilingual reading opens with all paragraphs, translation and comprehension quiz');

  if (serial) {
    await go('speaking/tatoeba-13500944'); await expect(page.locator('.pronunciation-assessment')).toBeVisible();
    await fixture('public/content/audio/1285681.mp3');
    const started = Date.now(); await click('Chấm bản ghi vừa đọc');
    await expect(page.locator('.pronunciation-result')).toBeVisible({ timeout: 65000 });
    measurements.correctSeconds = (Date.now() - started) / 1000;
    measurements.correct = (await state()).events.filter(e => e.target === 'pronunciation:tatoeba-13500944/0').at(-1)?.score;
    if (measurements.correct === undefined) measurements.correct = Number(await page.locator('.pronunciation-result .assessment-score > strong').innerText().then(t => t.split('/')[0]));
    await page.locator('.phoneme-words summary').first().click(); await shot('native-phonemes');
    await page.evaluate(() => { window.__acoustic = []; window.addEventListener('ef-assessment', e => window.__acoustic.push(e.detail)); window.EnglishFlowDevice.assessPronunciation('Where is the nearest train station?', 'mismatch'); });
    await expect.poll(() => page.evaluate(() => window.__acoustic.find(r => r.id === 'mismatch')), { timeout: 65000 }).toBeTruthy();
    const mismatch = await page.evaluate(() => window.__acoustic.find(r => r.id === 'mismatch'));
    expect(mismatch.error).toBeUndefined(); measurements.mismatch = mismatch.result.score;
    expect(measurements.correct).toBeGreaterThan(measurements.mismatch);
    pass('Actual ONNX phoneme inference runs offline on verified human audio; matching reference scores above mismatched reference');

    const silence = Buffer.alloc(44 + 32000); silence.write('RIFF'); silence.writeUInt32LE(silence.length - 8, 4); silence.write('WAVEfmt ', 8); silence.writeUInt32LE(16, 16); silence.writeUInt16LE(1, 20); silence.writeUInt16LE(1, 22); silence.writeUInt32LE(16000, 24); silence.writeUInt32LE(32000, 28); silence.writeUInt16LE(2, 32); silence.writeUInt16LE(16, 34); silence.write('data', 36); silence.writeUInt32LE(32000, 40);
    await writeFile(output + '/silence.wav', silence); await fixture(output + '/silence.wav');
    const eventCount = (await scores()).length; await click('Chấm bản ghi vừa đọc');
    await expect(page.locator('.pronunciation-assessment [role=alert]')).toContainText('im lặng', { timeout: 65000 });
    expect(await scores()).toHaveLength(eventCount); await shot('silence-rejected');
    await fixture('public/content/audio/1285681.mp3'); await click('Chấm bản ghi vừa đọc');
    await click('Hủy lượt chấm'); await expect(page.getByRole('button', { name: 'Chấm bản ghi vừa đọc', exact: true })).toBeEnabled();
    await page.waitForTimeout(1000); expect(await scores()).toHaveLength(eventCount);
    await click('Chấm bản ghi vừa đọc');
    await page.evaluate(() => { window.EnglishFlowDevice.cancelAssessment(); window.dispatchEvent(new CustomEvent('ef-audio', { detail: { state: 'stopped' } })); });
    await expect(page.getByRole('button', { name: 'Chấm bản ghi vừa đọc', exact: true })).toBeEnabled();
    await page.waitForTimeout(1000); expect(await scores()).toHaveLength(eventCount);
    await click('Chấm bản ghi vừa đọc'); await expect(page.locator('.pronunciation-result')).toBeVisible({ timeout: 65000 });
    await click('Chấm bản ghi vừa đọc'); adb('shell', 'input', 'keyevent', '3');
    await expect.poll(() => page.evaluate(() => document.hidden)).toBe(true);
    adb('shell', 'am', 'start', '-W', '-n', pkg + '/.MainActivity');
    await expect(page.getByRole('button', { name: 'Chấm bản ghi vừa đọc', exact: true })).toBeEnabled();
    pass('Silence creates no score; cancellation, audio interruption, retry and background clear pending feedback');
  } else {
    await go('speaking/tatoeba-13500944');
    await expect(page.locator('.pronunciation-assessment')).toContainText('APK Android 1.7');
    await expect(page.getByRole('button', { name: 'Chấm bản ghi vừa đọc', exact: true })).toHaveCount(0);
    await page.context().setOffline(true); await go('writing/email-friend'); await page.reload();
    await expect(page.locator('.writing-auto-result')).toBeVisible(); await page.context().setOffline(false);
    for (const width of [320, 393, 600]) {
      await page.setViewportSize({ width, height: 852 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    pass('Browser identifies native-only acoustic scoring accurately; Writing regrades offline at three viewport widths');
  }
  expect(errors).toEqual([]);
} catch (error) { await shot('failure').catch(() => {}); console.error(error.stack); process.exitCode = 1; }
finally {
  await page?.context().setOffline(false).catch(() => {});
  if (page && baseline) { await put(baseline).catch(() => {}); await page.reload().catch(() => {}); }
  if (serial) {
    if (recording) { await writeFile(output + '/previous-recording.bin', recording); await fixture(output + '/previous-recording.bin').catch(() => {}); }
    else adb('shell', 'run-as', pkg, 'rm', '-f', 'files/shadowing.m4a');
    adb('shell', 'rm', '-f', '/data/local/tmp/englishflow-assessment-fixture');
    if (airplane !== undefined) adb('shell', 'cmd', 'connectivity', 'airplane-mode', airplane === '1' ? 'enable' : 'disable');
    if (wifi === '1') adb('shell', 'svc', 'wifi', 'enable');
  }
  await writeFile(output + '/results.json', JSON.stringify({ build: '1.7.0 (8)', serial: serial ?? 'Chrome', checks, measurements, errors, passed: !process.exitCode }, null, 2));
  await browser?.close();
}
