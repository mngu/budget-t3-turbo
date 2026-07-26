// Formateurs Intl partagés. Ils étaient redéclarés à l'identique dans la route
// des transactions, transaction-preview-drawer et range-picker : un
// Intl.NumberFormat est coûteux à construire et doit de toute façon rester
// cohérent d'un écran à l'autre.
export const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const percentFr = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

// Un montant non nul ne doit jamais s'afficher « 0 % » : ça se lit comme un bug.
export function sharePercent(part: number, whole: number) {
  if (whole === 0 || part === 0) return percentFr.format(0);
  const share = part / whole;
  return share < 0.01 ? "< 1 %" : percentFr.format(share);
}
