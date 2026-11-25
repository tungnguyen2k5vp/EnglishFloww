import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const serial = process.env.ANDROID_TEST_SERIAL;
if (!serial || serial.startsWith('emulator-')) throw Error('Set ANDROID_TEST_SERIAL to a physical device.');
const adbPath = process.env.REA_ADB_PATH ?? path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const app = 'com.englishflow.mobile', output = 'test-results/vocabulary/physical';
const stamp = Date.now().toString().slice(-8), term = 'harbor ' + stamp, title = 'Kiểm thử từ vựng ' + stamp;
let browser, page, createdId, createdWordId, oldVocabulary;
const checks = [], errors = [];
const pass = label => { checks.push(label); console.log('PASS:', label); };
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('englishflow.v1')));
const click = name => page.getByRole('button', { name, exact: true }).click();
async function connect() {
  adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  for (let i = 0; i < 30; i++) {
    try {
      const pid = adb('shell', 'pidof', app); if (!pid) throw Error('Starting');
      adb('forward', 'tcp:9226', 'localabstract:webview_devtools_remote_' + pid);
      browser = await chromium.connectOverCDP('http://127.0.0.1:9226', { noDefaults: true });
      page = browser.contexts()[0].pages()[0];
      page.on('pageerror', e => errors.push(e.message));
      await expect(page.locator('.phone-app')).toBeVisible();
      return;
    } catch (e) { if (i === 29) throw e; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
}
const route = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', hash.split('/')[0]); };
async function screenshot(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);
  await writeFile(output + '/' + name + '.png', execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true, maxBuffer: 10000000 }));
}
await mkdir(output, { recursive: true });
try {
  await connect();
  oldVocabulary = (await data()).vocabulary ?? null;
  await route('vocabulary'); await click('Thêm mới'); await click('Tạo bộ từ cá nhân');
  const input = page.getByRole('textbox', { name: 'Tên bộ từ', exact: true });
  await input.click(); await input.fill(title);
  await expect.poll(() => /mInputShown=true/.test(adb('shell', 'dumpsys', 'input_method'))).toBe(true);
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill(term);
  await click('Tra nghĩa tự động');
  await page.getByRole('textbox', { name: 'Nghĩa của ' + term }).fill('bến cảng kiểm thử');
  await screenshot('create-collection');
  await click('Thêm từ');
  await expect(page.locator('.pack-word')).toHaveCount(1);
  createdId = (await data()).collections.find(c => c.name === title).id;
  createdWordId = (await data()).collections.find(c => c.id === createdId).wordIds[0];
  await screenshot('collection');
  pass('Physical Add sheet, bulk creation, unknown-word definition, real keyboard/insets and collection scope');

  await click('Học thêm từ mới'); await click('Cài đặt học từ vựng');
  await page.getByRole('combobox', { name: 'Từ mới: Số từ tối đa một lần học' }).selectOption('1');
  await page.getByRole('combobox', { name: 'Từ mới: Viết', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: 'Học viết từ lần đầu' }).check();
  await screenshot('settings-top');
  await page.getByRole('checkbox', { name: 'Điền từ theo ngữ cảnh' }).uncheck();
  await page.getByRole('checkbox', { name: 'Tự động phát âm' }).uncheck();
  await screenshot('settings-bottom'); await click('Lưu cài đặt');
  await click('Bắt đầu học'); await screenshot('picker'); await click('Học');
  await expect(page.locator('.study-session')).toHaveAttribute('data-mode', 'copy');
  await page.getByRole('textbox', { name: 'Câu trả lời', exact: true }).fill(term);
  await click('Kiểm tra');
  await expect(page.locator('.study-feedback')).toContainText('Chính xác');
  pass('Physical settings including below fold, new-word selector and first-writing check');

  // Stop only the owned app to verify the persisted checked state on a cold launch.
  await browser.close(); browser = null;
  adb('shell', 'am', 'force-stop', app);
  await connect(); await route('learn/' + createdId);
  await expect(page.locator('.study-feedback')).toContainText('Chính xác');
  expect((await data()).saved[createdWordId]).toBeUndefined();
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.getByRole('dialog')).toContainText('Tiến trình đã được lưu');
  await screenshot('exit-confirmation'); await click('Học tiếp'); await click('Tiếp tục');
  pass('Physical process-death recovery, checked-answer guard and Android Back exit/cancel');

  let wrong = false;
  const modes = new Set(['copy']);
  for (let n = 0; n < 30 && !await page.locator('.study-results').count(); n++) {
    const s = await data(), session = s.vocabulary.session, task = session.tasks[session.index];
    modes.add(task.mode);
    if (!session.checked) {
      if (['copy', 'writing', 'context'].includes(task.mode)) {
        await page.getByRole('textbox', { name: 'Câu trả lời' }).fill(term);
      } else {
        const expected = task.mode === 'meaning' ? 'bến cảng kiểm thử' : term;
        if (!wrong && task.mode === 'meaning') { await page.locator('.review-choices button').filter({ hasNotText: expected }).first().click(); wrong = true; }
        else await click(expected);
      }
      await click('Kiểm tra');
    }
    await expect.poll(async () => { const feedback = await page.locator('.study-feedback').boundingBox(), footer = await page.locator('.study-footer').boundingBox(); return !!feedback && !!footer && feedback.y >= 60 && feedback.y + feedback.height <= footer.y + 1; }).toBe(true);
    await screenshot('question-' + task.mode + (task.retry ? '-retry' : ''));
    await click('Tiếp tục');
  }
  await expect(page.locator('.study-results')).toBeVisible();
  const finished = await data();
  expect(finished.events.filter(e => e.kind === 'review' && e.target === createdWordId)).toHaveLength(1);
  expect(finished.saved[createdWordId].repetitions).toBe(1);
  expect(finished.saved[createdWordId].due).toBeGreaterThan(Date.now() + 7100000);
  expect([...modes].sort()).toEqual(['copy', 'listening', 'meaning', 'word', 'writing']);
  await screenshot('results');
  pass('Physical meaning/word/listening/writing modes, wrong-answer retry, results and exactly one two-hour schedule commit');

  await click('Về bộ từ vựng'); await click('Flashcards'); await click('Lật thẻ');
  await expect(page.locator('.flashcard-face')).toHaveClass(/flipped/); await click('Trộn thẻ');
  await screenshot('flashcard');
  expect((await data()).events.filter(e => e.kind === 'review' && e.target === createdWordId)).toHaveLength(1);
  await route('collection/' + createdId);
  await page.evaluate(wordId => { const s = JSON.parse(localStorage.getItem('englishflow.v1')); s.saved[wordId].due = 0; delete s.vocabulary.session; if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(JSON.stringify(s))) throw Error('Native write failed'); localStorage.setItem('englishflow.v1', JSON.stringify(s)); }, createdWordId);
  await page.reload(); await route('review/' + createdId); await click('Bắt đầu học');
  adb('shell', 'input', 'keyevent', '4'); await click('Lưu và thoát');
  await click('Ôn tập ngay'); await expect(page.locator('.study-session')).toBeVisible();
  await click('Bỏ qua từ này'); await expect(page.locator('.study-results')).toBeVisible();
  expect((await data()).saved[createdWordId].lapses).toBe(1);
  pass('Physical flashcards preserve schedule; due review exit/resume/skip works without network');
  expect(errors).toEqual([]);
  await writeFile(output + '/results.json', JSON.stringify({ build: '1.5.0 (6)', device: serial, checks, errors }, null, 2));
} catch (e) { if (page) await screenshot('failure').catch(() => {}); console.error(e.stack); process.exitCode = 1; }
finally {
  // Remove only the test-owned collection, word and events; preserve all pre-existing app data.
  if (page && createdId && createdWordId) {
    await page.evaluate(({ id, wordId, oldVocabulary }) => {
      const s = JSON.parse(localStorage.getItem('englishflow.v1'));
      s.collections = s.collections.filter(c => c.id !== id);
      s.customWords = s.customWords.filter(w => w.id !== wordId);
      delete s.saved[wordId]; s.events = s.events.filter(e => e.target !== wordId);
      if (oldVocabulary) s.vocabulary = oldVocabulary; else delete s.vocabulary;
      if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(JSON.stringify(s))) throw Error('Native write failed'); localStorage.setItem('englishflow.v1', JSON.stringify(s));
      location.hash = 'vocabulary'; location.reload();
    }, { id: createdId, wordId: createdWordId, oldVocabulary });
    await expect(page.locator('.phone-app')).toHaveAttribute('data-page', 'vocabulary');
  }
  if (browser) await browser.close();
}
