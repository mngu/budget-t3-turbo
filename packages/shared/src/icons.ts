// Keep icon metadata dependency-free; the app resolves names to Lucide components.

export interface CategoryIcon {
  /** Lucide kebab-case name stored in categories.icon. */
  name: string;
  /** Space-separated French search keywords. */
  keywords: string;
}

export interface CategoryIconGroup {
  label: string;
  icons: readonly CategoryIcon[];
}

const group = (
  label: string,
  icons: [string, string][],
): CategoryIconGroup => ({
  label,
  icons: icons.map(([name, keywords]) => ({ name, keywords })),
});

const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] = [
  group("Alimentation", [
    ["shopping-cart", "courses supermarché caddie"],
    ["utensils", "restaurant resto couverts repas"],
    ["croissant", "boulangerie viennoiserie"],
    ["apple", "fruits légumes primeur"],
    ["beef", "boucherie viande"],
    ["coffee", "café bar"],
    ["wine", "vin cave apéritif"],
    ["ice-cream-cone", "glaces dessert"],
    ["pizza", "pizzeria"],
  ]),
  group("Transport", [
    ["car", "voiture auto"],
    ["bus", "bus tram transport"],
    ["train-front", "train sncf"],
    ["plane", "avion voyage vol"],
    ["fuel", "essence carburant station"],
    ["square-parking", "parking stationnement"],
    ["bike", "vélo"],
    ["ship", "bateau ferry"],
    ["road", "péage autoroute route"],
  ]),
  group("Logement", [
    ["house", "logement maison"],
    ["key-round", "loyer clés bail"],
    ["zap", "électricité énergie"],
    ["droplets", "eau"],
    ["flame", "gaz chauffage"],
    ["wifi", "internet box"],
    ["sofa", "meubles ameublement salon"],
    ["hammer", "bricolage travaux"],
    ["sprout", "jardin plantes"],
  ]),
  group("Loisirs & famille", [
    ["ferris-wheel", "parc attractions fête"],
    ["film", "cinéma spectacle"],
    ["music", "musique concert"],
    ["gamepad-2", "jeux vidéo console"],
    ["dumbbell", "sport salle musculation"],
    ["baby", "garde enfants bébé"],
    ["graduation-cap", "école périscolaire cantine études"],
    ["book-open", "livres lecture"],
    ["paw-print", "animaux chien chat vétérinaire"],
  ]),
  group("Argent & santé", [
    ["wallet", "revenus salaire paie"],
    ["banknote", "virement espèces"],
    ["piggy-bank", "épargne économies"],
    ["landmark", "impôts taxes banque"],
    ["receipt", "factures frais"],
    ["shield", "assurance mutuelle prévoyance"],
    ["heart-pulse", "santé médecin"],
    ["pill", "pharmacie médicaments"],
    ["shopping-bag", "achats shopping"],
  ]),
  group("Divers", [
    ["smartphone", "téléphone mobile abonnement"],
    ["tv", "streaming abonnements télé"],
    ["shirt", "vêtements habillement"],
    ["scissors", "coiffeur beauté"],
    ["gift", "cadeaux"],
    ["briefcase", "travail pro"],
    ["plane-takeoff", "vacances voyage"],
    ["hand-heart", "dons association"],
    ["sparkles", "divers autres"],
  ]),
] as const;

export const CATEGORY_ICON_NAMES: string[] = CATEGORY_ICON_GROUPS.flatMap((g) =>
  g.icons.map((i) => i.name),
);

export function searchCategoryIcons(query: string): CategoryIconGroup[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [...CATEGORY_ICON_GROUPS];
  return CATEGORY_ICON_GROUPS.map((g) => ({
    label: g.label,
    icons: g.icons.filter(
      (i) => i.keywords.includes(q) || i.name.includes(q.replace(/\s+/g, "-")),
    ),
  })).filter((g) => g.icons.length > 0);
}
