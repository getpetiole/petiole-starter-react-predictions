// The app as a visitor uses it, against the Prism mock: the key, the model's
// state, a photo, what was found and its downloads, under the site's
// Content Security Policy.
import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";

const KEY = `ptl_live_${"a1B2".repeat(10)}xyz`;
const PHOTO = new URL("./leaf.jpg", import.meta.url).pathname;

/** Fails the test on any message the Content Security Policy logs. */
function noCspViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  return () => expect(violations).toEqual([]);
}

async function enterKey(page: Page, key = KEY, remember = false) {
  await page.getByLabel("API key", { exact: true }).fill(key);
  if (remember) await page.getByLabel("Remember the key on this device").check();
  await page.getByRole("button", { name: "Use this key" }).click();
}

test("asks for a key, refuses one that can't be a key, and takes a good one", async ({ page, isMobile }) => {
  const clean = noCspViolations(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your API key" })).toBeVisible();

  await enterKey(page, "sk-not-a-petiole-key");
  await expect(page.getByRole("alert")).toContainText("starts with ptl_live_");

  await enterKey(page);
  await expect(page.getByRole("heading", { name: "Leaf detector" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Ready");
  await expect(page.getByText("Your key is kept in this tab.")).toBeVisible();
  // A phone can take the photo with its camera.
  await expect(page.getByText("Take a photo", { exact: true })).toHaveCount(isMobile ? 1 : 0);
  clean();
});

test("finds the leaves in a photo, draws them, and downloads them", async ({ page }) => {
  const clean = noCspViolations(page);
  await page.goto("/");
  await enterKey(page);
  await expect(page.getByRole("status")).toContainText("Ready");

  await page.locator('input[type="file"]').first().setInputFiles(PHOTO);
  await expect(page.getByText("640 × 480 px, 7 KB, sent as it is.")).toBeVisible();
  await page.getByRole("button", { name: "Find the leaves" }).click();

  const found = page.getByRole("heading", { level: 2, name: /^1 leaf/ });
  await expect(found).toBeVisible();
  await expect(page.locator("svg.overlay rect").first()).toBeVisible();
  await expect(page.getByRole("table", { name: "What the model found" }).getByRole("row")).toHaveCount(2);

  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const csvFile = await csv;
  expect(csvFile.suggestedFilename()).toBe("leaf-found.csv");
  expect(readFileSync(await csvFile.path(), "utf8")).toMatch(/^n,label,confidence,x,y,width,height/);

  const png = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download annotated PNG" }).click();
  expect((await png).suggestedFilename()).toBe("leaf-found.png");

  // Above every score found, nothing is shown, and the page says what to do.
  await page.getByLabel(/Least confidence shown/).fill("0.95");
  await expect(page.getByRole("heading", { level: 2, name: /^Nothing found/ })).toBeVisible();
  await expect(page.getByText("Move the slider left")).toBeVisible();
  clean();
});

test("remembers the key on this device when asked, and forgets it", async ({ page }) => {
  await page.goto("/");
  await enterKey(page, KEY, true);
  await expect(page.getByText("Your key is kept on this device.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Leaf detector" })).toBeVisible();

  await page.getByRole("button", { name: "Forget the key" }).click();
  await expect(page.getByRole("heading", { name: "Your API key" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your API key" })).toBeVisible();
});

test("the site's API refuses what the app does not call", async ({ request }) => {
  const refused = await request.get("/api/v1/workflows", { headers: { authorization: `Bearer ${KEY}` } });
  expect(refused.status()).toBe(404);
  expect((await refused.json()).code).toBe("not_found");
});
