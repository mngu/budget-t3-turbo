# Brief B — Table rase

## Le produit

Outil de finances personnelles, à usage strictement privé (une seule personne, pas de
SaaS, pas d'onboarding à vendre, personne à convaincre). Il synchronise les transactions
de 3 comptes bancaires (Revolut, Caisse d'Épargne, Société Générale), les catégorise
automatiquement par IA, et sert à faire la revue du budget du mois. Toute l'interface est
en **français**.

## Ce que je te demande

Repense l'écran principal **sans partir d'une maquette existante**. Je ne te donne pas de
structure : je te donne le travail que l'écran doit permettre. Propose la mise en page,
la hiérarchie et les composants qui servent le mieux ce travail — y compris si ça veut
dire ne pas afficher tout d'un coup, ou découper en plusieurs vues.

## Le travail à faire sur cet écran

Je l'ouvre une à deux fois par semaine, presque toujours sur le mois en cours, pour
répondre à ces questions, dans cet ordre d'importance :

1. **Est-ce que le mois se passe bien ?** Combien j'ai dépensé, combien est rentré, et
   est-ce que c'est normal par rapport aux mois précédents.
2. **Où est parti l'argent ?** Quelles catégories pèsent, et à l'intérieur d'une
   catégorie, quelles sous-catégories. C'est là que je passe le plus de temps.
3. **Qu'est-ce qui est mal classé ?** La catégorisation est automatique et se trompe.
   Je dois repérer les transactions douteuses et **corriger la catégorie sur place**,
   sans changer d'écran. C'est l'action la plus fréquente de tout le produit.
4. **Retrouver une transaction précise.** « C'était combien, le restaurant du 25 ? »

Contexte utile : une part importante des dépenses reste « Non ventilé », c'est-à-dire
rattachée à une catégorie parente sans sous-catégorie précise. Sur Loisirs, c'est 3 427 €
sur 4 419 €. Voir et réduire cette part est un objectif en soi — l'écran devrait m'aider
à m'en rendre compte plutôt que de le noyer.

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

Note les libellés bancaires : bruts, en majuscules, parfois tronqués, souvent peu
parlants. Le design doit rester lisible avec ça, pas seulement avec des noms de marque
propres.

## Contraintes non négociables

- **Français** partout. Montants au format fr-FR : `15 591,62 €` (espace insécable,
  virgule décimale).
- **Thème clair et thème sombre**, tous les deux conçus, pas une inversion automatique.
- Chaque catégorie parente porte **une couleur** qui l'identifie partout dans
  l'application ; ses sous-catégories doivent se lire comme une famille de cette couleur,
  pas comme des couleurs indépendantes.
- Environ **15 catégories parentes** et jusqu'à 8 sous-catégories par parent. Une palette
  qui ne tient qu'à 5 couleurs ne marchera pas.
- Les écarts de montants sont énormes (13,20 € à 4 418,85 €) : les petites catégories
  doivent rester atteignables.
- Il faut pouvoir **filtrer** par période, banque, sens (débit / crédit), catégorie, et
  par texte libre — mais tu décides comment ces filtres se présentent.
- Il faut pouvoir **changer la catégorie d'une transaction** depuis cet écran.
- Environ 200 à 400 transactions par mois : une liste complète non paginée n'est pas
  réaliste.
- Desktop d'abord, mais jamais de défilement horizontal de la page.

## Liberté explicite

Tu n'es tenu par aucun composant, aucune palette et aucune mise en page existante. Si le
bon design consiste à faire de la répartition par catégorie l'objet principal et à
reléguer la liste des transactions au second plan, propose-le. Si deux vues valent mieux
qu'une, propose-le aussi — mais dis-moi alors ce qu'on perd.

## Ce que je veux en retour

Deux ou trois directions distinctes, pas trois variantes de la même. Pour chacune :
l'écran complet dans les deux thèmes, avec les vraies données, et une phrase sur le parti
pris — ce que cette direction met en avant, et ce qu'elle sacrifie.
