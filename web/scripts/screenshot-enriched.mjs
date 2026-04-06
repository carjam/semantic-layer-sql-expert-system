/**
 * Capture /enriched for README. Requires dev server: npm run dev (port 3000).
 * Usage: node scripts/screenshot-enriched.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outPath = path.join(root, "docs", "images", "enriched-output.png");
const base =
  process.env.BASE_URL ||
  process.env.PLAYWRIGHT_BASE_URL ||
  "http://127.0.0.1:3000";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/enriched`, { waitUntil: "networkidle", timeout: 120000 });
await page.getByRole("heading", { name: "Enriched output" }).waitFor({ timeout: 15000 });
await page.getByText("Loading…").waitFor({ state: "hidden", timeout: 60000 });
await page.waitForSelector("table", { timeout: 15000 });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log("Wrote", outPath);
