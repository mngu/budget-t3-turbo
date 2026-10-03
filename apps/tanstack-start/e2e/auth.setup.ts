import { execFileSync } from "node:child_process";

import { expect, test as setup } from "@playwright/test";

import { DEMO_STATE } from "../playwright.config";

// Reseed on every run so specs start from the same « Démo » space.
setup("seed the demo space and sign in", async ({ page }) => {
  const output = execFileSync("pnpm", ["-F", "@budget/api", "seed:demo"], {
    encoding: "utf8",
  });
  const link = /\/api\/auth\/magic-link\/verify\S+/.exec(output)?.[0];
  if (!link) throw new Error(`Lien de connexion absent :\n${output}`);

  await page.goto(link);
  await expect(
    page.getByRole("button", { name: "Choisir une période" }),
  ).toBeVisible();
  await page.context().storageState({ path: DEMO_STATE });
});
