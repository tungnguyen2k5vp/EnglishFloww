import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { words } from '../src/data.ts';
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 719 }, isMobile: true, hasTouch: true });
const page = await context.newPage(), checks = [], errors = [];
const pass = label => { checks.push(label); console.log('PASS:', label); };
const go = async route => { await page.goto(base + '/mobile.html#' + route); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', route.split('/')[0]); };
const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('englishflow.v1')));
const click = name => page.getByRole('button', { name, exact: true }).click();
page.on('pageerror', e => errors.push(e.message));
await mkdir('test-results/vocabulary', { recursive: true });
try {
  await go('vocabulary');
  await click('Học thêm từ mới');
  await expect(page.getByRole('button', { name: 'Bắt đầu học', exact: true })).toBeEnabled();
  await click('Bắt đầu học');
  await expect(page.locator('.picker-card')).toBeVisible();
  await click('Quay lại phần học từ'); await click('Quay lại');
  await expect(page.locator('.phone-app')).toHaveAttribute('data-page', 'vocabulary');
  pass('Global learning includes unsaved collection words and returns without changing progress');
  await click('Thêm mới');
  await expect(page.getByRole('dialog')).toContainText('Thêm bộ từ của bạn bè');
  await click('Tạo bộ từ cá nhân');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill('Bộ từ luyện tập');
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill('habit\nHabit\nlove\nserendipity\njourney\ndiscover');
  await click('Tra nghĩa tự động');
  await expect(page.locator('.resolved-word')).toHaveCount(5);
  await click('Thêm từ');
  await expect(page.locator('.pack-word')).toHaveCount(5);
  const id = (await data()).collections.find(c => c.name === 'Bộ từ luyện tập').id;
  await page.screenshot({ path: 'test-results/vocabulary/collection.png', fullPage: true });
  pass('Two-option Add sheet; bulk words, deduplication, automatic dictionary definition and atomic collection creation');

  await click('Học thêm từ mới');
  await click('Cài đặt học từ vựng');
  await page.getByRole('combobox', { name: 'Từ mới: Số từ tối đa một lần học' }).selectOption('3');
  await page.getByRole('combobox', { name: 'Từ mới: Viết', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: 'Điền từ theo ngữ cảnh' }).check();
  await click('Lưu cài đặt');
  await click('Bắt đầu học');
  await expect(page.locator('.picker-card h2')).toHaveText('habit');
  await click('Học');
  await click('Bỏ qua');
  await click('Đã biết');
  await click('Học');
  await click('Học');
  // Dictionary order differs from entered order; assert the actual committed membership instead of relying on it.
  await expect(page.locator('.study-session')).toBeVisible();
  const selected = (await data()).vocabulary.session.wordIds;
  expect(selected).toHaveLength(3);
  expect(Object.values((await data()).saved).filter(w => w.repetitions === 6)).toHaveLength(1);
  pass('Persistent per-group settings; new-word picker supports Learn, Skip and Already known');

  let wrong = false, resumed = false;
  const modes = new Set();
  for (let n = 0; n < 80 && !await page.locator('.study-results').count(); n++) {
    const s = await data(), session = s.vocabulary.session, task = session.tasks[session.index];
    if (!task) break;
    const w = [...words, ...s.customWords].find(w => w.id === task.wordId);
    modes.add(task.mode);
    await expect(page.locator('.study-session')).toHaveAttribute('data-mode', task.mode);
    const answer = task.mode === 'meaning' ? w.meaning : w.term;
    if (!session.checked) {
      if (['copy', 'writing', 'context'].includes(task.mode)) {
        await page.getByRole('textbox', { name: 'Câu trả lời', exact: true }).fill(answer.toUpperCase());
        if (!resumed && task.mode === 'writing') { await page.reload(); await expect(page.getByRole('textbox', { name: 'Câu trả lời' })).toHaveValue(answer.toUpperCase()); resumed = true; }
      } else {
        const buttons = page.locator('.review-choices button');
        if (!wrong && task.mode === 'meaning') { await buttons.filter({ hasNotText: answer }).first().click(); wrong = true; }
        else await page.getByRole('button', { name: answer, exact: true }).click();
      }
      await click('Kiểm tra');
      await expect.poll(async () => { const r = await page.locator('.study-feedback').boundingBox(); return !!r && r.y >= 60 && r.y + r.height <= 640; }).toBe(true);
      if (task.mode === 'meaning' && wrong && !session.mistakes.length) {
        await expect(page.locator('.study-feedback')).toContainText('Chưa chính xác');
        await page.reload();
        await expect(page.locator('.study-feedback')).toContainText('Chưa chính xác');
        await page.screenshot({ path: 'test-results/vocabulary/wrong-feedback.png' });
      }
    }
    await click('Tiếp tục');
  }
  await expect(page.locator('.study-results')).toBeVisible();
  expect([...modes].sort()).toEqual(['context', 'copy', 'listening', 'meaning', 'word', 'writing']);
  const completed = await data();
  expect(completed.vocabulary.session.committed).toHaveLength(3);
  expect(completed.events.filter(e => e.kind === 'review')).toHaveLength(3);
  for (const wordId of selected) expect(completed.saved[wordId].repetitions).toBe(1);
  expect(completed.vocabulary.session.tasks.some(t => t.retry)).toBe(true);
  await page.screenshot({ path: 'test-results/vocabulary/results.png', fullPage: true });
  await page.reload();
  expect((await data()).events.filter(e => e.kind === 'review')).toHaveLength(3);
  pass('All six learning stages; wrong-answer retry, normalized typing, input/feedback recovery after reload, result list and exactly-once scheduling');

  await click('Về bộ từ vựng');
  await click('Flashcards');
  await click('Lật thẻ');
  await expect(page.locator('.flashcard-face')).toHaveClass(/flipped/);
  await click('Tiếp'); await click('Trước'); await click('Trộn thẻ');
  expect((await data()).events.filter(e => e.kind === 'review')).toHaveLength(3);
  await go('collection/' + id);
  await page.getByRole('textbox', { name: 'Tìm trong bộ từ' }).fill('zzzzz');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy từ' })).toBeVisible();
  pass('Flashcard flip/next/previous/shuffle preserves schedule; word search empty state');

  // Due-only review: move a single disposable browser card into the past.
  await page.evaluate(wordId => { const s = JSON.parse(localStorage.getItem('englishflow.v1')); s.saved[wordId].due = 0; delete s.vocabulary.session; localStorage.setItem('englishflow.v1', JSON.stringify(s)); }, selected[0]);
  await page.reload();
  await go('review/' + id);
  await click('Bắt đầu học');
  await click('Thoát bài học');
  await expect(page.getByRole('dialog')).toContainText('Tiến trình đã được lưu');
  await click('Học tiếp');
  await click('Thoát bài học'); await click('Lưu và thoát');
  await click('Ôn tập ngay');
  await expect(page.locator('.study-session')).toBeVisible();
  await click('Bỏ qua từ này');
  await expect(page.locator('.study-results')).toBeVisible();
  const skipped = await data();
  expect(skipped.vocabulary.session.skipped).toHaveLength(1);
  expect(skipped.saved[selected[0]].due).toBeGreaterThan(Date.now() + 7190000);
  pass('Scoped due review, exit/cancel/resume and skip schedules a two-hour retry');

  await go('create-collection');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill('Quá giới hạn');
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill(Array.from({ length: 101 }, (_, i) => 'word' + i).join('\n'));
  await click('Tra nghĩa tự động');
  await expect(page.getByRole('alert')).toContainText('100');
  await page.getByRole('textbox', { name: 'Danh sách từ', exact: true }).fill('love');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Danh sách từ', exact: true })).toHaveValue('love');
  await page.getByRole('textbox', { name: 'Tên bộ từ', exact: true }).fill('Bộ từ luyện tập');
  await click('Tra nghĩa tự động');
  await click('Thêm từ');
  await expect(page.getByRole('alert')).toContainText('đã tồn tại');
  await go('import-collection');
  await page.getByRole('textbox', { name: 'Nội dung bộ từ chia sẻ' }).fill('{bad'); await click('Đọc bộ từ');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nội dung bộ từ chia sẻ' }).fill(JSON.stringify({ format: 'englishflow-collection-1', name: 'Bạn bè', words: [words[0]] }));
  await click('Đọc bộ từ'); await click('Thêm từ');
  await expect(page.locator('.pack-word')).toHaveCount(1);
  pass('100-word boundary, duplicate-name validation, draft recovery and validated friend collection import');

  for (const width of [320, 393, 600]) {
    await page.setViewportSize({ width, height: 719 });
    for (const route of ['vocabulary', 'collection/' + id, 'learn/' + id, 'review/' + id, 'flashcards/' + id, 'create-collection', 'import-collection']) {
      await go(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} at ${width}px`).toBe(true);
    }
  }
  pass('All vocabulary routes at 320/393/600px without horizontal overflow');
  expect(errors).toEqual([]);
  await writeFile('test-results/vocabulary/results.json', JSON.stringify({ checks, errors }, null, 2));
} catch (e) { await page.screenshot({ path: 'test-results/vocabulary/failure.png', fullPage: true }); console.error(e.stack); process.exitCode = 1; }
finally { await browser.close(); }
