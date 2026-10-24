import { expect, test } from "@playwright/test";

test("la page de connexion renvoie vers la revue une fois connecté", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(
    page.getByRole("button", { name: "Choisir une période" }),
  ).toBeVisible();
});
