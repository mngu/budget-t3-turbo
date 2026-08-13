const DATE_FR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** « 12 juil. 2026 » — les dates d'un espace se lisent au jour, jamais à l'heure. */
export const dateFr = (iso: string) => DATE_FR.format(new Date(iso));
