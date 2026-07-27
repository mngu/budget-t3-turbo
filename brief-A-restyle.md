# Brief A — Refonte visuelle à structure constante

## Le produit

Outil de finances personnelles, à usage strictement privé (une seule personne, pas de
SaaS, pas d'onboarding à vendre). Il synchronise les transactions de 3 comptes bancaires
(Revolut, Caisse d'Épargne, Société Générale), les catégorise automatiquement, et sert à
faire la revue du budget du mois. Toute l'interface est en **français**.

L'écran à redessiner est l'écran principal : la page des transactions.

## Ce que je te demande

**Garde la structure et l'ordre des blocs à l'identique.** Je veux une refonte
purement visuelle : hiérarchie typographique, densité, espacement, couleur, traitement
des graphiques et du tableau. Ne réorganise pas la page, n'ajoute pas de blocs, n'en
retire pas.

Structure actuelle, de haut en bas :

1. **En-tête** — titre « Transactions », liens Catégories / Banques, bouton
   « Synchroniser », bascule de thème, et un sélecteur de période (flèche mois
   précédent · « 1 juil. 2026 – 31 juil. 2026 » · flèche mois suivant).
2. **Barre de filtres** — champ de recherche (libellé, contrepartie), sélecteur Banque,
   sélecteur Type (Débits / Crédits), sélecteur Catégorie, lien « Réinitialiser ».
3. **Deux tuiles de total** côte à côte — « Total dépenses » 15 591,62 € et
   « Total revenues » 12 132,98 €.
4. **Deux cartes de répartition** côte à côte — dépenses à gauche, revenus à droite.
   Chacune : une barre horizontale empilée par catégorie parente, triée par montant
   décroissant, segmentée par sous-catégorie. Le libellé et le montant sont au-dessus de
   la barre. Cliquer filtre le tableau.
5. **Tableau des transactions** — colonnes Date, Libellé, Banque, Nom, Catégorie,
   Montant. La catégorie est un menu déroulant modifiable directement dans la ligne.
6. **Pagination** — 25 lignes par page.

## Données réelles à utiliser (pas de lorem ipsum)

Période : juillet 2026. Dépenses 15 591,62 € · Revenus 12 132,98 €.

Catégories de dépenses, avec leurs sous-catégories :

- **Loisirs** 4 418,85 € (28 %) — Non ventilé 3 427,50 · Parc attractions 401,00 ·
  Sports activités 356,95 · Adhésions clubs 126,80 · Jeux loisirs 73,00 ·
  Cinéma spectacles 33,60
- **Revenus** 3 698,60 € (24 %) — Apport Alex 3 418,60 · Remboursements 280,00
- **Logement** 1 905,46 € (12 %) — Loyer 1 600,00 · Charges 191,96 · Assurances 113,50
- **Restauration** 1 059,09 € (7 %) — Restaurant 975,64 · Snack fast food 26,80 ·
  Café boulangerie 23,65 · Glaces 19,00 · Pizzeria 14,00
- **Alimentaire** 975,91 € (6 %) — Supermarché 667,97 · Boulangerie 124,37 ·
  Fruits légumes 71,99 · Surgelés 42,45 · Fromage laiterie 27,37 · Non ventilé 14,50 ·
  Livraison courses 14,06 · Épicerie fine 13,20
- **Périscolaire** 889,08 € · **Assurance épargne** 881,10 € · **Impôts** 703,39 € ·
  **Autres** 292,00 € · **Achats** 254,79 € · **Maison** 253,05 € · **Services**
  181,70 € · **Transport** 44,70 € · **Santé** 33,90 €

Lignes de transaction représentatives :

| Date | Libellé | Banque | Nom | Catégorie | Montant |
|---|---|---|---|---|---|
| 26 juil. 2026 | Rcs Loisirs | Revolut (Commun) | ALEX MARTIN | Parc attractions | −52,50 € |
| 26 juil. 2026 | Votre Marche | Revolut (Commun) | CAMILLE DURAND | Supermarché | −3,78 € |
| 25 juil. 2026 | La Langoust In | Revolut (Commun) | ALEX MARTIN | Restaurant | −111,00 € |
| 17 juil. 2026 | VIR SEPA ALEX MARTIN | Caisse d'Épargne (perso) | — | Apport Alex | −500,00 € |
| 10 juil. 2026 | Remboursement periscolaire | Revolut (Commun) | Alex Martin | Remboursements | −280,00 € |

Note les libellés bancaires : bruts, en majuscules, parfois tronqués. Le design doit
rester lisible avec ça, pas seulement avec des noms de marque propres.

## Contraintes non négociables

- **Français** partout. Montants au format fr-FR : `15 591,62 €` (espace insécable,
  virgule décimale).
- **Thème clair et thème sombre**, tous les deux conçus, pas une inversion automatique.
- Chaque catégorie parente porte **une couleur** qui l'identifie partout dans
  l'application ; ses sous-catégories doivent se lire comme une famille de cette couleur,
  pas comme des couleurs indépendantes.
- Environ **15 catégories parentes** affichées simultanément dans la carte des dépenses.
  Une palette qui ne tient qu'à 5 couleurs ne marchera pas.
- Les écarts de montants sont énormes (13,20 € à 4 418,85 €) : les plus petites
  catégories doivent rester visibles et cliquables.
- Desktop d'abord (usage sur grand écran), mais la page ne doit jamais défiler
  horizontalement.

## Ce que je veux en retour

L'écran complet, dans les deux thèmes, avec les vraies données. Les décisions que
j'attends de toi : échelle typographique, densité et rythme vertical, traitement des
surfaces (cartes, bordures, ombres), palette de catégories, et le style des barres
empilées et du tableau.
