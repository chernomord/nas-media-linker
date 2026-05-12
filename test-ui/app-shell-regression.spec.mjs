import { expect, test } from "@playwright/test";

async function setShoelaceValue(page, selector, value) {
  await page.locator(selector).evaluate((element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new CustomEvent("sl-input", { bubbles: true, composed: true }));
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

  const label = row.locator('[data-role="name"]').first();
  await expect(label).toBeVisible();

  const tooltipState = await label.evaluate((element) => {
    const portal = document.getElementById("floating_tooltip_portal");
    const tooltip = portal?.querySelector('[data-role="floating-tooltip"]');
    return {
      hasTitle: element.hasAttribute("title"),
    portalId: portal?.id ?? "",
    tooltipRole: tooltip?.getAttribute("data-role") ?? "",
    tooltipHidden: Boolean(tooltip?.hidden),
    };
  });

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

  expect(tooltipState.hasTitle).toBe(false);
  expect(tooltipState.portalId).toBe("floating_tooltip_portal");
  expect(tooltipState.tooltipRole).toBe("name-tooltip");
  expect(tooltipState.tooltipHidden).toBe(true);
  expect(metrics.textOverflow).toBe("ellipsis");
  expect(metrics.whiteSpace).toBe("nowrap");
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.rowRight).toBeLessThanOrEqual(metrics.listRight + 1);
  await expect(row.locator("sl-button")).toHaveCount(2);
  await expect(row.locator("sl-button").last()).toBeVisible();
});

test("browse torrents file rows can fill the movie source uid", async ({ page }) => {
  await page.goto("/");

  await setShoelaceValue(page, "#root", "torrents");
  await page.locator("#browse").click();

  const fileName = "Taboo.Gohatto.1999.1080p.WEB-DL.mkv";
  const row = page.locator("#list li").filter({ hasText: fileName }).first();
  await expect(row).toBeVisible();

  await expect(row.locator("sl-button")).toHaveCount(2);
  await row.locator("sl-button").last().click();

  await expect(page.locator("#m_src")).toHaveValue(/^\d+:\d+$/);
  await expect(page.locator("#s_src")).toHaveValue("");
});

test("preview cards keep long titles inside the linking column", async ({ page }) => {
  await page.goto("/");

  await setShoelaceValue(page, "#m_title", "Kimetsu");
  await setShoelaceValue(page, "#m_year", "2024");

  await page.waitForFunction(() => {
    const list = document.getElementById("m_preview_list");
    return Boolean(list && !list.classList.contains("hidden") && list.children.length > 0);
  });

  const card = page.locator("#m_preview_list > div").first();
  await expect(card).toBeVisible();
  await expect(card.locator("sl-button")).toHaveCount(1);

  const metrics = await card.evaluate((element) => {
    const list = document.getElementById("m_preview_list");
    const cardRect = element.getBoundingClientRect();
    const listRect = list?.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      cardRight: cardRect?.right ?? 0,
      listRight: listRect?.right ?? 0,
      cardWidth: cardRect?.width ?? 0,
      listWidth: listRect?.width ?? 0,
      overflow: style.overflow,
    };
  });

  expect(metrics.overflow).toBe("hidden");
  expect(metrics.cardRight).toBeLessThanOrEqual(metrics.listRight + 1);
  expect(metrics.cardWidth).toBeLessThanOrEqual(metrics.listWidth + 1);
});

test("saved list keeps long names truncated inside the card", async ({ page }) => {
  await page.goto("/");

  const row = page.locator("#saved_list li").first();
  await expect(row).toBeVisible();

  const label = row.locator('[data-role="name"]').first();
  await expect(label).toBeVisible();

  const tooltipState = await label.evaluate((element) => {
    const portal = document.getElementById("floating_tooltip_portal");
    const tooltip = portal?.querySelector('[data-role="floating-tooltip"]');
    return {
      hasTitle: element.hasAttribute("title"),
      portalId: portal?.id ?? "",
      tooltipRole: tooltip?.getAttribute("data-role") ?? "",
      tooltipHidden: Boolean(tooltip?.hidden),
    };
  });

  const metrics = await label.evaluate((element) => {
    const rowElement = element.closest("li");
    const listElement = document.querySelector("#saved_list");
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

  expect(tooltipState.hasTitle).toBe(false);
  expect(tooltipState.portalId).toBe("floating_tooltip_portal");
  expect(tooltipState.tooltipRole).toBe("name-tooltip");
  expect(tooltipState.tooltipHidden).toBe(true);
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

test("season autocomplete renders in a portal with clean hover styling", async ({ page }) => {
  await page.goto("/");

  await setShoelaceValue(page, "#s_title", "Kimetsu");
  await page.waitForFunction(() => {
    const ac = document.getElementById("s_ac");
    return ac && !ac.classList.contains("hidden") && ac.children.length > 0;
  });

  const acState = await page.locator("#s_ac").evaluate((ac) => {
    const style = getComputedStyle(ac);
    return {
      position: style.position,
      parentId: ac.parentElement?.id ?? "",
      maxHeight: style.maxHeight,
    };
  });

  expect(acState.position).toBe("fixed");
  expect(acState.parentId).toBe("autocomplete_portal");
  expect(acState.maxHeight).not.toBe("none");

  const firstOption = page.locator("#s_ac button").first();
  await firstOption.hover();

  const optionStyles = await firstOption.evaluate((option) => {
    const style = getComputedStyle(option);
    return {
      appearance: style.appearance,
      borderTopStyle: style.borderTopStyle,
      backgroundColor: style.backgroundColor,
    };
  });

  expect(optionStyles.appearance).toBe("none");
  expect(optionStyles.borderTopStyle).toBe("none");
  expect(optionStyles.backgroundColor).toMatch(/241, 245, 249/);
  await expect(page.locator("#s_ac")).toContainText("Kimetsu no Yaiba result 1");
});

test("log dialog header-actions align with the standard dialog header", async ({ page }) => {
  await page.goto("/");

  await page.locator("#open_log").click();

  const dialogState = await page.locator("#log_modal").evaluate((dialog) => {
    const title = dialog.shadowRoot?.querySelector('[part="title"]');
    const clear = dialog.querySelector("#clear_log");
    const actions = dialog.shadowRoot?.querySelector('[part="header-actions"]');
    const close = dialog.shadowRoot?.querySelector('[part="close-button"]');
    const titleRect = title?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const clearRect = clear?.getBoundingClientRect();
    const closeRect = close?.getBoundingClientRect();
    return {
      titleColor: title ? getComputedStyle(title).color : "",
      titleCenterY: titleRect ? titleRect.top + titleRect.height / 2 : 0,
      actionsCenterY: actionsRect ? actionsRect.top + actionsRect.height / 2 : 0,
      clearCenterY: clearRect ? clearRect.top + clearRect.height / 2 : 0,
      closeCenterY: closeRect ? closeRect.top + closeRect.height / 2 : 0,
      titleTop: titleRect?.top ?? 0,
      actionsTop: actionsRect?.top ?? 0,
    };
  });

  expect(dialogState.titleColor).toBe("rgb(15, 23, 42)");
  expect(Math.abs(dialogState.titleTop - dialogState.actionsTop)).toBeLessThan(3);
  expect(Math.abs(dialogState.clearCenterY - dialogState.closeCenterY)).toBeLessThan(3);
});
