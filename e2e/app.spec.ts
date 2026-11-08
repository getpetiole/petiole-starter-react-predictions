// The app as a visitor uses it, against the Prism mock: the key checked,
// kept and forgotten, under the site's Content Security Policy.
import { expect, type Page, test } from "@playwright/test";

const KEY = `ptl_live_${"a1B2".repeat(10)}xyz`;

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

test("asks for a key, refuses one that can't be a key, and takes a good one", async ({ page }) => {
  const clean = noCspViolations(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your API key" })).toBeVisible();

  await enterKey(page, "sk-not-a-petiole-key");
  await expect(page.getByRole("alert")).toContainText("starts with ptl_live_");

  await enterKey(page);
  await expect(page.getByRole("heading", { name: "Your key works" })).toBeVisible();
  await expect(page.getByText("Your key is kept in this tab.")).toBeVisible();
  clean();
});

test("remembers the key on this device when asked, and forgets it", async ({ page }) => {
  await page.goto("/");
  await enterKey(page, KEY, true);
  await expect(page.getByText("Your key is kept on this device.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Your key works" })).toBeVisible();

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
