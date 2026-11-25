import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const serial = process.env.ANDROID_TEST_SERIAL;
if (!serial || serial.startsWith('emulator-')) throw new Error('Set ANDROID_TEST_SERIAL to the connected physical device.');
const adbPath = process.env.REA_ADB_PATH ?? path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const app = 'com.englishflow.mobile';
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
const output = 'test-results/mobile/physical';
await mkdir(output, { recursive: true });
const checks = [], errors = [];
let browser, page;
const pass = name => { checks.push(name); console.log('PASS:', name); };
async function connect() {
  adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const pid = adb('shell', 'pidof', app);
      if (!pid) throw new Error('Starting');
      adb('forward', 'tcp:9226', 'localabstract:webview_devtools_remote_' + pid);
      browser = await chromium.connectOverCDP('http://127.0.0.1:9226', { noDefaults: true });
      page = browser.contexts()[0].pages()[0];
      await expect(page.locator('.phone-app')).toBeVisible();
      await page.evaluate(() => { location.hash = 'home'; });
      await expect(page.locator('.phone-tabs a')).toHaveCount(5);
      page.on('pageerror', error => errors.push(error.message));
      return;
    } catch (error) {
      if (attempt === 19) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}
async function tab(name) {
  for (let i = 0; i < 12 && !await page.locator('.phone-tabs').count(); i++) {
    adb('shell', 'input', 'keyevent', '4');
    await page.waitForTimeout(150);
  }
  await page.getByRole('link', { name, exact: true }).click();
}
async function screenshot(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);
  const png = execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true, maxBuffer: 10_000_000 });
  await writeFile(output + '/' + name + '.png', png);
}
try {
  await connect();
  await tab('Trang chủ');
  await expect(page.getByRole('heading', { name: 'Hôm nay bạn muốn học gì?' })).toBeVisible();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  await screenshot('home');
  pass('Physical launch, five tabs and home artwork');
  await page.getByRole('textbox', { name: 'Tra từ', exact: true }).fill('habit');
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  const save = page.getByRole('button', { name: 'Lưu từ để ôn tập', exact: true });
  if (await save.count()) await save.click();
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab('Từ vựng');
  await expect.poll(() => page.evaluate(() => !!JSON.parse(localStorage.getItem('englishflow.v1')).saved['habit'])).toBe(true);
  await expect(page.locator('.folder-row').first()).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await screenshot('vocabulary');
  pass('Physical dictionary/save, Android Back and real vocabulary counts');
  await tab('Giải trí');
  await screenshot('games');
  await page.getByRole('button', { name: /OFFLINE/ }).click();
  await page.getByRole('button', { name: /Boss Baby/ }).click();
  await page.getByRole('textbox', { name: 'Từ nối tiếp' }).fill('ear');
  await page.getByRole('button', { name: 'Gửi từ' }).click();
  await expect(page.locator('.chain-history')).toContainText('rabbit');
  await screenshot('word-chain');
  pass('Physical offline Word Chain opponent and valid bot response');
  await tab('Gia sư AI');
  await screenshot('tutor');
  await page.getByRole('button', { name: 'Shadowing', exact: true }).click();
  await page.locator('.phone-list > button').first().click();
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  await expect(page.getByText('Câu 2/', { exact: false })).toBeVisible();
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.locator('.speaking-banner')).toBeVisible();
  pass('Physical shadowing sentence navigation and hardware Back');
  await tab('Khám phá');
  await screenshot('explore');
  await page.locator('.phone-list > button').first().click();
  await page.locator('audio').evaluate(async audio => { audio.muted = true; await audio.play(); });
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0.1);
  await page.locator('audio').evaluate(audio => { audio.currentTime = 10; audio.pause(); });
  await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThanOrEqual(10);
  pass('Physical bundled audio decoding, playback clock and seeking (muted)');
  for (const route of ['home', 'vocabulary', 'speaking', 'explore', 'games', 'ielts']) {
    await page.evaluate(route => { location.hash = route; }, route);
    await expect(page.locator('.phone-app')).toHaveAttribute('data-page', route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await browser.close();
  adb('shell', 'am', 'force-stop', app);
  await connect();
  await tab('Từ vựng');
  await expect.poll(() => page.evaluate(() => !!JSON.parse(localStorage.getItem('englishflow.v1')).saved['habit'])).toBe(true);
  await expect(page.locator('.folder-row').first()).toBeVisible();
  await tab('Trang chủ');
  pass('Physical process restart retains vocabulary; six main routes fit device');
  await page.getByRole('heading', { name: 'Dành cho bạn', exact: true }).scrollIntoViewIfNeeded();
  await screenshot('home-lower');
  const homeY = await page.evaluate(() => scrollY);
  await page.locator('.recommendations > button').first().click();
  await expect(page.locator('.phone-reader')).toBeVisible();
  await expect(page.locator('.phone-tabs')).toHaveCount(0);
  adb('shell', 'input', 'keyevent', '4');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(homeY - 10);
  await page.getByRole('button', { name: 'Mở từ điển', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tra từ điển', exact: true }).fill('study');
  await page.getByRole('button', { name: 'TRA TỪ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('sự học hỏi');
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  pass('Physical home lower content, detail-only navigation, restored scroll and floating dictionary dialog');
  await page.getByRole('button', { name: 'Ngữ pháp', exact: true }).click();
  await expect(page.locator('.grammar-groups summary')).toHaveCount(10);
  if (!await page.locator('.grammar-groups details').last().getAttribute('open').then(x => x !== null)) await page.locator('.grammar-groups summary').last().click();
  await page.locator('.grammar-groups details').last().locator('button').last().click();
  await expect(page.locator('.grammar-article')).toBeVisible();
  await screenshot('grammar-lesson');
  await page.locator('.grammar-article > .button').scrollIntoViewIfNeeded();
  await screenshot('grammar-lower');
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.locator('.grammar-groups details').last()).toHaveAttribute('open', '');
  pass('Physical tenth grammar group, final lesson, full-length scroll and hardware Back');
  await tab('Từ vựng');
  await page.getByRole('button', { name: 'Xem tất cả', exact: true }).click();
  await expect(page.locator('.phone-tabs')).toHaveCount(0);
  await page.locator('.pack-card').first().click();
  await expect(page.locator('.word-statistics')).toBeVisible();
  await page.locator('.pack-word').last().scrollIntoViewIfNeeded();
  await screenshot('collection-lower');
  await page.locator('.pack-word').last().getByRole('button', { name: /^Tùy chọn / }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Flashcards', exact: true }).click();
  await page.getByRole('button', { name: 'Lật thẻ', exact: true }).click();
  await expect(page.locator('.flashcard-face')).toHaveClass(/flipped/);
  pass('Physical catalog, collection lower word cards and flip flashcard');
  await tab('Trang chủ');
  await page.getByRole('button', { name: 'Bài tập', exact: true }).click();
  await page.locator('.exercise-grid button').first().click();
  await page.locator('.exercise-timeline > button').first().click();
  await page.getByRole('button', { name: 'Dễ', exact: true }).click();
  await page.locator('.gap-article input').first().click();
  await expect.poll(() => adb('shell', 'dumpsys', 'input_method').includes('mInputShown=true')).toBe(true);
  await page.locator('.gap-article input').first().fill('practice');
  await expect(page.locator('.gap-article input').first()).toHaveValue('practice');
  await screenshot('exercise-keyboard');
  adb('shell', 'input', 'keyevent', '4');
  await page.locator('.gap-article').scrollIntoViewIfNeeded();
  await screenshot('exercise');
  await page.locator('audio').evaluate(async audio => { audio.muted = true; await audio.play(); });
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  pass('Physical exercise difficulty, real gap typing/keyboard and playable fixed audio dock');
  await tab('Khám phá');
  await page.getByRole('heading', { name: 'Đọc sách', exact: true }).scrollIntoViewIfNeeded();
  await screenshot('explore-lower');
  await page.locator('.book-shelf button').first().click();
  await expect(page.locator('.book-reader > h1')).toHaveText('Pinocchio');
  const priorBookPage = Number(await page.getByRole('combobox', { name: 'Trang sách', exact: true }).inputValue());
  await page.getByRole('button', { name: 'Trang tiếp', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Trang sách', exact: true })).toHaveValue(String(priorBookPage + 1));
  pass('Physical Explore lower bookshelf, actual book text and next-page progress');
  await tab('Trang chủ');
  expect(errors).toEqual([]);
  await writeFile(output + '/results.json', JSON.stringify({ model: adb('shell', 'getprop', 'ro.product.model'), android: adb('shell', 'getprop', 'ro.build.version.release'), build: '1.5.0 (6)', viewport, checks, errors, notTested: ['Physical microphone recording, permission mutation, TTS acoustics, file picker, rotation and TalkBack'] }, null, 2));
} catch (error) {
  if (page) await screenshot('failure');
  throw error;
} finally {
  await browser?.close();
  adb('forward', '--remove', 'tcp:9226');
}
