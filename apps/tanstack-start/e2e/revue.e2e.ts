import { expect, test } from "@playwright/test";

const monthLabel = (date: Date) => {
  const label = date.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// The current month may hold a single day of data; the previous one is always complete.
const now = new Date();
const previousMonth = new URLSearchParams({
  dateFrom: new Date(
    now.getFullYear(),
    now.getMonth() - 1,
    1,
  ).toLocaleDateString("sv-SE"),
  dateTo: new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString(
    "sv-SE",
  ),
}).toString();

// Clicks before hydration land on inert server-rendered markup.
const hydrated = { waitUntil: "networkidle" } as const;

test("la revue s'ouvre sur le mois courant", async ({ page }) => {
  await page.goto("/", hydrated);

  await expect(
    page.getByRole("button", { name: "Choisir une période" }),
  ).toContainText(monthLabel(now));
  await expect(page.getByText("Solde")).toBeVisible();
});

test("le sélecteur de période recule d'un mois", async ({ page }) => {
  await page.goto("/", hydrated);

  await page.getByRole("button", { name: "Période précédente" }).click();

  await expect(
    page.getByRole("button", { name: "Choisir une période" }),
  ).toContainText(
    monthLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
  );
});

test("une famille au budget détaillé affiche la somme de ses enfants", async ({
  page,
}) => {
  await page.goto(`/?${previousMonth}`, hydrated);

  const alimentation = page
    .getByRole("button")
    .filter({ hasText: "Alimentation" });
  await expect(alimentation).toContainText(/Budget\s*:\s*570,00/);
});

test("la table liste les transactions de la période", async ({ page }) => {
  await page.goto(`/transactions?${previousMonth}`, hydrated);

  await expect(page.locator("tbody tr").nth(4)).toBeVisible();
});

test("le sélecteur de comptes exclut un compte", async ({ page }) => {
  await page.goto("/", hydrated);
  const picker = page.getByRole("button", { name: "Comptes inclus" });

  await picker.click();
  await page.getByRole("menuitemcheckbox", { name: /^Revolut/ }).click();
  await page.keyboard.press("Escape");

  await expect(picker).toContainText("2/3");
});

const iso = (d: Date) => d.toLocaleDateString("sv-SE");
const day = (month: number, date: number) =>
  new Date(now.getFullYear(), month, date);

// Shortcuts mean "relative to today", whatever period is on screen.
const presets = [
  ["Ce mois", day(now.getMonth(), 1), day(now.getMonth() + 1, 0)],
  ["Mois dernier", day(now.getMonth() - 1, 1), day(now.getMonth(), 0)],
  ["30 derniers jours", day(now.getMonth(), now.getDate() - 29), now],
  [
    "Ce trimestre",
    day(now.getMonth() - (now.getMonth() % 3), 1),
    day(now.getMonth() - (now.getMonth() % 3) + 3, 0),
  ],
  ["Cette année", day(0, 1), day(12, 0)],
] as const;

for (const [label, from, to] of presets) {
  test(`le raccourci « ${label} » part d'aujourd'hui`, async ({ page }) => {
    // Start a year back so a shortcut anchored on the displayed period shows.
    await page.goto(
      `/?dateFrom=${iso(day(now.getMonth() - 12, 1))}&dateTo=${iso(day(now.getMonth() - 11, 0))}`,
      hydrated,
    );

    await page.getByRole("button", { name: "Choisir une période" }).click();
    await page.getByRole("button", { name: label, exact: true }).click();

    await expect(page).toHaveURL(
      new RegExp(`dateFrom=${iso(from)}&dateTo=${iso(to)}`),
    );
  });
}
