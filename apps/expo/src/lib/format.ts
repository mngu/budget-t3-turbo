export const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

// Hermes ignores signDisplay, so the plus sign is added by hand.
export const signedEuro = (amount: number) =>
  `${amount > 0 ? "+" : ""}${euro.format(amount)}`;
