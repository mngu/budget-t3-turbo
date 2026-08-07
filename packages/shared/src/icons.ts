// Jeu fermé d'icônes des catégories parentes — pendant de `colors.ts` : une
// catégorie principale s'identifie par sa teinte *et* son icône, et les deux se
// choisissent au même endroit (page /categories).
//
// Ce fichier ne contient que des **noms Lucide et des mots-clés français**,
// jamais de composant : `@budget/shared` n'a que `zod` en dépendance runtime et
// c'est la raison d'être du package (voir CLAUDE.md). La résolution nom →
// composant se fait côté app, où `lucide-react` vit déjà.
//
// Les mots-clés servent la recherche du sélecteur : l'utilisateur tape en
// français (« courses », « essence », « impôts »), le nom Lucide anglais reste
// accepté en second recours.

export interface CategoryIcon {
  /** Nom Lucide en kebab-case — c'est lui qui est stocké dans `categories.icon`. */
  name: string;
  /** Mots-clés français, séparés par des espaces, pour la recherche. */
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

// 6 familles de 9 icônes. Le découpage thématique n'est qu'un ordre
// d'affichage : la recherche traverse tous les groupes.
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

// Recherche du sélecteur : mots-clés français d'abord, nom Lucide anglais en
// second recours. Une requête vide rend le jeu complet, groupes inclus ; les
// groupes devenus vides disparaissent (l'appelant n'a rien à filtrer).
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
