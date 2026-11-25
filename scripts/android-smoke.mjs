import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const serial = process.env.ANDROID_TEST_SERIAL;
if (!serial?.startsWith('emulator-')) throw new Error('Set ANDROID_TEST_SERIAL to a disposable emulator. Physical devices are excluded from this test.');
const adbPath = process.env.REA_ADB_PATH ?? path.join(process.env.LOCALAPPDATA, 'Android/Sdk/platform-tools/adb.exe');
const app = 'com.englishflow.mobile';
const adb = (...args) => execFileSync(adbPath, ['-s', serial, ...args], { encoding: 'utf8', windowsHide: true }).trim();
if (adb('shell', 'getprop', 'ro.kernel.qemu') !== '1') throw new Error('An Android emulator is required.');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
const pass = name => { checks.push(name); console.log('PASS:', name); };
await mkdir('test-results/mobile/native', { recursive: true });
let browser;
let page;
async function connect() {
  adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  let pid;
  for (let i = 0; i < 30; i++) {
    try { pid = adb('shell', 'pidof', app); if (pid) break; } catch { /* Activity process startup is asynchronous. */ }
    await pause(200);
  }
  if (!pid) throw new Error('Android did not start the app process.');
  adb('forward', 'tcp:9225', 'localabstract:webview_devtools_remote_' + pid);
  let lastError;
  for (let i = 0; i < 30; i++) {
    try {
      browser = await chromium.connectOverCDP('http://127.0.0.1:9225', { noDefaults: true });
      page = browser.contexts()[0].pages()[0];
      if (page) { await expect(page.locator('.phone-header')).toBeVisible(); return; }
    } catch (error) { lastError = error; }
    await pause(250);
  }
  throw new Error('Unable to connect to the installed WebView: ' + lastError?.message);
}
async function tab(name) {
  for (let i = 0; i < 12 && !await page.locator('.phone-tabs').count(); i++) {
    adb('shell', 'input', 'keyevent', '4');
    await page.waitForTimeout(150);
  }
  await page.getByRole('link', { name, exact: true }).click();
}
async function screenshot(name) {
  const png = execFileSync(adbPath, ['-s', serial, 'exec-out', 'screencap', '-p'], { windowsHide: true, maxBuffer: 10_000_000 });
  await writeFile('test-results/mobile/native/' + name + '.png', png);
}
try {
  adb('shell', 'am', 'force-stop', app);
  adb('shell', 'input', 'keyevent', '4');
  adb('shell', 'pm', 'revoke', app, 'android.permission.RECORD_AUDIO');
  adb('shell', 'pm', 'clear-permission-flags', app, 'android.permission.RECORD_AUDIO', 'user-set', 'user-fixed');
  await connect();
  await expect(page.locator('.phone-tabs a')).toHaveCount(5);
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth + 1 }));
  expect(viewport.overflow).toBe(false);
  await screenshot('home');
  pass('Installed APK launches with five tabs and an inset phone viewport');

  await page.getByRole('textbox', { name: 'Tra từ', exact: true }).fill('community');
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  if (await page.getByRole('button', { name: 'Lưu từ để ôn tập' }).count()) await page.getByRole('button', { name: 'Lưu từ để ôn tập' }).click();
  adb('shell', 'input', 'keyevent', '4');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await tab('Từ vựng');
  await expect.poll(() => page.evaluate(() => !!JSON.parse(window.EnglishFlowDevice.readState() || localStorage.getItem('englishflow.v1')).saved['community'])).toBe(true);
  await expect(page.locator('.folder-row').first()).toBeVisible();
  await browser.close();
  adb('shell', 'am', 'force-stop', app);
  await connect();
  await tab('Từ vựng');
  await expect.poll(() => page.evaluate(() => !!JSON.parse(window.EnglishFlowDevice.readState() || localStorage.getItem('englishflow.v1')).saved['community'])).toBe(true);
  await expect(page.locator('.folder-row').first()).toBeVisible();
  pass('Native Back dismisses lookup; saved vocabulary survives process death');

  const assets = await page.evaluate(async () => {
    const full = new Uint8Array(await (await fetch('/media/garden.wav')).arrayBuffer());
    return { audioBytes: full.length, invalidExport: window.EnglishFlowDevice.download('../outside.json', '{}') };
  });
  expect(assets.audioBytes).toBeGreaterThan(1_000_000);
  expect(assets.invalidExport).toBe(false);
  pass('Bundled media is readable and native export rejects invalid names');

  await tab('Khám phá');
  await page.locator('.phone-list > button').first().click();
  await expect(page.locator('audio')).toBeAttached();
  await page.locator('audio').evaluate(async element => { await Promise.race([element.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Native audio play timed out')), 8000))]); });
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  await page.locator('audio').evaluate(a => { a.currentTime = 10; });
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThanOrEqual(10);
  await screenshot('listening');
  pass('Bundled audio plays and seeks on the Android artifact');

  await tab('Luyện nói');
  await page.getByRole('button', { name: 'Shadowing', exact: true }).click();
  await page.locator('.phone-list > button').first().click();
  await page.getByRole('button', { name: 'Ghi âm giọng nói' }).click();
  await pause(500);
  adb('shell', 'uiautomator', 'dump', '/sdcard/englishflow-permission.xml');
  const hierarchy = adb('shell', 'cat', '/sdcard/englishflow-permission.xml');
  const denyNode = hierarchy.match(/<node[^>]*resource-id="com\.android\.permissioncontroller:id\/permission_deny_button"[^>]*>/)?.[0];
  if (!denyNode) throw new Error('Microphone permission dialog was not found.');
  const bounds = denyNode.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  adb('shell', 'input', 'tap', String(Math.round((bounds[0] + bounds[2]) / 2)), String(Math.round((bounds[1] + bounds[3]) / 2)));
  await expect(page.locator('.record-controls [role=alert]')).toContainText('Chưa được cấp quyền microphone');
  pass('Denied microphone permission produces a recoverable explanation');
  adb('shell', 'pm', 'grant', app, 'android.permission.RECORD_AUDIO');
  await page.getByRole('button', { name: 'Ghi âm giọng nói' }).click();
  await expect(page.getByRole('button', { name: 'Dừng ghi âm' })).toBeVisible();
  await pause(1500);
  await page.getByRole('button', { name: 'Dừng ghi âm' }).click();
  await expect(page.getByRole('button', { name: 'Nghe bản ghi của bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'Nghe bản ghi của bạn' }).click();
  await expect(page.getByRole('button', { name: 'Dừng nghe', exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole('button', { name: 'Nghe bản ghi của bạn' }).count()).toBe(1);
  const bytes = Number(adb('shell', 'run-as', app, 'stat', '-c', '%s', 'files/shadowing.m4a'));
  expect(bytes).toBeGreaterThan(1000);
  await screenshot('speaking');
  await page.getByRole('button', { name: 'Ghi âm giọng nói' }).click();
  await expect(page.getByRole('button', { name: 'Dừng ghi âm' })).toBeVisible();
  adb('shell', 'input', 'keyevent', '3');
  await pause(600);
  adb('shell', 'am', 'start', '-n', app + '/.MainActivity');
  await expect(page.getByRole('button', { name: 'Ghi âm giọng nói' })).toBeVisible();
  pass('Microphone records an actual local file, playback works and backgrounding stops capture');

  adb('shell', 'input', 'keyevent', '4');
  await expect(page.locator('.speaking-banner')).toBeVisible();
  pass('Native Back returns from a speaking lesson to its topic list');
  const exportName = 'englishflow-check-' + Date.now() + '.json';
  expect(await page.evaluate(name => window.EnglishFlowDevice.download(name, '{"check":"từ vựng"}'), exportName)).toBe(true);
  await pause(400);
  adb('shell', 'uiautomator', 'dump', '/sdcard/englishflow-export.xml');
  const exportHierarchy = adb('shell', 'cat', '/sdcard/englishflow-export.xml');
  const saveNode = exportHierarchy.match(/<node[^>]*resource-id="android:id\/button1"[^>]*>/)?.[0];
  if (!saveNode || !saveNode.includes('text="SAVE"')) throw new Error('The native save dialog was not found in the English test emulator.');
  const saveBounds = saveNode.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  adb('shell', 'input', 'tap', String(Math.round((saveBounds[0] + saveBounds[2]) / 2)), String(Math.round((saveBounds[1] + saveBounds[3]) / 2)));
  await pause(500);
  await expect.poll(() => adb('shell', 'cat', '/sdcard/Download/' + exportName), { timeout: 10000 }).toBe('{"check":"từ vựng"}');
  pass('Android document picker exports a real UTF-8 JSON file');
  await tab('Trang chủ');
  await page.getByRole('button', { name: 'Cá nhân và cài đặt' }).click();
  await page.getByRole('button', { name: 'Sao lưu & khôi phục dữ liệu', exact: true }).click();
  await page.getByText('Khôi phục từ bản sao lưu', { exact: true }).click();
  await pause(400);
  adb('shell', 'uiautomator', 'dump', '/sdcard/englishflow-import.xml');
  const importHierarchy = adb('shell', 'cat', '/sdcard/englishflow-import.xml');
  const importNode = importHierarchy.match(new RegExp('<node[^>]*text="' + exportName.replaceAll('.', '\\.') + '"[^>]*>'))?.[0];
  if (!importNode) throw new Error('The exported JSON was not visible in the Android file chooser.');
  const importBounds = importNode.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
  adb('shell', 'input', 'tap', String(Math.round((importBounds[0] + importBounds[2]) / 2)), String(Math.round((importBounds[1] + importBounds[3]) / 2)));
  await expect(page.getByRole('status')).toContainText('Tệp dữ liệu không hợp lệ');
  await tab('Từ vựng');
  await expect.poll(() => page.evaluate(() => !!JSON.parse(window.EnglishFlowDevice.readState() || localStorage.getItem('englishflow.v1')).saved['community'])).toBe(true);
  await expect(page.locator('.folder-row').first()).toBeVisible();
  pass('Native file chooser returns JSON; invalid restore preserves saved vocabulary');
  await tab('Khám phá');
  await page.locator('.phone-section').filter({ has: page.getByRole('heading', { name: 'Video', exact: true }) }).locator('.phone-article').first().click();
  await page.locator('video').evaluate(async element => { await Promise.race([element.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Native video play timed out')), 8000))]); });
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeGreaterThan(0.1);
  await page.locator('video').evaluate(v => { v.currentTime = 10; v.playbackRate = 1.25; });
  await expect.poll(() => page.locator('video').evaluate(v => v.currentTime)).toBeGreaterThanOrEqual(10);
  await screenshot('video');
  pass('Bundled video plays, seeks and changes speed on Android');
  const build = { serial, sdk: adb('shell', 'getprop', 'ro.build.version.sdk'), model: adb('shell', 'getprop', 'ro.product.model'), viewport };
  await writeFile('test-results/mobile/native/results.json', JSON.stringify({ build, checks, audioBytes: bytes }, null, 2));
} catch (error) {
  console.error(error.message);
  await writeFile('test-results/mobile/native/failed-run.json', JSON.stringify({ checks, failure: error.message }, null, 2));
  await screenshot('failure').catch(() => {});
  process.exitCode = 1;
} finally { if (browser) await browser.close(); }
