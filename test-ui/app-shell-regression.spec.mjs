import { expect, test } from "@playwright/test";

async function setShoelaceValue(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new CustomEvent("sl-change", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test("browse list keeps long names truncated inside the card", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Quick NAS linking console" })).toBeVisible();

  await setShoelaceValue(page, "#root", "movies");
  await page.locator("#browse").click();

  const longName = "A.Knight.of.the.Seven.Kingdoms.S01.2160p.2026.2160p.WEB-DL.HDR.H.265.Master5";
  const row = page.locator("#list li").filter({ hasText: longName }).first();
  await expect(row).toBeVisible();

  const label = row.locator("sl-tooltip.list-name-tooltip span").first();
  await expect(label).toBeVisible();

  const metrics = await label.evaluate((element) => {
    const rowElement = element.closest("li");
    const listElement = document.querySelector("#list");
    const style = getComputedStyle(element);
    const rowRect = rowElement?.getBoundingClientRect();
    const listRect = listElement?.getBoundingClientRect();
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      rowRight: rowRect?.right ?? 0,
      listRight: listRect?.right ?? 0,
    };
  });

  expect(metrics.textOverflow).toBe("ellipsis");
  expect(metrics.whiteSpace).toBe("nowrap");
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.rowRight).toBeLessThanOrEqual(metrics.listRight + 1);
  await expect(row.locator("sl-button").last()).toBeVisible();
});

test("locale switch updates copy without a page reload", async ({ page }) => {
  await page.goto("/");

  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText("Quick NAS linking console");

  await page.evaluate(() => {
    window.__uiRegressionMarker = "preserved";
  });

  await page.locator('[data-locale-switcher] [data-locale="ru"]').click();

  await expect(title).toHaveText("Быстрая консоль линковки NAS");
  await expect(page.locator("#browse")).toHaveText("Показать папки");
  await expect(page.locator("#logout_btn")).toHaveText("Выйти");

  const marker = await page.evaluate(() => window.__uiRegressionMarker);
  expect(marker).toBe("preserved");
});
