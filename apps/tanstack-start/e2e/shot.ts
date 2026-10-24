import { test } from "@playwright/test";

test("shot", async ({ page }, { project }) => {
  await page.goto(process.env.SHOT ?? "/");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `test-results/shot-${project.name}.png` });
});
