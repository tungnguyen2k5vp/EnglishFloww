import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { initialState } from '../src/domain.ts';

// ponytail: one browser or disposable emulator; physical acceptance remains a separate run.
const serial = process.env.ANDROID_TEST_SERIAL;
if (serial && !serial.startsWith('emulator-')) throw Error('Use a disposable emulator for this regression.');
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }).trim();
const output = 'test-results/collection-editor/' + (serial ? 'emulator' : 'browser');
const checks = [], errors = [];
let browser, page, baseline, drafts;
const pass = label => { checks.push(label); console.log('PASS:', label); };
const click = name => page.getByRole('button', { name, exact: true }).click();
const app = () => page.locator('.phone-app');
const state = () => page.evaluate(() => JSON.parse(window.EnglishFlowDevice?.readState?.() || localStorage.getItem('englishflow.v1') || 'null'));
const put = s => page.evaluate(s => {
  const raw = JSON.stringify(s);
  if (window.EnglishFlowDevice?.saveState && !window.EnglishFlowDevice.saveState(raw)) throw Error('Native write failed');
  localStorage.setItem('englishflow.v1', raw);
}, s);
const route = async hash => { await page.evaluate(hash => { location.hash = hash; }, hash); await expect(app()).toHaveAttribute('data-page', hash.split('/')[0]); };
const back = async () => { if (serial) adb('shell', 'input', 'keyevent', '4'); else await page.evaluate(() => window.englishFlowBack()); };
const headerBack = () => page.locator('.phone-header').getByRole('button', { name: 'Quay lại', exact: true }).click();
async function shot(name) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (serial) await writeFile(`${output}/${name}.png`, execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true }));
  else await page.screenshot({ path: `${output}/${name}.png` });
}
async function connect() {
  if (serial) {
    adb('shell', 'am', 'start', '-W', '-n', 'com.englishflow.mobile/.MainActivity');
    await expect(async () => {
      adb('forward', 'tcp:9228', 'localabstract:webview_devtools_remote_' + adb('shell', 'pidof', 'com.englishflow.mobile'));
      browser = await chromium.connectOverCDP('http://127.0.0.1:9228', { noDefaults: true });
      page = browser.contexts()[0].pages()[0];
      await expect(app()).toBeVisible();
    }).toPass({ timeout: 15000 });
  } else {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 393, height: 820 }, isMobile: true, hasTouch: true });
    await page.goto((process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178') + '/mobile.html#vocabulary');
  }
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
}
await mkdir(output, { recursive: true });
try {
  await connect();
  baseline = await state() ?? initialState();
  drafts = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('englishflow.collection-draft.'))));
  await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('englishflow.collection-draft.')).forEach(k => localStorage.removeItem(k)));
  await put(initialState()); await page.reload(); await route('vocabulary');
  const pristine = await state();
  await click('Thêm mới'); await click('Tạo bộ từ cá nhân');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill('Từ vựng mỗi ngày');
  const input = page.getByRole('textbox', { name: 'Danh sách từ', exact: true });
  await input.fill('HIGH   SCHOOL\nDog\nTransition\nRow\nBaby\nhabit\nzzqvunknown\nHigh school');
  await expect(page.getByRole('button', { name: 'Thêm từ', exact: true })).toBeDisabled();
  await click('Tra nghĩa tự động'); await expect(page.locator('.resolved-word')).toHaveCount(7);
  expect(await state()).toEqual(pristine);
  await click('Xóa zzqvunknown');
  await click('Sửa High school');
  await page.getByRole('textbox', { name: 'Nghĩa tiếng Việt', exact: true }).fill('Bản sửa chưa lưu');
  await click('Hủy');
  await expect(page.locator('.resolved-word').first()).not.toContainText('Bản sửa chưa lưu');
  await click('Sửa High school');
  await page.getByRole('textbox', { name: 'Từ tiếng Anh', exact: true }).fill('Dog');
  await click('Lưu chỉnh sửa');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('đã có');
  await page.getByRole('textbox', { name: 'Từ tiếng Anh', exact: true }).fill('high school');
  await page.getByRole('textbox', { name: 'Nghĩa tiếng Việt', exact: true }).fill('Trường trung học phổ thông');
  await page.getByRole('textbox', { name: 'Phiên âm IPA', exact: true }).fill('/ˈhaɪ skuːl/');
  await page.getByRole('textbox', { name: 'Loại từ', exact: true }).fill('danh từ');
  await page.getByRole('textbox', { name: 'Câu ví dụ', exact: true }).fill('I am a high school student.');
  if (serial && /mInputShown=true|isInputViewShown\(\)=true/.test(adb('shell', 'dumpsys', 'input_method'))) await back();
  await page.getByRole('dialog').evaluate(el => { document.activeElement?.blur(); el.scrollTop = 0; });
  await shot('edit-details');
  if (serial) {
    const target = page.getByRole('textbox', { name: 'Câu ví dụ', exact: true });
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox(), dpr = await page.evaluate(() => devicePixelRatio);
    adb('shell', 'input', 'tap', String(Math.round((box.x + 25) * dpr)), String(Math.round((box.y + 20) * dpr)));
    await expect.poll(() => adb('shell', 'dumpsys', 'input_method')).toMatch(/mInputShown=true|isInputViewShown\(\)=true/);
    await shot('edit-keyboard');
    await back(); await expect(page.getByRole('dialog')).toBeVisible();
  }
  await click('Lưu chỉnh sửa');
  await click('Xóa Dog'); await expect(page.locator('.resolved-word')).toHaveCount(5);
  await click('Khôi phục Dog'); await expect(page.locator('.resolved-word')).toHaveCount(6);
  await click('Xóa Baby');
  await click('Sửa habit');
  await page.getByRole('textbox', { name: 'Nghĩa tiếng Việt', exact: true }).fill('thói quen luyện tập mỗi ngày');
  await click('Lưu chỉnh sửa');
  expect(await state()).toEqual(pristine);
  await page.reload(); await expect(page.locator('.resolved-word')).toHaveCount(5);
  await expect(page.locator('.resolved-word').first()).toContainText('Trường trung học phổ thông');
  await expect(page.getByRole('button', { name: 'Khôi phục Baby', exact: true })).toBeVisible();
  expect(await state()).toEqual(pristine);
  pass('Lookup/edit/cancel/delete/restore/reload modify drafts only; duplicate term validation and existing seed isolation');

  for (const term of ['High school', 'Dog', 'Transition', 'Row', 'habit']) await click('Xóa ' + term);
  await expect(page.getByRole('heading', { name: 'Chưa chọn từ nào' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm từ', exact: true })).toBeDisabled();
  for (const term of ['High school', 'Dog', 'Transition', 'Row', 'habit']) await click('Khôi phục ' + term);
  await input.fill((await input.inputValue()) + '\njourney');
  await expect(page.getByRole('button', { name: 'Thêm từ', exact: true })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('đã thay đổi');
  await click('Tra nghĩa tự động'); await expect(page.locator('.resolved-word')).toHaveCount(6);
  await click('Xóa journey');
  await page.locator('.draft-review').evaluate(el => { window.dispatchEvent(new Event('pointerdown')); scrollTo(0, scrollY + el.getBoundingClientRect().top - 80); });
  await shot('draft-review');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.getByRole('button', { name: 'Khôi phục journey', exact: true }).evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector('.draft-footer').getBoundingClientRect().top)).toBe(true);
  await shot('removed-words');
  if (!serial) {
    for (const width of [320, 393, 600]) {
      await page.setViewportSize({ width, height: 820 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'draft width ' + width).toBe(true);
      await click('Sửa High school');
      expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'sheet width ' + width).toBe(true);
      await back(); await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.setViewportSize({ width: 393, height: 820 });
    await page.evaluate(() => { document.querySelector('.mobile-app').dataset.theme = 'dark'; });
    await page.locator('.draft-review').scrollIntoViewIfNeeded(); await shot('draft-dark');
    await page.evaluate(() => { document.querySelector('.mobile-app').dataset.theme = 'light'; });
  }
  pass('All removed disables commit; stale input requires lookup without losing edits/deletions; ' + (serial ? 'actual keyboard opens/dismisses and restore controls remain above footer' : 'draft and sheet fit 320/393/600px and dark mode'));

  await click('Thêm từ'); await expect(app()).toHaveAttribute('data-page', 'collection');
  await expect(page.locator('.pack-word')).toHaveCount(5);
  const committed = await state(), collection = committed.collections.find(c => c.name === 'Từ vựng mỗi ngày');
  const added = committed.customWords.filter(w => collection.wordIds.includes(w.id));
  expect(added.find(w => w.term === 'high school')).toMatchObject({ meaning: 'Trường trung học phổ thông', ipa: '/ˈhaɪ skuːl/', pos: 'danh từ', example: 'I am a high school student.' });
  expect(added.find(w => w.term === 'habit')).toMatchObject({ meaning: 'thói quen luyện tập mỗi ngày' });
  expect(added.some(w => ['baby', 'zzqvunknown', 'journey'].includes(w.term.toLowerCase()))).toBe(false);
  expect(committed.saved).toEqual(pristine.saved);
  expect(committed.collections.filter(c => c.id !== collection.id)).toEqual(pristine.collections);
  expect(await page.evaluate(() => localStorage.getItem('englishflow.collection-draft.new'))).toBeNull();
  await shot('collection-after-add');
  await headerBack(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  pass('Only final Add commits kept words with all edited fields, preserves existing schedules/collections and skips completed form on Back');

  async function openCollection() {
    await page.locator('.folder-row').getByRole('button', { name: /^Từ vựng mỗi ngày/ }).click();
    await expect(app()).toHaveAttribute('data-id', collection.id);
  }
  for (let n = 0; n < 3; n++) {
    await openCollection(); await click('Học thêm từ mới');
    await expect(app()).toHaveAttribute('data-page', 'learn');
    if (n === 0) await click('Quay lại'); else await back();
    await expect(app()).toHaveAttribute('data-page', 'collection');
    await back(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  }
  await openCollection(); await click('Thêm danh sách từ');
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill('apple');
  await click('Tra nghĩa tự động'); await click('Thêm từ');
  await expect(app()).toHaveAttribute('data-page', 'collection');
  await expect(page.locator('.pack-word')).toHaveCount(6);
  await back(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  pass('Repeated header/hardware Back through collection and learn setup never loops; append commit also removes editor from Back path');

  await openCollection(); await click('Học thêm từ mới'); await click('Bắt đầu học');
  await expect(page.locator('.picker-card')).toBeVisible();
  await back(); await expect(page.locator('.study-start')).toBeVisible();
  await click('Cài đặt học từ vựng'); await back(); await expect(page.locator('.study-start')).toBeVisible();
  await click('Bắt đầu học');
  for (let n = 0; n < 5 && !await page.locator('.study-session').count(); n++) await click('Học');
  await expect(page.locator('.study-session')).toBeVisible();
  await back(); await expect(page.getByRole('dialog')).toContainText('Tiến trình đã được lưu');
  await back(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.study-session')).toBeVisible();
  await back(); await click('Lưu và thoát');
  await expect(app()).toHaveAttribute('data-page', 'collection');
  await back(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  await openCollection(); await click('Học thêm từ mới'); await expect(page.locator('.study-session')).toBeVisible();
  for (let n = 0; n < 5 && !await page.locator('.study-results').count(); n++) await click('Bỏ qua từ này');
  await expect(page.locator('.study-results')).toBeVisible();
  await click('Về bộ từ vựng'); await expect(app()).toHaveAttribute('data-page', 'collection');
  await back(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  pass('Picker/settings Back closes locally; active session exit can cancel/resume; result Back returns detail then library');

  await route('learn/' + collection.id); await page.reload();
  await expect(app()).toHaveAttribute('data-page', 'learn');
  await back(); await expect(app()).toHaveAttribute('data-page', 'collection');
  await back(); await expect(app()).toHaveAttribute('data-page', 'vocabulary');
  await back(); await expect(app()).toHaveAttribute('data-page', 'home');
  if (serial) {
    await back();
    await expect.poll(() => adb('shell', 'dumpsys', 'activity', 'activities').split('\n').filter(s => /(?:topResumedActivity|ResumedActivity):?=?:?/.test(s)).join('\n')).not.toContain('com.englishflow.mobile');
    await browser.close(); await connect();
    await expect(app()).toHaveAttribute('data-page', 'home');
  }
  expect(errors).toEqual([]);
  pass('Cold deep-link fallback has no Back loop' + (serial ? '; Home Back exits and relaunch opens Home' : '') + '; no uncaught page errors');
  const device = serial ? { serial, os: adb('shell', 'getprop', 'ro.build.version.release'), api: adb('shell', 'getprop', 'ro.build.version.sdk'), model: adb('shell', 'getprop', 'ro.product.model'), abi: adb('shell', 'getprop', 'ro.product.cpu.abi'), fontScale: adb('shell', 'settings', 'get', 'system', 'font_scale'), density: adb('shell', 'wm', 'density'), locale: adb('shell', 'getprop', 'persist.sys.locale') || adb('shell', 'getprop', 'ro.product.locale'), uiLanguage: 'vi', airplaneMode: adb('shell', 'settings', 'get', 'global', 'airplane_mode_on') } : { browser: 'Chrome', widths: [320, 393, 600] };
  await writeFile(`${output}/results.json`, JSON.stringify({ version: '1.5.0', build: 6, device, checks, errors }, null, 2));
} catch (e) {
  if (page) await shot('failure').catch(() => {});
  console.error(e.stack); process.exitCode = 1;
} finally {
  if (page && baseline) {
    await put(baseline);
    await page.evaluate(drafts => {
      Object.keys(localStorage).filter(k => k.startsWith('englishflow.collection-draft.')).forEach(k => localStorage.removeItem(k));
      for (const [key, value] of Object.entries(drafts ?? {})) localStorage.setItem(key, value);
    }, drafts);
    await page.reload();
  }
  await browser?.close();
}
