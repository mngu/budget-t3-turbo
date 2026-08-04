// Formateurs Intl partagés. Ils étaient redéclarés à l'identique d'un écran à
// l'autre : un Intl.NumberFormat est coûteux à construire et doit de toute
// façon rester cohérent partout.
export const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

// Arrondi à l'euro, pour les chiffres de tête des bandeaux : les centimes ne se
// lisent pas à 30 ou 44 px et font sauter la colonne d'un mois à l'autre. Le
// détail (lignes de liste, survol, table) garde `euro`, à deux décimales.
export const euro0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Même arrondi, signé : un solde annonce son sens, un total de flux non.
export const signedEuro0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

export const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

// Sans l'année : les écrans de la revue sont déjà bornés à un mois, la répéter
// sur chaque ligne fait passer la colonne de date sur deux lignes.
export const dayMonthFr = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

// Montant signé : le « + » n'apparaît que sur les crédits, jamais sur zéro.
// Les débits gardent leur signe naturel. C'est le format de la colonne Montant
// de la table, où les deux sens se croisent ligne à ligne.
export const signedEuro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  signDisplay: "exceptZero",
});

// Les contreparties arrivent des banques en capitales (« CAMILLE DURAND »),
// ce qui crie au milieu d'une colonne de 11,5 px. La maquette les repasse en
// casse de titre ; les libellés de transaction, eux, n'y touchent pas — ce sont
// des chaînes bancaires brutes, que réécrire rendrait moins reconnaissables.
export function titleCase(value: string) {
  // Le trait d'union compte comme une frontière de mot, sinon « DURAND »
  // ressort en « Durand ». L'apostrophe, non : elle produirait « L'Oreal ».
  return value
    .toLocaleLowerCase("fr-FR")
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, boundary: string, letter: string) =>
        boundary + letter.toLocaleUpperCase("fr-FR"),
    );
}

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
