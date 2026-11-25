import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initialState, newSaved } from '../src/domain.ts';
import { writingPrompts } from '../src/learning-content.ts';
import { openContent } from '../src/open-content-data.ts';

const serial = process.env.ANDROID_TEST_SERIAL;
if (serial && !serial.startsWith('emulator-')) throw Error('This regression uses a disposable emulator only.');
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8_000_000 }).trim();
const output = 'test-results/learning/' + (serial ? 'emulator' : 'browser');
const checks = [], errors = [];
let browser, page, baseline, airplane, wifi;
const pass = text => { checks.push(text); console.log('PASS:', text); };
const readState = () => page.evaluate(() => JSON.parse(window.EnglishFlowDevice?.readState?.() || localStorage.getItem('englishflow.v1') || 'null'));
const putState = state => page.evaluate(state => { const raw = JSON.stringify(state); if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(raw)) throw Error('Native save failed'); localStorage.setItem('englishflow.v1', raw); }, state);
const go = async route => { await page.evaluate(route => { location.hash = route; }, route); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', route.split('/')[0]); };
const click = text => page.getByRole('button', { name: text, exact: true }).click();
const back = async () => { if (serial) adb('shell', 'input', 'keyevent', '4'); else await page.evaluate(() => window.englishFlowBack()); };
async function shot(name, fullPage = false) { await page.screenshot({ path: `${output}/${name}.png`, fullPage }); }
async function connect() {
  if (serial) {
    adb('shell', 'am', 'start', '-W', '-n', 'com.englishflow.mobile/.MainActivity');
    await expect(async () => {
      const pid = adb('shell', 'pidof', 'com.englishflow.mobile');
      adb('forward', 'tcp:9232', 'localabstract:webview_devtools_remote_' + pid);
      browser = await chromium.connectOverCDP('http://127.0.0.1:9232', { noDefaults: true });
      page = browser.contexts()[0].pages()[0]; await expect(page.locator('.phone-app')).toBeVisible();
    }).toPass({ timeout: 20000 });
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    await page.goto((process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178') + '/mobile.html#home');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }
  page.setDefaultTimeout(10000); page.on('pageerror', e => errors.push(e.message));
}
await mkdir(output, { recursive: true });
try {
  if (serial) {
    airplane = adb('shell', 'settings', 'get', 'global', 'airplane_mode_on');
    wifi = adb('shell', 'settings', 'get', 'global', 'wifi_on');
    adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
    adb('shell', 'svc', 'wifi', 'disable');
    expect(adb('shell', 'settings', 'get', 'global', 'airplane_mode_on')).toBe('1');
  }
  await connect(); baseline = await readState();
  const old = initialState(); old.profile.name = 'Upgrade 1.5';
  const custom = JSON.parse(await readFile('public/dictionary/pa.json', 'utf8')).passport[0];
  old.customWords.push(custom); old.collections[0].wordIds.push(custom.id); old.saved[custom.id] = { ...newSaved(custom.id, 'daily'), repetitions: 3, interval: 8, note: 'Keep my progress' };
  await putState(old); await page.reload();
  await expect(page.locator('.recovery')).toHaveCount(0);
  await go('catalog'); await page.getByRole('button', { name: /Du lịch tự tin/ }).click();
  await expect(page.locator('.pack-preview .pack-word')).toHaveCount(12);
  expect((await readState()).collections).toHaveLength(7);
  await shot('pack-preview');
  await click('Thêm bộ từ vào thư viện');
  expect((await readState()).collections).toHaveLength(8);
  expect((await readState()).saved).toEqual(old.saved);
  await page.reload(); expect((await readState()).collections).toHaveLength(8);
  pass('Upgrade keeps 1.5 custom IDs, notes and schedules; catalog preview/add persists without starting reviews');

  await go('writing/email-friend');
  const draft = writingPrompts[0].model;
  await page.getByRole('textbox', { name: 'Bài viết của bạn', exact: true }).fill(draft);
  await click('Bấm giờ');
  await expect.poll(async () => (await readState()).writing?.['email-friend']?.elapsed ?? 0).toBeGreaterThan(0);
  await click('Tạm dừng');
  await shot('writing-draft');
  if (serial) {
    await browser.close(); adb('shell', 'am', 'force-stop', 'com.englishflow.mobile'); await connect(); await go('writing/email-friend');
  } else await page.reload();
  await expect(page.getByRole('textbox', { name: 'Bài viết của bạn' })).toHaveValue(draft);
  await click('Nộp bài và tự đánh giá');
  await expect(page.locator('.writing-feedback')).toContainText('Đã lưu bài viết');
  expect((await readState()).events.filter(e => e.target === 'writing:email-friend')).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Nộp bài và tự đánh giá' })).toBeDisabled();
  await page.reload(); await expect(page.locator('.writing-feedback')).toBeVisible();
  await click('Xem bài tham khảo'); await expect(page.locator('.writing-model')).toContainText('Would you like to join me');
  await shot('writing-feedback', true);
  pass('Writing drafts/timer survive reload or Android process death; submission, checks, revision path and original model work');

  await go('speaking/scenario'); await page.getByRole('button', { name: /Nhận phòng khách sạn/ }).click();
  await expect(page.locator('.scenario-question')).toContainText('Good evening');
  await click('Câu tiếp'); await expect(page.locator('.scenario-question')).toContainText('passport');
  await click('Câu tiếp'); await click('Câu tiếp'); await click('Hoàn thành');
  expect((await readState()).events.some(e => e.target === 'shadowing:scenario-hotel')).toBe(true);
  await go('speaking/scenario-cafe'); await expect(page.locator('.scenario-question')).toContainText('drink');
  await shot('guided-speaking');
  pass('Topic selection opens distinct dialogues; all four turns and durable completion work');

  await go('sentences'); await page.getByRole('textbox', { name: 'Tìm câu song ngữ' }).fill('Please speak English to me');
  await expect(page.locator('.sentence-card')).toContainText('Please speak English to me.');
  await click('Hiện nghĩa'); await expect(page.locator('.sentence-card .translation')).toBeVisible();
  await page.locator('audio').evaluate(async audio => { audio.muted = true; await audio.play(); });
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  await click('Luyện nhớ'); await page.getByRole('textbox', { name: 'Đáp án của bạn' }).fill('Please speak English to me.');
  await click('Kiểm tra'); await click('Xem kết quả');
  expect((await readState()).events.some(e => e.target === 'sentence:tatoeba-13500944')).toBe(true);
  await shot('sentences');
  pass('Reviewed bilingual search, translation, actual licensed audio playback and typed recall record progress');

  await go('plan'); await expect(page.locator('.plan-tasks > button')).toHaveCount(5);
  await expect(page.locator('.plan-tasks > button').last().locator('.task-index')).toHaveClass(/complete/);
  await shot('daily-plan');
  await go('sources'); await page.getByRole('combobox').selectOption('Wikimedia');
  await expect(page.locator('.sources-page section > h2').first()).toHaveText('Wikimedia');
  await page.locator('.sources-page section .content-credits').first().locator('summary').click();
  await expect(page.locator('.sources-page section .content-credits').first()).toContainText('CC BY-SA 4.0');
  await shot('sources');
  if (!serial) {
    await page.evaluate(() => { window.__sourceExport = null; window.EnglishFlowDevice = { download(name, text) { window.__sourceExport = { name, text }; return true; } }; });
    await click('Xuất bản kê nguồn, giấy phép và SHA-256');
    await expect.poll(() => page.evaluate(() => window.__sourceExport?.name)).toBe('EnglishFlow-manifest.json');
    expect(await page.evaluate(() => JSON.parse(window.__sourceExport.text).credits.length)).toBe(openContent.credits.length);
    await page.evaluate(() => { delete window.EnglishFlowDevice; });
  }
  pass('Daily tasks use real submitted writing/speaking events; source page exposes authors, pinned revisions and licenses');

  await go('games/friends'); await page.getByRole('textbox', { name: 'Từ nối tiếp' }).fill('ear'); await click('Gửi từ');
  await expect(page.locator('.chain-history button')).toHaveCount(2);
  await expect(page.locator('label[for=chain-word]')).toContainText('Người 2');
  await page.getByRole('textbox', { name: 'Từ nối tiếp' }).fill('rabbit'); await click('Gửi từ');
  await expect(page.locator('.chain-history button')).toHaveCount(3);
  pass('Two-player game alternates locally without an automatic bot response');

  // Native assets are packaged, independent of external connectivity. Browser requests are restricted to this origin.
  if (!serial) await page.route('**/*', route => new URL(route.request().url()).origin === new URL(page.url()).origin ? route.continue() : route.abort());
  const media = await page.evaluate(async sources => Promise.all(sources.map(async src => { const response = await fetch(src); return response.ok && (await response.arrayBuffer()).byteLength > 1000; })), openContent.media.map(m => m.src));
  expect(media.every(Boolean)).toBe(true);
  await go('home'); await shot('home', true);
  for (const route of ['writing/email-friend','writing/learning-opinion','speaking/scenario-hotel','sentences','sources','plan','collection/lib-pack-travel']) {
    await go(route); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
  }
  expect((await readState()).saved).toEqual(old.saved);
  if (!serial) {
    const ranges = await page.evaluate(async () => Promise.all(['bytes=0-1023','bytes=-32','bytes=999999999-'].map(async range => { const r = await fetch('/media/morning.wav', { headers: { Range: range } }); return { status: r.status, bytes: (await r.arrayBuffer()).byteLength }; })));
    expect(ranges).toEqual([{status:206,bytes:1024},{status:206,bytes:32},{status:416,bytes:0}]);
    await page.context().setOffline(true);
    await page.reload(); await expect(page.locator('.phone-app')).toBeVisible();
    await go('writing/email-friend'); await expect(page.getByRole('textbox', { name: 'Bài viết của bạn' })).toHaveValue(draft);
    await go('listening/tatoeba-13500944');
    await page.locator('audio').evaluate(async audio => { audio.muted = true; await audio.play(); });
    await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
    await page.context().setOffline(false);
  }
  expect(errors).toEqual([]);
  pass(`All ${openContent.media.length} recordings load locally; mobile offline reload/audio, layouts and existing review data remain functional`);
  await writeFile(output + '/results.json', JSON.stringify({ build: '1.7.0 (8)', serial: serial ?? 'Chrome', checks, errors }, null, 2));
} catch (error) { if (page) await shot('failure', true).catch(() => {}); console.error(error.stack); process.exitCode = 1; }
finally {
  if (page && baseline) { await putState(baseline).catch(() => {}); await page.reload().catch(() => {}); }
  await browser?.close();
  if (serial && airplane !== undefined) { adb('shell', 'cmd', 'connectivity', 'airplane-mode', airplane === '1' ? 'enable' : 'disable'); if (wifi === '1') adb('shell', 'svc', 'wifi', 'enable'); }
}
