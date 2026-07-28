# Brief C — La page Catégories

## Le produit

Outil de finances personnelles, à usage strictement privé (une seule personne, pas de
SaaS, pas d'onboarding à vendre, personne à convaincre). Il synchronise les transactions
de 3 comptes bancaires (Revolut, Caisse d'Épargne, Société Générale), les catégorise
automatiquement par IA, et sert à faire la revue du budget du mois. Toute l'interface est
en **français**.

## Ce que je te demande

**Le système de design existe déjà.** Les écrans de la revue du mois sont le portage de la
maquette « Revue du mois » (projet `fc13100e-7ea1-4dac-8d2f-6614e40a7209`). Deux écrans
secondaires n'ont jamais été portés et sont restés au look shadcn générique d'avant :
`/categories` et `/banques`. **Ce brief ne traite que `/categories`** — les banques font
l'objet d'un brief séparé. Dessine-la **dans le langage de cette maquette**, pas dans un
troisième langage.

C'est un écran d'**états**, pas de mise en page : sa difficulté est le nombre de
situations à couvrir (vide, en cours, avertissement, confirmation destructive). Je veux
chaque état dessiné, pas seulement le cas nominal.

**Deux choses vont au-delà du restyle**, et ce sont les plus intéressantes :

- le **mécanisme de suggestion de catégories par l'IA** ne me convainc pas dans son
  fonctionnement même. Là je veux une **vraie proposition de conception**, avec plusieurs
  directions — voir « Le mécanisme des suggestions IA — table rase » ;
- un **système d'icônes de catégorie**, qui n'existe pas encore, pour distinguer les
  catégories quand la palette de couleurs est saturée — voir « La seconde dimension
  d'identité ».

## Le système à respecter (jeu de tokens de la maquette)

Typo : **Geist Variable** pour le texte, **Geist Mono Variable** pour tous les chiffres
(montants, compteurs) — chiffres tabulaires. Deux micro-styles récurrents : un intitulé de
section en capitales (`10,5 px`, `tracking .06em`, couleur `subtle`) et les nombres en
mono.

Rayon de base `--radius: 0.625rem`. Rôles ajoutés par la maquette au jeu shadcn :
`sunken` (sous le fond : barres d'outils, rails), `surface-2` (entre le fond et la carte :
en-têtes de groupe, lignes survolées), `subtle` (3ᵉ palier de texte, sous
`muted-foreground`), `border-strong`, `track`, et trois paires sémantiques
`ok` / `warn` / `bad` avec leur variante `-soft` (fond pâle).

Deux points à ne pas défaire : **`--primary` porte l'accent de marque** (bleu-violet,
`oklch(0.455 0.2 265)` en clair, `oklch(0.735 0.11 266)` en sombre) et non le presque-noir
shadcn — tous les boutons pleins le prennent ; **`--accent` reste le rôle *fond de
survol***, l'accent pâle en aplat s'appelle `accent-soft`.

Valeurs de référence, clair → sombre :

| rôle | clair | sombre |
|---|---|---|
| `background` | `oklch(0.992 0.003 95)` | `oklch(0.232 0.011 265)` |
| `card` | `oklch(1 0 0)` | `oklch(0.262 0.012 265)` |
| `sunken` | `oklch(0.966 0.004 95)` | `oklch(0.208 0.011 265)` |
| `foreground` | `oklch(0.155 0.01 250)` | `oklch(0.905 0.005 265)` |
| `muted-foreground` | `oklch(0.455 0.014 250)` | `oklch(0.712 0.011 265)` |
| `subtle` | `oklch(0.598 0.012 250)` | `oklch(0.625 0.011 265)` |
| `border` | `oklch(0.91 0.006 250)` | `oklch(1 0 0 / 7.5%)` |
| `ok` / `ok-soft` | `oklch(0.555 0.14 150)` / `oklch(0.954 0.045 152)` | `oklch(0.752 0.11 152)` / `oklch(0.328 0.055 152)` |
| `warn` / `warn-soft` | `oklch(0.635 0.15 62)` / `oklch(0.959 0.055 70)` | `oklch(0.79 0.11 72)` / `oklch(0.345 0.055 70)` |
| `bad` / `bad-soft` | `oklch(0.555 0.19 25)` / `oklch(0.957 0.038 25)` | `oklch(0.718 0.125 25)` / `oklch(0.342 0.062 25)` |

Le thème sombre de la maquette est volontairement **plus clair** qu'un dark shadcn (fond
0,232, carte 0,262) et ses accents y sont **moins** saturés qu'en clair. Ne pas le
« corriger » vers du noir.

## L'enveloppe applicative (contrainte technique, non négociable)

L'en-tête de la revue est une barre de 52 px, fond `card`, bordure basse : pastille +
« Budget », sélecteur de mois, trois onglets (Revue du mois · À revoir · Toutes les
transactions), champ de recherche, puis un sélecteur de comptes (qui contient aussi le
bouton « Synchroniser les comptes »), deux liens icônes (Catégories, Banques) et la
bascule de thème.

Cette page **ne peut pas reprendre cet en-tête tel quel** : le sélecteur de mois, les
onglets, la recherche, le badge « À revoir » et le sélecteur de comptes sont tous des
filtres de la revue, que cette page n'a pas. Elle est hors du mois.

Ce que j'attends : **la même chrome** (hauteur, fond, bordure, pastille + « Budget »,
liens icônes et bascule de thème à droite) **sans sélecteur de mois, sans onglets, sans
recherche globale, sans sélecteur de comptes**, plus un retour explicite vers la revue.
À toi de trouver comment cette barre amputée reste manifestement la même barre, et comment
on signale qu'on est dans une page de réglages plutôt que dans le mois.

---

## Le travail à faire sur cet écran

C'est la page où l'on **entretient la taxonomie** qui structure tout le reste de l'app.
Trois tâches, dans cet ordre :

1. **Rattraper les transactions sans catégorie.** Un bandeau annonce le reste à traiter et
   déclenche la catégorisation IA. Une transaction qu'aucune catégorie existante ne décrit
   reste volontairement sans catégorie : un compteur qui ne bouge pas veut dire qu'il
   manque une branche dans l'arbre, et doit m'orienter vers la tâche 2.
2. **Faire proposer une arborescence par l'IA**, la corriger, puis l'appliquer. L'analyse
   dure ~1 minute et n'écrit rien tant que je n'ai pas confirmé.
3. **Entretenir l'arborescence existante à la main** : renommer, ajouter, supprimer,
   changer la couleur **et l'icône** d'une catégorie parente, et vérifier au passage ce
   qu'il y a dedans.

## Le vrai problème de cette page : la couleur

Chaque catégorie **parente** porte une couleur qui l'identifie **partout dans
l'application** (barres de répartition, tuiles, tableau) ; ses sous-catégories se lisent
comme une famille de cette couleur. Cette page est le **seul endroit où cette couleur se
choisit** — et seules les parentes en ont une.

La palette est **fermée et non extensible** : 13 teintes, dérivées et mesurées (écarts en
vision normale et en vision déficiente vérifiés dans les deux thèmes), plus un gris de
repli qui n'est pas sélectionnable et signifie « aucune couleur choisie ». Je ne veux pas
que tu en proposes d'autres, ni que tu en ajoutes une 14ᵉ.

Le problème est donc l'**attribution**, pas la palette : rien ne garantit aujourd'hui
l'unicité. La couleur est choisie par sémantique (l'IA prend « celle qui correspond le
mieux » à chaque parente), et le nombre de parentes n'est pas borné à 13. Résultat
observé en ce moment : deux parentes partagent le violet, deux autres le rose, deux autres
l'ambre, et deux autres encore sont restées au gris de repli. Deux catégories de même
couleur sont indiscernables sur tous les autres écrans.

Ce que j'attends de toi sur ce point :

- un **sélecteur de couleur** qui montre les 13 teintes, **lesquelles sont déjà prises et
  par quelle catégorie**, et l'état « repli / aucune couleur » comme un état à part ;
- un **signal de collision** visible sur les lignes concernées, sans transformer la page
  en champ d'alertes ;
- un traitement du cas **plus de 13 parentes**, où la collision devient arithmétiquement
  inévitable — et c'est ce qui amène le point suivant.

C'est la décision de design la plus importante de cette page.

## La seconde dimension d'identité : un système d'icônes

Puisque la palette est plafonnée à 13 teintes et que le nombre de parentes ne l'est pas,
**la couleur ne peut pas rester seule porteuse de l'identité**. Je veux lui adjoindre une
**icône par catégorie parente**, choisie sur cette page comme l'est la couleur. C'est le
couple *couleur + icône* qui doit devenir discriminant, pas chacun pris isolément.

Conçois ce système, et pas seulement son bouton. Ce que j'attends que tu tranches :

**1. Le sélecteur d'icône — c'est le vrai livrable.** La bibliothèque est **Lucide**
(déjà utilisée partout dans l'app : trait monochrome, ~1500 icônes). Deux difficultés
concrètes :
- 1500 icônes ne se présentent pas en grille. Il faut un **jeu restreint et thématique**
  pour le cas courant (alimentation, transport, logement, loisirs, santé, revenus, impôts,
  abonnements, épargne…) et une **recherche** comme échappatoire pour le reste.
- Les noms Lucide sont en **anglais** (`utensils`, `shopping-cart`, `piggy-bank`,
  `landmark`) alors que toute mon interface est en français. Une recherche qui n'accepte
  que l'anglais est inutilisable ; dis comment tu résous ça (mots-clés français sur le jeu
  restreint, libellés traduits, autre).

**2. Où l'icône apparaît, et où elle n'apparaît pas.** Elle ne remplace pas la couleur :
un segment de barre empilée de 6 px de haut ne peut pas porter d'icône, la couleur y reste
seule. L'icône travaille là où il y a de la place — listes de catégories, tuiles,
sélecteurs, en-tête d'un zoom de catégorie, lignes de table. Sois explicite sur cette
répartition des rôles ; c'est elle qui décide si le système tient.

**3. Le rendu de l'icône.** Elle doit rester lisible à ~14–16 px, dans les deux thèmes.
Teintée de la couleur du parent, posée sur une pastille de fond `-soft`, ou neutre ?
Traite en particulier le cas qui justifie tout ce travail : **deux parentes qui partagent
la même teinte**, où l'icône doit faire seule la différence.

**4. Les sous-catégories.** Aujourd'hui elles n'ont pas de couleur propre et se lisent
comme une famille de celle du parent. Héritent-elles de son icône, en ont-elles une
propre, ou aucune ? Tranche, et dis pourquoi.

**5. L'état « sans icône ».** Une catégorie créée à la main n'a ni couleur ni icône : le
gris de repli a déjà son équivalent côté couleur, il faut le pendant côté icône, et les
deux doivent bien se lire ensemble.

**6. La collision d'icônes.** Deux catégories avec la même icône reposent le même problème
d'un cran plus loin. Le sélecteur doit-il s'en prémunir comme pour les couleurs, ou
suffit-il que le **couple** couleur + icône soit unique ?

**7. Qui choisit ?** L'analyse IA propose déjà une couleur par parente ; elle pourrait
proposer l'icône dans le même mouvement. Est-ce un service rendu, ou une décision de plus
à relire dans une proposition déjà dense ? Ton avis m'intéresse, et il doit être cohérent
avec la direction que tu proposes pour les suggestions (section suivante).

Contrainte technique assumée : aujourd'hui une catégorie ne stocke qu'un nom, une couleur
et son parent. Ce système suppose d'y ajouter un champ « icône » — c'est acquis, ne t'en
prive pas, mais garde-toi d'en supposer d'autres sans le dire.

## Structure actuelle de l'entretien manuel (à restyler, pas à repenser)

1. **Titre** « 🏷️ Catégories » avec une flèche de retour.
2. **Bandeau d'état de catégorisation** — soit `N transaction(s) sans catégorie` (le
   nombre ouvre un aperçu des transactions concernées) avec un bouton « Catégoriser »,
   soit « Toutes les transactions sont catégorisées ».
3. **Arborescence existante** — une carte par parente : pastille de couleur (cliquable),
   nom éditable en place (validé au blur/Entrée), compteur « N txns » cliquable, bouton
   supprimer ; sous-catégories indentées en dessous, même ligne sans la couleur ;
   « Ajouter une sous-catégorie » ; puis « Ajouter une catégorie » en bas.

   La ligne est **déjà chargée** — et l'icône doit y trouver sa place, en plus de la
   couleur. C'est le point de tension de cet écran : chaque ligne accumule un nom éditable,
   deux attributs d'identité, un compteur cliquable et une suppression, sur potentiellement
   60 lignes. Ne la transforme pas en barre d'outils.

Le bloc des suggestions IA, lui, s'intercale aujourd'hui entre 2 et 3 — mais c'est
justement ce que je te demande de reprendre à zéro, voir la section suivante.

## Les états à dessiner (entretien manuel)

- Bandeau **« reste à traiter »** et bandeau **« tout est catégorisé »**. Le reste varie
  d'une poignée à plusieurs centaines selon ce qui vient d'être synchronisé ; les deux
  états doivent exister, et le premier tenir avec un nombre à trois chiffres.
- **Confirmation de suppression** : « Supprimer « Loisirs » ? Cette action est
  irréversible. 5 sous-catégorie(s) seront aussi supprimée(s). 43 transaction(s)
  (y compris dans les sous-catégories) deviendront non-catégorisées. »
- **Aperçu de transactions** (panneau latéral) : ouvert depuis un compteur « N txns »,
  depuis le bandeau sans-catégorie, ou depuis une sous-catégorie suggérée. Titre =
  catégorie, sous-titre du type « 25 transaction(s) — aperçu de cette catégorie (25 plus
  récentes), y compris les sous-catégories », puis les lignes (date, libellé, banque,
  montant).
- **Édition en place** d'un nom, et **arborescence vide** (« Aucune catégorie pour le
  moment »).

---

## Le mécanisme des suggestions IA — table rase

**Sur ce point précis, je ne veux pas une refonte esthétique de ce qui existe. Le
fonctionnement actuel ne me convainc pas, et je veux une vraie proposition de conception.**

### Le travail que ce mécanisme doit servir

L'app a deux moteurs qui se complètent : la **catégorisation** classe chaque transaction
avec l'arbre existant, les **suggestions** créent ce qui manque à cet arbre. Le signal
d'entrée est toujours le même : des transactions restent sans catégorie parce qu'aucune
branche ne les décrit. Ma question, à ce moment-là, est : *qu'est-ce qui manque à mon
arbre, et est-ce que je veux vraiment l'ajouter ?*

Je fais ça peut-être une fois par mois, et jamais dans l'urgence.

### Comment ça marche aujourd'hui

Un bouton « Suggérer des catégories » lance une analyse LLM d'environ une minute sur un
échantillon d'au plus 500 transactions (30 % réservés aux transactions sans catégorie, le
reste pris parmi les récentes déjà classées, pour le contexte). Le modèle renvoie **une
arborescence complète** : des parentes avec leur couleur, chacune avec 2 à 8
sous-catégories, et pour chaque sous-catégorie la liste des transactions de l'échantillon
qui la justifient.

L'écran affiche cet arbre, éditable : renommer, décocher des sous-catégories, ouvrir les
transactions d'exemple. Puis un choix binaire — **Fusionner** ou **Remplacer** — et un
bouton qui applique le tout, après une modale de confirmation.

### Ce qui ne me convainc pas

- **C'est un bloc à prendre ou à laisser.** Le modèle propose un arbre entier alors que
  j'ai déjà un arbre. Je ne peux pas dire « cette branche-là oui, celle-là non » autrement
  qu'en décochant les sous-catégories une par une jusqu'à faire disparaître la parente.
- **Je ne vois jamais le diff.** L'écran montre la proposition seule, sans la confronter à
  l'existant : ce qui est nouveau, ce qui existe déjà sous le même nom, ce qui va être
  ignoré, ce qui va être déplacé — rien de tout ça n'est visible. C'est pourtant la seule
  question qui compte quand on a déjà 60 catégories.
- **Le choix Fusionner / Remplacer est une notion technique posée trop tôt**, avant même
  d'avoir compris la proposition. Et « Remplacer » supprime des catégories **qui ne sont
  pas à l'écran** — puisque, par définition, elles sont absentes de la proposition. On ne
  découvre leur liste que dans le texte de la modale de confirmation.
- **L'application coûte beaucoup plus cher que ce que l'écran laisse croire.** Dans les
  deux modes, y compris le mode « Fusionner » présenté comme additif et sûr, **toute la
  catégorisation automatique est jetée** et entièrement refaite : chaque transaction
  classée par l'IA repasse à « sans catégorie », puis une nouvelle passe LLM tourne. Seules
  mes corrections manuelles sont préservées. C'est long, et l'écran m'envoie ailleurs
  pendant que ça tourne, sans que je puisse suivre ni savoir si ça a échoué.
- **La proposition est éphémère et unique.** Elle vit en mémoire du serveur : un
  redémarrage l'efface, relancer l'analyse écrase la précédente, et on ne peut pas
  comparer deux propositions ni reprendre plus tard.
- **Le lien avec les transactions sans catégorie n'est pas dit.** Le bandeau « N sans
  catégorie » et le bouton « Suggérer » sont deux blocs voisins sans rapport apparent,
  alors que l'un est la cause de l'autre.

### Contraintes dures (ne pas les contourner)

- Une analyse coûte un appel LLM d'environ **une minute** : ce n'est pas gratuit et ça ne
  peut pas être instantané ni déclenché à chaque frappe.
- La **re-catégorisation** qui suit une modification de l'arbre est, elle aussi, une
  opération longue.
- La **palette de 13 teintes** est fermée (voir plus haut).
- Mes **corrections manuelles** ne doivent jamais être perdues, quoi qu'il arrive.
- Le résultat final reste une arborescence à **2 niveaux** (parente → sous-catégories),
  pas davantage.

### Ce que je te demande

Propose **2 ou 3 directions distinctes** pour ce mécanisme — pas trois variantes de la même
mise en page. Tu es libre de remettre en cause le découpage : le moment où l'analyse se
déclenche, la granularité de ce que j'accepte, la façon dont la proposition est confrontée
à l'existant, le fait même qu'il y ait deux modes, l'endroit où tout ça vit (cet écran,
un autre, une file à traiter au fil de l'eau…).

Tu peux supposer que le serveur peut renvoyer autre chose que ce qu'il renvoie
aujourd'hui — dis-le explicitement quand c'est le cas, en une phrase, pour que je sache ce
que ta direction coûte à implémenter.

Pour chaque direction, je veux : les écrans dans les deux thèmes avec les vraies données,
une phrase sur le parti pris, et **ce qu'elle sacrifie**. Et dans tous les cas, ces trois
moments doivent être dessinés, quelle que soit la forme que tu leur donnes :

- l'**attente longue** de l'analyse (~1 min), traitée comme un état conçu et non comme un
  spinner posé au milieu ;
- le moment où je **comprends l'impact** avant de valider (ce qui est créé, réutilisé,
  déplacé, supprimé) — aujourd'hui c'est un pavé de prose dans une modale, du genre :
  > 14 catégorie(s) parente(s) et 52 sous-catégorie(s) seront créées ou réutilisées. Les
  > transactions catégorisées automatiquement seront reclassées dans cette nouvelle
  > arborescence. 3 catégorie(s) existante(s) seront supprimées : Maison, Services,
  > Périscolaire. 2 catégorie(s) seront conservées malgré tout car elles contiennent des
  > corrections manuelles : Impôts, Autres.
- l'**après** : la re-catégorisation qui tourne, son résultat, et son échec éventuel.

Un avertissement à placer quelque part, aussi : une proposition peut avoir vieilli
(« 12 nouvelle(s) transaction(s) arrivée(s) depuis cette analyse »).

---

## Données (pas de lorem ipsum)

**L'arborescence est mouvante** : c'est l'objet même de cette page, et elle est en partie
regénérée par l'IA. Le nombre de catégories parentes n'est pas fixe — de 1 à N. Ne
dessine pas pour un arbre en particulier ; dessine pour un arbre dont la taille varie.
Les cas à tenir :

- **une poignée de parentes** (le tout début, ou après un remplacement agressif) : la page
  ne doit pas avoir l'air vide ni exiger un repli inutile ;
- **une quinzaine**, le régime courant ;
- **davantage que la palette ne compte de teintes** (13) : collisions inévitables, cf.
  ci-dessus ;
- une parente **sans aucune sous-catégorie**, et une parente **jusqu'à 8**.

Même variabilité sur les compteurs : de 1 à ~50 transactions par sous-catégorie
aujourd'hui, sans borne haute. Les petites branches doivent rester atteignables, et le
compteur d'une parente est celui de ses transactions **directes** (celles qui ne sont dans
aucune sous-catégorie), pas le total de sa branche — plusieurs parentes sont donc à 0 avec
des enfants bien remplis.

Un extrait de mon arbre actuel, pour la texture des noms — pas comme un gabarit :

| Parente (direct) | Sous-catégories (nb de transactions) |
|---|---|
| **Alimentaire** (0) | Supermarché 53 · Fromage laiterie 18 · Fruits légumes 17 · Boulangerie 15 · Épicerie fine 14 · Bio épicerie 10 · Livraison courses 7 · Surgelés 4 |
| **Restauration** (0) | Restaurant 46 · Café boulangerie 13 · Glaces 5 · Snack fast food 4 · Pizzeria 2 |
| **Revenus** (6) | Apport Alex 30 · Remboursements 23 · Apport Camille 9 · Salaire 4 |
| **Loisirs** (3) | Sports activités 14 · Parc attractions 11 · Jeux loisirs 6 · Cinéma spectacles 5 · Adhésions clubs 4 |
| **Services** (0) | Abonnements streaming 15 · Services divers 13 · Jeux vidéo 8 · Garde enfants 2 · Musique apprentissage 1 |
| **Transport** (0) | Parking 3 · Péage autoroute 3 · Train bus 1 |
| **Périscolaire** (3) | Cantine périscolaire 3 |

Au total, quelques centaines de transactions par mois et un arbre qui dépasse facilement
les 60 lignes : c'est long, à toi de décider ce qui se replie et à partir de quand.

Lignes de transaction pour les aperçus (libellés bancaires bruts, en majuscules, parfois
tronqués — le design doit rester lisible avec ça, pas seulement avec des noms de marque
propres) :

| Date | Libellé | Banque | Catégorie | Montant |
|---|---|---|---|---|
| 26 juil. 2026 | Rcs Loisirs | Revolut (Commun) | Parc attractions | −52,50 € |
| 26 juil. 2026 | Votre Marche | Revolut (Commun) | Supermarché | −3,78 € |
| 25 juil. 2026 | La Langoust In | Revolut (Commun) | Restaurant | −111,00 € |
| 17 juil. 2026 | VIR SEPA ALEX MARTIN | Caisse d'Épargne (perso) | Apport Alex | −500,00 € |
| 10 juil. 2026 | Remboursement periscolaire | Revolut (Commun) | Remboursements | −280,00 € |

## Contraintes non négociables

- **Français** partout. Montants au format fr-FR : `15 591,62 €` (espace insécable,
  virgule décimale). Dates courtes du type `26 juil. 2026`.
- **Thème clair et thème sombre**, tous les deux conçus avec les tokens ci-dessus, pas une
  inversion automatique.
- **Desktop d'abord** (usage sur grand écran), mais jamais de défilement horizontal de la
  page.
- Les actions **destructives** (Remplacer, Supprimer une catégorie) doivent être distinctes
  des actions ordinaires, et le rester dans les deux thèmes.
- Aucun composant de graphique ici : cette page est du texte dense, des listes et des
  états. C'est la densité et la hiérarchie qui font le travail.

## Ce que je veux en retour

La page complète, **dans les deux thèmes**, avec les vraies données, et **chaque état
listé ci-dessus** rendu (pas seulement décrit) — plus, pour le mécanisme de suggestions IA
seul, **2 ou 3 directions distinctes** avec leur parti pris et ce qu'elles sacrifient. Les
décisions que j'attends de toi :

- la version amputée de l'en-tête et ce qui signale « page de réglages » ;
- la refonte du mécanisme de suggestions : quand l'analyse se déclenche, à quelle
  granularité je l'accepte, comment la proposition se confronte à l'arbre existant, et
  comment le coût réel de l'application devient visible avant de cliquer ;
- le sélecteur de couleur sur la palette fermée de 13 teintes, et la manière de rendre
  visibles les couleurs prises et les collisions ;
- le **système d'icônes** qui prend le relais quand la couleur ne suffit plus : le
  sélecteur (jeu restreint thématique + recherche en français sur une bibliothèque aux
  noms anglais), le rendu de l'icône dans les deux thèmes, et la répartition des rôles
  entre couleur et icône selon les endroits de l'app ;
- le traitement d'un arbre long et de taille variable, éditable en place (densité,
  indentation, ce qui se replie, où vivent les actions de ligne sans transformer chaque
  ligne en barre d'outils) ;
- le traitement des bandeaux d'avertissement et des confirmations à texte long.
