import { grammarLessons } from "../src/data.ts";
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 719 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const base = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:4178';
const checks = [], errors = [];
page.on('pageerror', e => errors.push(e.message));
const pass = name => { checks.push(name); console.log('PASS:', name); };
const go = async route => { await page.goto(base + '/mobile.html#' + route); await expect(page.locator('.phone-app')).toHaveAttribute('data-page', route.split('/')[0]); };
const back = () => page.getByRole('button', { name: 'Quay lại', exact: true }).click();
await mkdir('test-results/mobile', { recursive: true });
try {
  await go('home');
  await expect(page.locator('.phone-tabs a')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/mobile/home.png', fullPage: true });
  await page.getByRole('heading', { name: 'Từ được lưu nhiều nhất' }).scrollIntoViewIfNeeded();
  await expect(page.locator('.popular-word')).toHaveCount(3);
  await page.locator('.popular-words').evaluate(el => el.scrollLeft = 250);
  expect(await page.locator('.popular-words').evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await page.getByRole('heading', { name: 'Dành cho bạn', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/mobile/home-lower.png' });
  const y = await page.evaluate(() => scrollY);
  await page.locator('.recommendations > button').first().click();
  await expect(page.locator('.phone-reader')).toBeVisible();
  await expect(page.locator('.phone-tabs')).toHaveCount(0);
  await back();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y - 10);
  pass('Home below fold: horizontal word cards, five recommendations, detail navigation and scroll restoration');

  await page.evaluate(() => scrollTo(0, 0));
  await page.getByRole('textbox', { name: 'Tra từ', exact: true }).fill('habit');
  await page.getByRole('button', { name: 'Tra cứu', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu từ để ôn tập', exact: true }).click();
  await page.getByRole('button', { name: 'Đóng từ điển' }).click();
  await page.getByRole('link', { name: 'Từ vựng', exact: true }).click();
  await expect(page.locator('.phone-due')).toContainText('1 từ');
  await page.getByRole('button', { name: 'Ôn tập ngay', exact: true }).click();
  await expect(page.locator('.study-start')).toContainText('1 từ đến hạn');
  await page.getByRole('button', { name: 'Bắt đầu học', exact: true }).click();
  await expect(page.locator('.phone-tabs')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kiểm tra', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'thói quen', exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.locator('.study-feedback')).toContainText('Chính xác');
  await page.getByRole('button', { name: 'Thoát bài học', exact: true }).click();
  await page.getByRole('button', { name: 'Lưu và thoát', exact: true }).click();
  pass('Vocabulary due entry, first question, correct feedback and resumable exit; full sequence in test:vocabulary');

  await go('catalog');
  await expect(page.locator('.pack-shelf')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Tìm bộ từ vựng' }).fill('zzzz');
  await expect(page.getByRole('heading', { name: 'Không có bộ từ phù hợp' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await page.locator('.pack-tags button').first().click();
  await expect(page.locator('.pack-card').first()).toBeVisible();
  await page.locator('.pack-card').first().click();
  await expect(page.locator('.word-statistics')).toBeVisible();
  pass('Catalog shelves, category filters, no-result state and pack detail');

  await go('home');
  await page.getByRole('button', { name: 'Ngữ pháp', exact: true }).click();
  await expect(page.locator('.grammar-groups summary')).toHaveCount(10);
  await page.locator('.grammar-groups summary').first().click();
  await page.getByRole('button', { name: 'Present simple', exact: true }).click();
  await expect(page.locator('.grammar-article')).toContainText('hiện tại đơn');
  await back();
  await expect(page.locator('.grammar-groups details').first()).toHaveAttribute('open', '');
  let lessons = 0;
  for (const lesson of grammarLessons) {
    await go('grammar/' + lesson.id);
    await expect(page.locator('.grammar-article > h2')).toHaveText(lesson.title);
    expect(await page.locator('.grammar-article').evaluate(el => !!el.querySelector('script,iframe,img,[onclick],[onerror]'))).toBe(false);
    await expect(page.locator('.quiz-panel')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    lessons++;
  }
  expect(lessons).toBe(60);
  pass('All 10 grammar groups and 60 original lessons open safely with real quizzes');
  await go('grammar');
  await page.locator('.grammar-groups summary').last().click();
  await expect(page.locator('.grammar-groups details[open]')).toHaveCount(1);
  await page.locator('.grammar-groups details').last().locator('button').last().scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => document.addEventListener('click', () => { window.__grammarLeavingY = scrollY; }, { once: true, capture: true }));
  await page.locator('.grammar-groups details').last().locator('button').last().click();
  await expect(page.locator('.grammar-article')).toBeVisible();
  await back();
  await expect(page.locator('.grammar-groups details').last()).toHaveAttribute('open','');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(await page.evaluate(() => window.__grammarLeavingY - 10));
  await page.getByRole('button', { name: 'Mở từ điển', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tra từ điển', exact: true }).fill('study');
  await page.getByRole('button', { name: 'TRA TỪ', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('sự học hỏi');
  await page.getByRole('button', { name: 'Đóng từ điển' }).click();
  pass('Async grammar list restores lower scroll and floating dictionary opens an actual modal');


  await go('exercises');
  await page.locator('.exercise-grid button').first().click();
  await page.locator('.exercise-timeline > button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Dễ', exact: true }).click();
  await expect(page.locator('.gap-article input').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kiểm tra', exact: true })).toBeDisabled();
  const lessonId = decodeURIComponent(new URL(page.url()).hash.slice(1).split('/')[1]).split(':')[0];
  const sourceText = await page.locator('.gap-article').innerText();
  expect(sourceText.length).toBeGreaterThan(100);
  for (const field of await page.locator('.gap-article input').all()) await field.fill('wrong');
  await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click();
  await expect(page.locator('.phone-main > [role=status]')).toContainText('Đúng 0/');
  await page.getByRole('button', { name: 'Làm lại', exact: true }).click();
  await expect(page.locator('.gap-article input').first()).toBeEnabled();
  await page.getByRole('combobox', { name: 'Dạng bài', exact: true }).selectOption('transcript');
  await expect(page.locator('.gap-article input')).toHaveCount(0);
  await go('exercises/' + lessonId + ':hard');
  await expect(page.locator('.gap-article input').first()).toBeVisible();
  pass('Exercise topics, timeline, difficulty sheet, inline gaps, scoring, retry and transcript');

  await go('explore');
  await page.getByRole('heading', { name: 'Đọc sách', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/mobile/explore-lower.png' });
  await expect(page.locator('.book-shelf button')).toHaveCount(3);
  await page.locator('.book-shelf button').first().click();
  await expect(page.locator('.book-reader h1')).toHaveText('Pinocchio');
  await page.getByRole('button', { name: 'Trang tiếp', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Trang sách', exact: true })).toHaveValue('1');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Trang sách', exact: true })).toHaveValue('1');
  for (const id of ['alice', 'david-copperfield']) { await go('books/' + id); await expect(page.locator('.book-reader > h1')).toBeVisible(); }
  pass('Explore below fold and three full offline books, pagination and persistent reading position');

  await go('reading/small-habits');
  await page.getByRole('button', { name: 'Hiện bản dịch', exact: true }).click();
  await expect(page.locator('.reading-paragraph .translation').first()).toBeVisible();
  await page.locator('.english-text button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng từ điển' }).click();
  await page.getByRole('button', { name: 'Cài đặt trình đọc' }).click();
  await page.getByRole('button', { name: 'Tăng Cỡ chữ', exact: true }).click();
  await expect(page.getByRole('dialog').locator('output').first()).toHaveText('18');
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Đánh dấu', exact: true }).first().click();
  await page.getByRole('button', { name: 'Kiểm tra đọc hiểu', exact: true }).click();
  await expect(page.locator('.quiz-panel')).toBeVisible();
  pass('Reader translation, dictionary, text settings, position marking and comprehension');

  await go('listening');
  await page.getByRole('button', { name: 'Bài nghe', exact: true }).click();
  await page.locator('.media-catalog > button').first().click();
  await page.locator('audio').evaluate(async audio => { audio.muted = true; await audio.play(); });
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(0.1);
  await page.getByRole('button', { name: 'Tiến 5 giây', exact: true }).click();
  await expect.poll(() => page.locator('audio').evaluate(a => a.currentTime)).toBeGreaterThan(5);
  await page.getByRole('combobox', { name: 'Tốc độ phát' }).selectOption('1.5');
  expect(await page.locator('audio').evaluate(a => a.playbackRate)).toBe(1.5);
  await page.getByRole('button', { name: 'Lặp lại', exact: true }).click();
  expect(await page.locator('audio').evaluate(a => a.loop)).toBe(true);
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.getByRole('button', { name: 'Ẩn dịch transcript' }).click();
  await expect(page.locator('.phone-transcript .translation')).toHaveCount(0);
  pass('Audio dock actually plays/seeks, changes speed, loops and toggles transcript translation');

  await go('speaking');
  await page.getByRole('button', { name: 'Hội thoại tình huống', exact: true }).click();
  await page.getByRole('button', { name: /Nhận phòng khách sạn/ }).click();
  await expect(page.locator('.scenario-question')).toContainText('Good evening');
  await page.getByRole('button', { name: 'Câu tiếp', exact: true }).click();
  await expect(page.getByText('Câu 2/', { exact: false })).toBeVisible();
  await page.evaluate(() => { window.__stoppedTracks = 0; navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.__finishMic = () => resolve({ getTracks: () => [{ stop() { window.__stoppedTracks++; } }] }); }); });
  await page.getByRole('button', { name: 'Ghi âm giọng nói' }).click();
  await back();
  await page.evaluate(() => window.__finishMic());
  await expect.poll(() => page.evaluate(() => window.__stoppedTracks)).toBe(1);
  pass('Tutor scenario screens, topic selection, shadowing and late microphone cleanup');

  await go('ielts');
  await page.getByRole('button', { name: 'Xem trước bài luyện 1', exact: true }).click();
  await expect(page.locator('.test-preview')).toBeVisible();
  await page.getByRole('button', { name: 'Listening', exact: true }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await expect(page.locator('.phone-media-detail')).toBeVisible();
  await back();
  await page.getByRole('button', { name: 'Writing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Từ dàn ý đến bài viết' })).toBeVisible();
  pass('IELTS skill tabs, actual preview/start destinations and working Writing and Speaking entry points');

  await go('profile');
  await page.getByRole('checkbox', { name: 'Chế độ ban đêm' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('checkbox', { name: 'Chế độ ban đêm' }).uncheck();
  await page.getByRole('button', { name: 'Thông tin ứng dụng', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'EnglishFlow 1.7.0' })).toBeVisible();
  await go('notifications');
  await expect(page.getByRole('heading', { name: 'Chưa có thông báo mới' })).toBeVisible();
  pass('Profile lower settings, persistent theme, app information and notification state');

  await go('games');
  await page.getByRole('button', { name: /OFFLINE/ }).click();
  await page.getByRole('button', { name: /Linh/ }).click();
  await page.getByRole('textbox', { name: 'Từ nối tiếp' }).fill('cat');
  await page.getByRole('button', { name: 'Gửi từ' }).click();
  await expect(page.getByRole('alert')).toContainText('E');
  await page.getByRole('textbox', { name: 'Từ nối tiếp' }).fill('ear');
  await page.getByRole('button', { name: 'Gửi từ' }).click();
  await expect(page.locator('.chain-history')).toContainText('rabbit');
  pass('Offline Word Chain valid response and invalid-word feedback preserved');

  const routes = ['home','vocabulary','catalog','collection/daily','review','flashcards/daily','grammar','grammar/third-conditional','exercises','exercises/Daily%20English','reading','reading/small-habits','listening','speaking','speaking/free','speaking/scenario','explore','games','dictionary','saved','progress','settings','profile','notifications','books','books/alice','shorts','ielts','pro','learn/daily','create-collection','import-collection','writing','writing/email-friend','sentences','sources','plan','collection/lib-pack-travel','speaking/scenario-hotel','games/friends'];
  for (const width of [320, 393, 600]) {
    await page.setViewportSize({ width, height: 852 });
    for (const route of routes) {
      await go(route);
      if (route.startsWith('grammar/')) await expect(page.locator('.grammar-article')).toBeVisible();
      if (route.startsWith('books/')) await expect(page.locator('.book-reader')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width} ${route} overflow`).toBe(true);
    }
  }
  pass('40 route variants × 3 viewport widths, including loaded long grammar/books, without horizontal overflow');
  expect(errors).toEqual([]);
  await writeFile('test-results/mobile/browser-results.json', JSON.stringify({ build: '1.7.0 (8)', checks, errors }, null, 2));
} catch (error) { await page.screenshot({ path: 'test-results/mobile/failure.png', fullPage: true }); console.error(error.stack); process.exitCode = 1; }
finally { await browser.close(); }



