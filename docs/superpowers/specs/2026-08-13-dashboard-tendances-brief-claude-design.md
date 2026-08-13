# Brief Claude Design — écran « Tendances » (l'évolution, par-dessus la revue)

Prompt à passer tel quel à Claude Design (projet `fc13100e-7ea1-4dac-8d2f-6614e40a7209`,
celui qui porte « Revue du mois », « Transactions », « Catégories », « Banques »,
« Budgets » et « Espaces »).

Écrit le 2026-08-13. Tous les écrans actuels répondent à **un mois** : la revue
montre la répartition du mois affiché, la table liste ses transactions, les
budgets posent des montants mensuels. Rien ne répond à « est-ce que ça va dans
le bon sens ». C'est ce trou que cette maquette doit combler — un **écran
nouveau**, pas une modification des existants.

Le brief liste volontairement ce qui n'existe pas en base : c'est la leçon des
portages précédents (bloc « Synchronisé à 07:12 » de Banques, pastille « N à
confirmer » de Catégories, score de confiance de la file « À revoir »), tous
abandonnés faute de source. Le tenir à jour si le modèle bouge.

---

## Contexte

Application web de finances personnelles, en français, usage familial (pas un
produit SaaS). Elle synchronise des comptes bancaires réels via PSD2, catégorise
les transactions et affiche une revue mensuelle.

Le produit est un **tableau de bord de comptes** : densité élevée, chiffres au
premier plan, aucune gamification, aucun ton d'encouragement. Cet écran-ci ne
fait pas exception — il n'a pas à féliciter ni à alarmer.

Reprends le langage visuel des écrans existants du projet : mêmes jetons, même
densité, même en-tête applicatif.

## Les écrans tels qu'ils sont aujourd'hui

Deux écrans partagent une coque commune (« la revue ») : l'en-tête applicatif,
puis un **bandeau de tête**, puis le contenu de l'écran courant avec, à sa
droite, une **colonne des postes**.

- L'**en-tête** porte la marque (qui ramène à la revue), le sélecteur de
  **période**, le sélecteur de **comptes**, et un menu d'engrenage vers les
  quatre écrans de réglages. **Il n'y a plus de rangée de navigation** : `/` et
  `/transactions` se lient l'un à l'autre par une pilule contextuelle posée dans
  le contenu. Retiens-le, c'est la question 6.
- Le **bandeau** (`KpiBand`) : le solde du mois en gros à gauche, entrées et
  sorties à droite sur deux barres proportionnelles, chacun avec son écart à une
  moyenne de référence en pastille. Depuis le 2026-08-06 il porte aussi une
  rangée « Budget » avec sa jauge.
- La **colonne des postes** : une ligne par catégorie de dépense, du plus gros
  au plus faible — icône, intitulé, montant, et sous eux une jauge de 7 px avec
  repère de budget. 254 px de large.
- `/` affiche un **anneau** (un arc par catégorie, cliquer descend dans les
  sous-catégories), `/transactions` la **table** des transactions.

**Ce nouvel écran ne reprend ni le bandeau ni la colonne des postes** : les deux
décrivent un mois unique et contrediraient un écran multi-mois. Il reprend
l'en-tête, les jetons, la densité, et le vocabulaire visuel des jauges et des
pastilles d'écart s'il en a l'usage.

## Ce qu'est cet écran

Trois questions, dans cet ordre. Une métrique qui ne sert aucune des trois n'a
rien à faire là.

1. **Est-ce que je vis en dessous de mes moyens ?**
2. **Qu'est-ce qui a changé ?**
3. **Sur quoi puis-je agir ?**

Nom de travail : « Tendances ». Si un autre intitulé sert mieux les trois
questions, propose-le.

## Ce qu'il faut couvrir

1. **L'évolution des flux mois par mois** : entrées, sorties, solde. C'est le
   socle de la page.
2. **La trajectoire cumulée** : le solde cumulé sur la fenêtre, qui dit « je
   décroche » ou « je remonte » là où le solde d'un mois isolé est bruité.
3. **Ce qui a bougé, par catégorie** : les postes en hausse et en baisse par
   rapport à leur propre moyenne, en euros et en pourcentage. C'est le contenu
   le plus actionnable de la page ; traite-le comme tel.
4. **Charges fixes contre dépenses variables**, et ce qui reste des revenus une
   fois les fixes payées.
5. **Le mois en cours**, qui est partiel et ne se compare pas aux autres.
6. **La tenue des budgets dans le temps** : un budget mensuel s'applique à tous
   les mois, ce qui permet de dire « tenu 2 mois sur 3 ».
7. **La couverture de la catégorisation** : la part de la dépense réellement
   classée, par mois. C'est le signal qui dit quand aller relancer l'analyse de
   suggestions.

## La contrainte de volume — à lire avant de dessiner un graphe

**La base contient aujourd'hui 591 transactions, du 19 avril au 10 août 2026.**
Soit **trois mois complets** (mai, juin, juillet), plus août en cours. Avril
compte 18 lignes : c'est le mois d'amorçage de la synchronisation, déjà écarté
des moyennes par le code comme mois partiel.

Ce n'est pas un jeu de test réduit, c'est la donnée réelle. Elle grandira d'un
mois par mois, sans rattrapage possible — les banques ne rendent pas
d'historique au-delà de ce qui a été récupéré au premier import.

**Donc : conçois pour 3 points, et vérifie que la forme tient encore à 24.**
Une courbe lissée sur trois points affirme une tendance qui n'existe pas. Un
graphe dimensionné pour douze mois affichera neuf douzièmes de vide. C'est la
question 2.

## Les données réellement disponibles

N'affiche que ça — tout le reste devrait être inventé.

**Par mois** (le regroupement se fait sur des mois calendaires) :

- total encaissé, total dépensé, solde ;
- le même triplet **par catégorie parente**, plus une ligne « sans catégorie » ;
- le nombre de transactions.

**Par catégorie** (parente ou sous-catégorie) : nom, couleur, icône (parentes
seulement), montant budgété mensuel (ou aucun), drapeau « détaillée », dépense
mensuelle moyenne sur les 6 derniers mois complets arrondie à 5 €, drapeau
« irrégulière » (vue moins de 4 mois sur 6).

**Globalement** : total budgété par mois, et le compte « N postes budgétés
sur M ».

**Dates** : la période affichée, la date du jour, et la date de la première
transaction en base sont connues. Une courbe cumulée jour par jour à l'intérieur
d'un mois est donc possible.

**Volumétrie réelle, pour dimensionner** : 28 catégories parentes,
111 sous-catégories, et **2 postes budgétés sur 28**. Une liste qui affiche
toutes les catégories est illisible et vide.

## Ce qui n'existe pas — ne le dessine pas

C'est la règle la plus importante de ce projet : un écran ne promet que ce que
la base sait.

- **Aucun solde de compte, donc aucun patrimoine.** La base ne stocke que des
  mouvements, jamais le solde d'un compte. Ce que la page appelle « solde » est
  la différence entrées − sorties sur une période, et le « cumul » est la somme
  de ces différences depuis le premier import — **pas l'argent réellement
  présent sur les comptes**. Aucune courbe de patrimoine, aucun « total de vos
  avoirs », aucune répartition par compte en valeur. C'est structurel.
- **Aucun taux d'épargne.** Un virement vers un livret non connecté est un débit
  ordinaire : tout ratio « épargné / gagné » **baisse quand l'utilisateur
  épargne plus**. Si tu affiches ce ratio, nomme-le pour ce qu'il mesure (« non
  dépensé », « reste à la fin du mois »), jamais « épargne ».
- **Aucun historique de budget.** Un budget posé aujourd'hui vaut pour tous les
  mois, y compris passés. Donc pas de « budget de mars », pas d'évolution du
  budget dans le temps — seulement la ligne horizontale d'un même montant
  comparée à des dépenses qui varient.
- **Aucune prévision, aucune projection de fin de mois, aucun objectif.** Rien
  n'est persisté qui puisse porter une cible autre que le budget.
- **Aucune comparaison à l'an dernier, aucune saisonnalité.** Quatre mois de
  données.
- **Aucune alerte, notification, seuil ni rappel.** Un dépassement est un état
  affiché, pas un événement.
- **Aucun commerçant fiable.** La contrepartie n'est renseignée que sur **43 %**
  des lignes, et cette part varie de 25 % à 72 % selon le mois. Un classement
  « vos plus gros commerçants » ou un total « vos abonnements » serait faux de
  moitié. Si tu veux du niveau commerçant, présente-le comme un échantillon
  détecté (« quelques prélèvements récurrents identifiés »), jamais comme un
  total.
- **Aucun auteur sur une transaction** : pas de découpage par membre du foyer.
- **Aucun score de confiance** sur la catégorisation : on sait si une catégorie
  a été posée à la main, par le LLM ou par règle, pas à quel point elle est sûre.

Si un de ces éléments te paraît indispensable à l'écran, signale-le comme une
demande explicite plutôt que de l'intégrer discrètement.

## Comment les filtres globaux s'appliquent ici

L'en-tête porte la **période** et les **comptes**, partagés avec la revue.

- **La période désigne le dernier point de la série, pas ce qui est affiché.**
  L'écran remonte les mois précédant la période choisie. C'est déjà le
  comportement de l'agrégat d'historique existant.
- **Le filtre de comptes s'applique à tous les flux.** Deux conséquences : les
  virements entre deux comptes suivis ne s'annulent que si les deux comptes sont
  cochés (sinon un vrai débit apparaît d'un côté), et **toute comparaison à un
  budget devient invalide** — un budget porte sur tous les comptes de l'espace.
  La revue traite déjà ce cas en remplaçant la rangée « Budget » par une phrase.
- **Un budget mensuel ne se compare qu'à des mois calendaires pleins.** Sur une
  période « 30 derniers jours », la comparaison au budget est coupée, comme sur
  la revue.
- **Les autres filtres ne suivent pas.** L'écran des transactions porte aussi un
  filtre de catégorie, un filtre de sens, un « à classer » et une recherche
  textuelle, et ils restent posés quand on change d'écran. **Cette page les
  ignore volontairement** : elle décrit un périmètre (une période, des comptes),
  jamais une sélection. Sans cette règle, quelqu'un qui a filtré
  « Alimentation » sur la table verrait ici toutes ses courbes réduites à une
  seule catégorie sans que rien ne le dise. La revue applique déjà exactement ce
  principe à son bandeau. Si tu penses qu'il faut malgré tout **signaler** à
  l'écran que des filtres sont actifs ailleurs, propose-le — mais ils ne doivent
  rien changer aux chiffres.

## Six questions que le design doit trancher

1. **La plus structurante — quelle fenêtre l'écran montre-t-il, et qui la
   choisit ?** Le sélecteur de l'en-tête désigne un point d'ancrage, pas une
   fenêtre. L'écran a-t-il son propre contrôle de profondeur (3 / 6 / 12 mois),
   au risque d'un second sélecteur de temps à deux mètres du premier ? Ou la
   fenêtre est-elle fixe et implicite ? Ta réponse commande la lecture de toute
   la page — et il faut qu'elle reste vraie quand quelqu'un arrive ici depuis la
   revue avec « Ce trimestre » sélectionné.
2. **Trois points aujourd'hui, vingt-quatre dans deux ans.** Quelle forme ne
   ment pas à trois points et ne se vide pas à douze ? Et que montre l'écran
   quand il n'y a **qu'un seul** mois complet — cas d'un nouvel utilisateur qui
   vient de connecter ses banques ? Cet état-là est le premier que verra
   quelqu'un qui installe l'app ; il ne peut pas être un graphe cassé.
3. **Les deux bouts de la série sont des mois partiels**, et pour deux raisons
   différentes. À droite, le mois en cours : août au 13 du mois pèse la moitié
   d'un mois normal et dessine une chute qui n'existe pas. À gauche, le **mois
   d'amorçage** : la première synchronisation n'a ramené que la fin d'avril
   (18 lignes contre 130 à 213 pour un mois plein), et ce creux-là ne se
   comblera jamais — il est aussi le premier pas de la trajectoire cumulée,
   qu'il décale sur toute sa longueur. Les deux se distinguent visuellement
   (creux, hachures, trait interrompu) ? S'excluent de la série ? Le point de
   gauche mérite peut-être un autre traitement que celui de droite : l'un est
   incomplet pour toujours, l'autre le sera encore trois semaines. Une **courbe
   cumulée jour par jour** du mois en cours, superposée aux mois précédents, est
   une réponse
   possible et elle survit sur un mois révolu — où elle est simplement la forme
   de ce mois-là. À noter : un repère d'« allure » (prorata temporel) a été
   écarté ailleurs dans l'app faute de savoir ce qu'il veut dire sur un mois
   passé ; la courbe cumulée n'a pas ce problème, mais un repère d'allure sur
   cet écran le rouvrirait.
4. **Trois moyennes de référence cohabitent déjà dans l'app.** La revue affiche
   « vs moy. 3 mois ». L'écran des budgets propose des montants sur 6 mois. Si
   cet écran-ci en introduit une troisième, l'utilisateur lira deux écarts
   différents pour le même mois d'août, sans moyen de les réconcilier. **La
   recommandation est de reprendre la fenêtre 3 mois de la revue** — dis
   comment l'écran étiquette sa référence pour que le rapprochement soit
   évident.
5. **28 parentes et 111 sous-catégories : que montre-t-on, et jusqu'où ?** Une
   série par catégorie est illisible. Un top N — mais lequel, et classé par
   quoi : le montant, ou l'ampleur du changement ? Et peut-on descendre dans une
   parente pour voir ses sous-catégories, comme l'anneau le permet, ou l'écran
   reste-t-il au niveau des parentes ?
6. **L'écran n'a aucune porte d'entrée.** La barre applicative n'a plus de
   rangée de navigation : la marque ramène à la revue, une pilule contextuelle
   mène à la table, l'engrenage aux réglages. Un troisième écran de premier plan
   n'entre dans aucune de ces trois catégories. Tu rétablis une rangée de
   navigation — et il faut alors la dessiner pour les trois écrans, ce qui
   change l'en-tête partout ? Une pilule de plus dans le contenu de la revue ?
   Tranche explicitement, c'est un changement qui déborde de cette maquette.

## Les états à prévoir

Ce ne sont pas des cas limites, ce sont les états actuels de l'application.

- **Un seul mois complet en base** (nouvel utilisateur).
- **Trois mois complets + un mois en cours** (état réel aujourd'hui).
- **Deux postes budgétés sur 28** : tout ce qui compare au budget est quasi
  vide. Une tuile vide qui explique et renvoie vers `/budgets` est une réponse
  acceptable ; une tuile qui affiche « 0 % » ne l'est pas.
- **Filtre de comptes actif** : les comparaisons au budget sont coupées.
- **Période non calendaire** (« 30 derniers jours ») : idem.
- Un mois où le solde est **négatif**, et une série où il l'est sur tous les
  mois — l'app ne doit pas y prendre un ton d'alarme.

## Contraintes

- Tout en français.
- Thèmes clair et sombre, comme les autres écrans.
- **Jetons du design system existant, sans exception.** L'unité est 4 px : toute
  mesure qui occupe de la place est un multiple de 4 (seules exceptions, les
  traits de 1 et 1,5 px). L'échelle typographique est fermée à neuf crans
  nommés ; les rayons à quatre formes. Aucune valeur inventée.
- Densité identique à l'existant : corps de texte 13 px, contrôles de 32 px de
  haut.
- L'écran occupe **toute la hauteur du viewport, en pleine largeur** — c'est le
  gabarit de la revue, pas le gabarit centré à 1000 px des écrans de réglages.
- Écran de bureau en priorité ; il doit rester lisible en fenêtre étroite sans
  être conçu pour le mobile.
- Si une visualisation demande une bibliothèque de graphes, dis-le : le projet
  n'en a aucune aujourd'hui, tout est dessiné en SVG à la main (l'anneau, les
  jauges, les barres du bandeau). Ce n'est pas rédhibitoire, c'est une décision
  à prendre sciemment.

---

## Notes hors brief (ne pas envoyer à Claude Design)

- **Zéro nouvelle requête serveur pour les points 1, 2, 3, 6 et 7.**
  `monthlyHistory` (`packages/api/src/transactions/queries.ts`) rend déjà
  mois × catégorie parente × {débit, crédit, count} sur 12 mois, filtre de
  comptes appliqué et sens neutralisé, avec la parente `null` pour les non
  classées. `budgetPlan` fournit le reste. Le point 4 (fixe/variable) se dérive
  de la variance de `monthlyHistory` d'un mois à l'autre — **préférer ça au
  regroupement par contrepartie**, qui demanderait une requête neuve pour un
  résultat à 43 % de couverture.
- **Le loader devra passer `wholePeriod(search)`**, comme celui de `_revue` le
  fait pour le bandeau : `monthlyHistory` ne neutralise que `direction`,
  `category` / `aClasser` / `q` traversent `transactionsFilterQuery` sans
  encombre. C'est la règle « les autres filtres ne suivent pas » du brief, et
  elle ne tient que par cet appel.
- **`monthlyHistory` groupe sur `to_char(booking_date, 'YYYY-MM')` : un mois
  sans transaction ne rend aucune ligne**, il est absent et non à zéro. Que le
  graphe comble les trous ou non est une décision du portage, et c'est la
  différence entre « 5 points » et « 12 emplacements dont 7 vides » — donc
  entre deux réponses à la question 2.
- **Trois constantes de fenêtre à ne pas confondre** : `AVERAGE_MONTHS = 3`
  (`apps/tanstack-start/src/lib/history.ts`, la référence de la revue),
  `HISTORY_MONTHS = 6` (`packages/api/src/categories/budgets.ts`, la proposition
  de budget), `HISTORY_MONTHS = 12` (`queries.ts`, la profondeur de l'agrégat).
  La question 4 du brief porte sur la première.
- **Route sœur, pas sous `_revue`.** Sa search collerait à
  `transactionsSearchSchema` et elle pourrait techniquement s'y monter, mais le
  layout monte `KpiBand` et la colonne des postes, tous deux mono-mois. Même
  `AppHeader` en revanche : `SETTINGS_TITLES` n'a pas à l'accueillir, ce n'est
  pas un écran de réglages, mais `isSettings` devra distinguer trois cas au lieu
  de deux.
- **La réponse à la question 6 touche `AppHeader`**, donc les six écrans. Si le
  design rétablit une rangée de navigation, c'est un chantier à part de ce
  portage — l'estimer comme tel.
- `transactions.totals` n'a plus d'appelant depuis le 2026-08-04 : si le design
  redemande des totaux de période, la procédure existe déjà et est testée.
- **Si la réponse à la question 1 exige une fenêtre paramétrable**, `monthlyHistory`
  a sa profondeur en dur (`HISTORY_MONTHS = 12`) : la rendre variable est un
  changement de signature, pas un réglage gratuit.
- Chiffres du 2026-08-13 à re-vérifier avant tout nouveau brief : 591
  transactions, 2026-04-19 → 2026-08-10, 43 % de contrepartie, 0,7 % sans
  catégorie, 28 parentes / 111 sous-catégories, 2 postes budgétés sur 28
  (5 lignes dans `category_budgets`, dont 3 sans montant ; aucune parente
  détaillée — d'où « sur 28 » et non « sur 139 », le dénominateur étant
  `budgetSlots` et pas la table `categories`).
