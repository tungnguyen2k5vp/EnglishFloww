import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:5178";
const browser = await chromium.launch({
  channel: process.env.TEST_BROWSER ?? "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const checks = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name) => {
  checks.push(name);
  console.log("PASS:", name);
};
async function go(hash) {
  await page.goto(base + "/#" + hash);
  await expect(page.locator("main h1").first()).toBeVisible();
}
try {
  await mkdir("test-results", { recursive: true });
  await go("home");
  await expect(page.getByText("Chào Bạn, học một chút nhé.")).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-home.png",
    fullPage: true,
  });
  check("App launch and actual zero-state dashboard");
  for (const route of [
    "dictionary",
    "vocabulary",
    "reading",
    "listening",
    "practice",
    "progress",
    "settings",
  ]) {
    await go(route);
    await expect(
      page.locator(".empty").filter({ hasText: "Không thể mở trang học này" }),
    ).toHaveCount(0);
  }
  check("All primary navigation routes");
  await go("dictionary");
  await page.getByRole("textbox", { name: "Tìm từ điển" }).fill("habit");
  await page.locator(".dictionary-result").filter({ has: page.getByText("habit", { exact: true }) }).click();
  await expect(page.locator(".dictionary-entry h3")).toHaveText("thói quen");
  await page.getByRole("button", { name: "Lưu từ để ôn tập" }).click();
  await page.reload();
  await go("vocabulary");
  await expect(page.locator(".word-name strong")).toHaveText("habit");
  check("Dictionary lookup, save and persistence after refresh");
  await page.getByRole("button", { name: "Tạo bộ từ", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tên bộ từ", exact: true })
    .fill("My English");
  await page
    .getByRole("textbox", { name: "Mô tả", exact: true })
    .fill("Personal study");
  await page.getByRole("button", { name: "Lưu bộ từ", exact: true }).click();
  await page.getByRole("button", { name: /My English/ }).click();
  await page.getByRole("button", { name: "Chỉnh sửa", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Tên bộ từ", exact: true })
    .fill("My daily English");
  await page.getByRole("button", { name: "Lưu bộ từ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /My daily English/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Thêm từ vào bộ", exact: true })
    .selectOption("journey");
  await expect(page.locator(".word-name strong")).toHaveText("journey");
  await page
    .getByRole("button", { name: "Bỏ journey khỏi bộ", exact: true })
    .click();
  await expect(page.locator(".word-name")).toHaveCount(0);
  check("Create/edit collection and add/remove collection word");
  await go("review");
  await page.getByRole("button", { name: "Hiện đáp án" }).click();
  await expect(page.locator(".flashcard-answer")).toContainText("thói quen");
  await page.getByRole("button", { name: /Nhớ được/ }).click();
  await expect(page.locator(".review-summary")).toBeVisible();
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("englishflow.v1")).saved.habit,
  );
  expect(saved.repetitions).toBe(1);
  expect(saved.interval).toBe(1);
  expect(saved.due).toBeGreaterThan(Date.now() + 23 * 3600000);
  check("Real review result and future SM-2 scheduling");
  await go("reading/small-habits");
  await expect(page.locator(".translation")).toHaveCount(4);
  await page.getByRole("button", { name: "Ẩn bản dịch", exact: true }).click();
  await expect(page.locator(".translation")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hiện bản dịch", exact: true })
    .click();
  await page
    .locator(".reading-paragraph .word-link")
    .filter({ hasText: "habit" })
    .first()
    .click();
  await expect(page.locator("dialog")).toBeVisible();
  await expect(page.locator("dialog h2")).toHaveText("habit");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Đánh dấu bài học", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Lưu vị trí đoạn 2", exact: true })
    .click();
  await page.reload();
  await expect(page.locator("#paragraph-small-habits-1")).toHaveClass(
    /current-paragraph/,
  );
  await expect(
    page.getByRole("button", { name: "Bỏ đánh dấu", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  check(
    "Bilingual reading, shared lookup, bookmarks and restored reading position",
  );
  await page.getByRole("button", { name: "Làm bài đọc hiểu" }).click();
  await page.locator(".answer").filter({ hasText: "It was easier" }).click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("Chính xác");
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.locator(".answer").first().click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("Chưa đúng");
  await page.getByRole("button", { name: "Xem kết quả" }).click();
  await expect(page.locator(".quiz-summary")).toContainText("1 / 2 câu đúng");
  check("Quiz score, immediate explanations and mistake review");
  await go("practice");
  await page.getByRole("button", { name: /Present simple/ }).click();
  await page.locator(".answer").filter({ hasText: "studies" }).click();
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("Chính xác");
  check("Grammar lesson and answer explanation");
  for (const mode of ["Điền từ", "Gõ từ", "Chính tả"]) {
    await go("practice");
    await page
      .getByRole("button", { name: "Luyện từ vựng", exact: true })
      .click();
    await page.getByRole("button", { name: mode, exact: true }).click();
    await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await page.getByRole("textbox", { name: "Đáp án của bạn" }).fill("habit");
    await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
    await expect(page.locator(".feedback")).toContainText("Chính xác");
  }
  check("Gap-fill, typed answer and spelling exercise engines");
  await go("listening/morning-audio");
  await page.locator("audio").evaluate(async (el) => {
    await new Promise((resolve, reject) => {
      if (el.readyState >= 1) return resolve();
      el.addEventListener("loadedmetadata", resolve, { once: true });
      el.addEventListener("error", reject, { once: true });
    });
  });
  expect(await page.locator("audio").evaluate((el) => el.duration)).toBeCloseTo(
    32,
    0,
  );
  await page
    .getByRole("button", { name: "Phát lại câu 2", exact: true })
    .click();
  await expect
    .poll(() => page.locator("audio").evaluate((el) => el.currentTime))
    .toBeGreaterThanOrEqual(8);
  await page
    .getByRole("combobox", { name: "Tốc độ phát", exact: true })
    .selectOption("1.25");
  expect(await page.locator("audio").evaluate((el) => el.playbackRate)).toBe(
    1.25,
  );
  await page.locator("audio").evaluate((el) => el.pause());
  await page
    .getByRole("button", { name: "Chép chính tả", exact: true })
    .click();
  await page.getByRole("button", { name: "Bắt đầu luyện tập" }).click();
  await page
    .getByRole("textbox", { name: "Đáp án của bạn" })
    .fill("Every morning, I take a break before I check my phone.");
  await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("Chính xác");
  check("Actual audio metadata, seek, rate, sentence replay and dictation");
  await go("listening/garden-video");
  await expect
    .poll(() => page.locator("video").evaluate((el) => el.readyState))
    .toBeGreaterThanOrEqual(1);
  expect(
    await page.locator("video").evaluate((el) => el.duration),
  ).toBeGreaterThan(31);
  await page
    .getByRole("button", { name: "Phát lại câu 3", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".transcript-line.active").textContent())
    .toContain("Children discover");
  await page.locator("video").evaluate((el) => el.pause());
  check("Original narrated video plays and timed transcript synchronizes");
  await go("dictionary");
  await page
    .getByRole("textbox", { name: "Tìm từ điển" })
    .fill("no-such-word-xyz");
  await expect(page.getByText("Chưa có từ này trong bộ mẫu")).toBeVisible();
  await page.getByRole("button", { name: "Xóa tìm kiếm", exact: true }).click();
  await expect(page.locator(".dictionary-result")).toHaveCount(12);
  check("Search empty and clear states");
  await go("settings");
  await page.getByRole("textbox", { name: "Tên hiển thị" }).fill("An");
  await page
    .getByRole("spinbutton", { name: "Mục tiêu mỗi ngày (phút)" })
    .fill("20");
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: "Mục tiêu mỗi ngày (phút)" }),
  ).toHaveValue("20");
  check("Preferences persist");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất toàn bộ dữ liệu" }).click();
  const backup = await downloadPromise;
  expect(backup.suggestedFilename()).toBe("englishflow-backup.json");
  const before = await page.evaluate(() =>
    localStorage.getItem("englishflow.v1"),
  );
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999}'),
    });
  await expect(page.getByRole("status")).toContainText("không hợp lệ");
  expect(
    await page.evaluate(() => localStorage.getItem("englishflow.v1")),
  ).toBe(before);
  check("Backup download and malformed import rejected without data loss");
  await go("progress");
  await expect(page.locator(".history-list")).toContainText("Ôn từ: habit");
  await expect(page.locator(".history-list")).toContainText(
    "Small habits, meaningful changes",
  );
  check("History and skill statistics come from recorded events");
  if (
    await page
      .getByRole("button", { name: "Đóng thông báo", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Đóng thông báo", exact: true })
      .click();
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const hash of [
      "home",
      "dictionary",
      "vocabulary",
      "reading",
      "reading/small-habits",
      "listening/garden-video",
      "practice",
      "progress",
      "settings",
    ]) {
      await go(hash);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, `${hash} overflows at ${width}px`).toBe(false);
    }
    await go("home");
    await page.screenshot({
      path: `test-results/home-${width}.png`,
      fullPage: true,
    });
  }
  check(
    "Nine routes at mobile, tablet and desktop widths have no horizontal overflow",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở tất cả mục" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/is-open/);
  await page.locator('.sidebar a[href="#dictionary"]').click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/is-open/);
  check("Compact mobile navigation");
  const isolated = await browser.newContext();
  const privatePage = await isolated.newPage();
  await privatePage.goto(base);
  expect(
    await privatePage.evaluate(() => localStorage.getItem("englishflow.v1")),
  ).toBeNull();
  await isolated.close();
  check(
    "Separate browser profiles do not share local data (no server authentication claimed)",
  );
  expect(errors).toEqual([]);
  check("No uncaught browser errors");
  await writeFile(
    "test-results/report.json",
    JSON.stringify(
      { base, browser: process.env.TEST_BROWSER ?? "chrome", checks, errors },
      null,
      2,
    ),
  );
  console.log(`\n${checks.length} browser workflow groups passed.`);
} catch (error) {
  await page.screenshot({ path: "test-results/failure.png", fullPage: true });
  console.error("FAILED", error);
  throw error;
} finally {
  await context.close();
  await browser.close();
}
