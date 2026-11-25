import { chromium, expect } from "@playwright/test";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:4178";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + "/#settings");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("main h1")).toContainText("Góc học");
  await page.locator('.sidebar a[href="#reading"]').click();
  await expect(page.locator("main h1")).toContainText("Đọc để khám phá");
  console.log(
    "PASS: Production service worker restores app shell and reading library offline",
  );
  await context.setOffline(false);
  await page.goto(base + "/#dictionary");
  await page.getByRole("textbox", { name: "Tìm từ điển" }).fill("habit");
  await page.locator(".dictionary-result").filter({ has: page.getByText("habit", { exact: true }) }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Lưu từ để ôn tập" }).click();
  await expect(page.getByRole("status")).toContainText("Không thể lưu");
  await expect(
    page.getByRole("button", { name: "Lưu từ để ôn tập" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("englishflow.v1") ?? '{"saved":{}}')
          .saved.habit,
    ),
  ).toBeUndefined();
  console.log(
    "PASS: Quota failure leaves UI and stored vocabulary unchanged and reports recovery",
  );
  await context.close();
  const recovery = await browser.newContext();
  const repair = await recovery.newPage();
  await repair.goto(base);
  await repair.evaluate(() =>
    localStorage.setItem("englishflow.v1", "{broken-original"),
  );
  await repair.reload();
  await expect(repair.getByRole("alert")).toContainText(
    "Bản gốc được giữ nguyên",
  );
  expect(
    await repair.evaluate(() => localStorage.getItem("englishflow.v1")),
  ).toBe("{broken-original");
  await repair
    .getByRole("button", { name: "Tải bản gốc", exact: true })
    .click();
  await repair
    .getByRole("button", { name: "Bắt đầu lại trên thiết bị", exact: true })
    .click();
  await expect(repair.getByRole("alert")).toHaveCount(0);
  console.log("PASS: Corrupt data preserved until explicit recovery/reset");
  await repair.locator(".top-search input").fill("habit");
  await repair.locator(".top-search input").press("Enter");
  await expect(repair.locator("dialog")).toBeVisible();
  await repair.keyboard.press("Escape");
  await expect(repair.locator("dialog")).toHaveCount(0);
  await repair.setViewportSize({ width: 390, height: 844 });
  await repair.getByRole("button", { name: "Mở tất cả mục" }).click();
  await expect(repair.locator(".sidebar nav a").first()).toBeFocused();
  await repair.keyboard.press("Escape");
  await expect(repair.locator(".sidebar")).not.toHaveClass(/is-open/);
  console.log("PASS: Keyboard dictionary dialog and mobile menu focus/Escape");
  await repair.goto(base + "/#settings");
  await repair.getByRole("textbox", { name: "Tên hiển thị" }).fill("Lan");
  await repair
    .getByRole("spinbutton", { name: "Mục tiêu mỗi ngày (phút)" })
    .fill("25");
  await repair.getByRole("button", { name: "Lưu thay đổi" }).click();
  const backupText = await repair.evaluate(() =>
    localStorage.getItem("englishflow.v1"),
  );
  await repair
    .getByRole("textbox", { name: "Tên hiển thị" })
    .fill("New profile");
  await repair
    .getByRole("combobox", { name: "Giao diện", exact: true })
    .selectOption("dark");
  await repair.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(repair.locator("html")).toHaveAttribute("data-theme", "dark");
  await repair
    .locator("input[type=file]")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(backupText),
    });
  await expect(
    repair.getByRole("textbox", { name: "Tên hiển thị" }),
  ).toHaveValue("New profile");
  await repair
    .getByRole("button", { name: "Thay thế bằng bản sao lưu" })
    .click();
  await expect(
    repair.getByRole("textbox", { name: "Tên hiển thị" }),
  ).toHaveValue("Lan");
  await expect(
    repair.getByRole("spinbutton", { name: "Mục tiêu mỗi ngày (phút)" }),
  ).toHaveValue("25");
  await expect(repair.locator("html")).toHaveAttribute("data-theme", "light");
  await repair
    .getByRole("button", { name: "Xóa dữ liệu học tập", exact: true })
    .click();
  await expect(
    repair.getByRole("button", { name: "Xóa vĩnh viễn trên thiết bị" }),
  ).toBeDisabled();
  await repair.getByRole("textbox", { name: "Xác nhận xóa" }).fill("XÓA");
  await repair
    .getByRole("button", { name: "Xóa vĩnh viễn trên thiết bị" })
    .click();
  await expect(
    repair.getByRole("textbox", { name: "Tên hiển thị" }),
  ).toHaveValue("Bạn");
  await expect(
    repair.getByRole("spinbutton", { name: "Mục tiêu mỗi ngày (phút)" }),
  ).toHaveValue("15");
  console.log(
    "PASS: Valid restore requires confirmation, updates profile/theme, and explicit deletion resets state and form",
  );
  await recovery.close();
} finally {
  await browser.close();
}
