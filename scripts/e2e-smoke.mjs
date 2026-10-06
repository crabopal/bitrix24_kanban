/**
 * E2E smoke: mock-канбан — фильтр, drag, маппинг.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/opt/cursor/artifacts";
const VIDEO_DIR = path.join(OUT, "playwright-video");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1400, height: 900 } },
  });
  const page = await context.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForSelector(".column-title", { timeout: 15000 });

  await page.screenshot({
    path: path.join(OUT, "kanban_board_loaded.png"),
    fullPage: true,
  });

  // --- Search ---
  await page.fill("#search", "CI");
  await page.waitForTimeout(800);
  const visibleTitles = await page.locator(".card-title").allTextContents();
  console.log("after search CI:", visibleTitles);
  if (!visibleTitles.some((t) => t.includes("CI"))) {
    throw new Error(`Search failed, titles: ${visibleTitles.join(" | ")}`);
  }
  await page.screenshot({ path: path.join(OUT, "kanban_search_ci.png") });

  await page.fill("#search", "");
  await page.waitForTimeout(800);

  // --- Drag: Сверстать лендинг → В работе ---
  const card = page.locator(".card", { hasText: "Сверстать лендинг" }).first();
  const targetCol = page.locator(".column", { hasText: "В работе" }).first();
  const box = await card.boundingBox();
  const targetBox = await targetCol.boundingBox();
  if (!box || !targetBox) throw new Error("No bounding boxes for drag");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 12);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 120, {
    steps: 20,
  });
  await page.mouse.up();
  await page.waitForTimeout(1200);

  const toast = page.locator(".toast");
  const toastText = (await toast.count()) ? await toast.textContent() : null;
  console.log("toast:", toastText);

  const inProgressTitles = await targetCol.locator(".card-title").allTextContents();
  console.log("В работе after drag:", inProgressTitles);
  if (!inProgressTitles.some((t) => t.includes("Сверстать лендинг"))) {
    throw new Error("Drag did not move card into В работе");
  }
  await page.screenshot({ path: path.join(OUT, "kanban_after_drag.png") });

  // --- Mapping modal ---
  await page.getByRole("button", { name: "Маппинг стадий" }).click();
  await page.waitForSelector("#mapping-title", { timeout: 5000 });
  await page.screenshot({ path: path.join(OUT, "kanban_mapping_modal.png") });
  await page.getByRole("button", { name: "Отмена" }).click();
  await page.waitForTimeout(400);

  if (errors.length) {
    console.warn("page errors:", errors);
  }

  await context.close();
  await browser.close();

  const videos = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (videos.length) {
    const src = path.join(VIDEO_DIR, videos[0]);
    const dest = path.join(OUT, "kanban_mock_e2e_demo.webm");
    fs.renameSync(src, dest);
    console.log("video:", dest);
  }

  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
