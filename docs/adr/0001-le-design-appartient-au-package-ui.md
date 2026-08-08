# ADR-0001 — Le design appartient à `@budget/ui`

- **Date** : 2026-08-08
- **Statut** : accepté
- **Portée** : `packages/ui`, tous ses appelants dans `apps/tanstack-start`

## Contexte

Les écrans sont le portage d'une maquette Claude Design, et le portage s'est
fait maquette par maquette. Chaque écran a donc recopié les valeurs du HTML
source dans ses propres `className`, y compris pour des objets d'interface
parfaitement ordinaires — menus, boutons, panneaux — que la maquette redessine
à chaque page mais qui sont partout les mêmes.

Trois conséquences, constatées en refaisant le menu de l'engrenage
d'`AppHeader` :

1. **La cohérence n'est garantie par rien.** Le deuxième menu de l'app recopie
   les valeurs du premier, ou pas. Rien ne le dit, rien ne le vérifie, et une
   retouche de style doit être retrouvée dans chaque écran.
2. **Le comportement se recode avec le style.** Refaire un menu à la main, c'est
   refaire des `<button>` sans rôle ARIA, sans navigation au clavier, sans
   anneau de focus et sans fermeture à la sélection — tout ce que la primitive
   apporte déjà se reperd à chaque réécriture.
3. **Le style de l'appelant se bat avec celui du composant.** Dès qu'un
   composant de `@budget/ui` entre dans un écran, la moitié des classes de
   l'appel sert à annuler les siennes, avec des conflits qui ne se voient pas à
   la lecture (l'ordre de `tailwind-merge`, un sélecteur du composant qui teinte
   les icônes descendantes…).

## Décision

**`@budget/ui` porte le design ; les écrans le consomment.** Concrètement :

- Un écran monte un composant de `@budget/ui` **sans `className`**. Une classe à
  l'appel signale soit un besoin réel qui manque au composant — l'ajouter
  là-bas, comme variante — soit une divergence à abandonner.
- Un état qui a une primitive **passe par la primitive** plutôt que par une
  classe conditionnelle : un groupe radio pour un choix, `aria-current` pour la
  page où l'on se trouve, une variante de bouton pour un rôle.
- Quand un état n'a pas de primitive, **son style va dans le composant**, pas
  dans l'appelant.
- Un défaut de la sortie de `shadcn add` qui ne convient pas se corrige **dans
  le composant**, et se commente sur place pour qu'une régénération ne l'efface
  pas par distraction.
- Les écrans gardent leurs propres classes pour ce qui leur appartient en
  propre : leur **mise en page** (grilles, gouttières, largeurs) et les
  composants nés de la maquette et d'elle seule (`BudgetGauge`, `BreakdownRow`,
  l'anneau…). La frontière est là : ce qui existe dans toute application est du
  ressort du package, ce qui n'existe que dans celle-ci reste dans l'écran.

## Conséquences

- **La maquette cesse d'être la référence au pixel pour les objets communs.**
  Un composant repris de `@budget/ui` peut avoir un autre gabarit, d'autres
  intitulés, d'autres marques d'état que le HTML source. C'est accepté : un
  style commun modifiable en un point vaut mieux que des copies fidèles et
  divergentes. Resserrer les menus, plus tard, se fera dans le package et tous
  les menus suivront.
- **Certaines affordances de la maquette disparaissent** quand la primitive n'a
  pas d'emplacement pour elles et que l'information est déjà lisible ailleurs à
  l'écran. Cet arbitrage se fait au cas par cas, mais toujours dans ce sens-là.
- **Le style est arbitré une fois, ailleurs que dans l'urgence d'un écran.**
  Changer d'avis coûte un fichier dans `packages/ui/src/`.
- **`packages/ui/components.json` décide de ce que produit `shadcn add`** — la
  famille de primitives (`base` / `style`) et la librairie d'icônes — et il faut
  le lire avant d'ajouter un composant. Un champ absent ne laisse pas le CLI
  sans réponse : il retombe sur son défaut historique, qui n'est pas forcément
  celui du projet. `npx shadcn@latest info -c packages/ui --json` affiche la
  configuration résolue, valeurs par défaut comprises.

## Alternative écartée

Un module de classes partagées (`MENU_ITEM_CLASS` & co., exportées et reprises à
chaque appel) donnerait la cohérence sans toucher aux composants. Écarté : il
laisse l'appelant libre de ne pas s'en servir, ne dit rien du comportement, et
ne résout pas le conflit avec les classes que le composant pose déjà.
