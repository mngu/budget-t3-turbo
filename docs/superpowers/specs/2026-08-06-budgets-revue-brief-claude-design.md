# Brief Claude Design — les budgets dans la « Revue du mois »

Prompt à passer tel quel à Claude Design (projet `fc13100e-7ea1-4dac-8d2f-6614e40a7209`,
celui qui porte « Revue du mois », « Transactions », « Catégories », « Banques »
et « Espaces »).

Écrit le 2026-08-06. Les budgets existent depuis le 2026-08-05 : on peut poser
un montant mensuel par catégorie sur l'écran `/budgets`, mais **rien ne les
consomme** — aucun écran ne compare la dépense au budget. C'est ce trou que
cette maquette doit combler.

Le brief liste volontairement ce qui n'existe pas en base : c'est la leçon des
portages précédents (bloc « Synchronisé à 07:12 » de Banques, pastille « N à
confirmer » de Catégories, score de confiance de la file « À revoir »), tous
abandonnés faute de source. Le tenir à jour si le modèle bouge.

---

## Contexte

Application web de finances personnelles, en français, usage familial (pas un
produit SaaS). Elle synchronise des comptes bancaires réels via PSD2, catégorise
les transactions et affiche une revue mensuelle.

Cette maquette **modifie des écrans existants du même projet**, elle n'en ajoute
pas un nouveau. Reprends leur langage visuel : mêmes tokens, même densité, même
en-tête applicatif.

## L'écran tel qu'il est aujourd'hui

Deux écrans partagent une coque commune (« la revue ») : l'en-tête, puis un
**bandeau de tête**, puis le contenu de l'écran courant avec, à sa droite, une
**colonne des postes**.

- L'en-tête porte le sélecteur de **période** et le sélecteur de **comptes**.
- Le **bandeau** (`KpiBand`) : le solde du mois en gros à gauche, les entrées et
  les sorties à droite sur deux barres proportionnelles. Chacun des trois
  chiffres porte son écart à une **moyenne de référence** (les mois précédents),
  en pastille de pourcentage et en euros. Quand on ouvre un poste, une colonne
  de droite s'ajoute au bandeau : le poste ouvert, son montant, son écart.
- La **colonne des postes** : une ligne par catégorie de dépense, du plus gros
  au plus faible — icône, intitulé, montant, et sous eux une barre
  proportionnelle au plus gros poste.
- L'écran `/` affiche un **anneau** : un arc par catégorie de dépense,
  proportionnel au montant, avec le nom sur l'arc et une carte de verre au
  centre. Cliquer un arc ou une ligne de la colonne **descend** dans le poste :
  l'anneau se replie, puis se déplie sur les sous-catégories. Un fil d'ariane
  au-dessus de l'anneau nomme le niveau affiché.
- L'écran `/transactions` affiche la table des transactions à la place de
  l'anneau. Il a en plus une barre de filtres (sens, catégorie, « à classer »).

**Le bandeau et la colonne des postes sont partagés par les deux écrans** — ce
qu'on y ajoute apparaît aussi au-dessus de la table des transactions. Seuls
l'anneau, le fil d'ariane et le geste attaché aux lignes appartiennent à `/`.
Dis clairement, pour chaque élément que tu ajoutes, s'il vit dans la partie
partagée ou dans l'anneau.

## Ce qu'est un budget ici

Un **montant mensuel posé sur une catégorie**, sans dimension de mois : une
ligne par catégorie, pas de versionnage, pas de report du non consommé.

- Une catégorie parente peut être **détaillée** : ce sont alors ses
  sous-catégories qui portent chacune un montant, et la parente n'affiche que
  leur somme. Sinon elle porte un montant **global**, qui couvre aussi la
  dépense de ses sous-catégories.
- Un « poste de budget » est donc soit une parente globale, soit une
  sous-catégorie d'une parente détaillée. Jamais les deux.
- **Toutes les catégories ne sont pas budgétées**, et c'est l'état normal :
  l'écran `/budgets` affiche « N postes budgétés sur M ». La revue doit rester
  lisible quand aucun budget n'est posé, quand quelques-uns le sont, et quand
  tous le sont.
- Les budgets sont **posés et modifiés sur `/budgets` uniquement**. La revue les
  lit. Si tu veux y rendre un montant modifiable, signale-le comme une décision
  plutôt que de l'intégrer discrètement.

## Ce qu'il faut couvrir

1. **Le mois entier face à son budget** : où le total budgété apparaît par
   rapport au solde et aux deux flux du bandeau, et ce qu'on lit d'un coup d'œil
   (reste à dépenser ? dépassement ?).
2. **Un poste face à son budget**, dans la colonne des postes — c'est le cœur
   de la demande.
3. **Le poste ouvert** face à son budget, dans la colonne de droite du bandeau.
4. **Les sous-catégories** d'une parente détaillée, qui ont chacune leur budget,
   face à une parente globale dont les sous-catégories n'en ont aucun.
5. **Le dépassement** : c'est le seul état qui doit se voir sans être cherché.
6. **Les postes sans budget** : ils restent affichés et ne doivent pas se lire
   comme un budget à zéro consommé.

## Les données réellement disponibles

N'affiche que ça — tout le reste devrait être inventé.

Par catégorie (parente ou sous-catégorie) : nom, couleur, icône (parentes
seulement), **montant dépensé sur la période affichée**, **montant budgété**
(ou aucun), et un drapeau **« détaillée »** sur les parentes.

Par catégorie encore : sa **dépense mensuelle moyenne sur les 6 derniers mois
complets**, arrondie à 5 €, et un drapeau **« irrégulière »** (vue moins de 4
mois sur 6). C'est ce qui sert de proposition de montant sur `/budgets`.

Globalement : total dépensé, total encaissé, solde, **total budgété par mois**,
et le compte « N postes budgétés sur M ».

La période affichée et la date du jour sont connues : un calcul d'allure
(prorata temporel du mois en cours) est disponible si tu le juges utile — c'est
un choix de design, pas une invention.

## Ce qui n'existe pas — ne le dessine pas

C'est la règle la plus importante de ce projet : un écran ne promet que ce que
la base sait.

- **Pas d'historique de budget.** Un budget posé aujourd'hui vaut pour tous les
  mois, y compris passés. Donc **aucune courbe « budget vs réel » sur plusieurs
  mois**, aucun « budget de mars », aucune évolution du budget dans le temps.
- **Pas de report** du non consommé d'un mois sur l'autre, ni de cumul annuel.
- **Pas de seuil, d'alerte, de notification ni de rappel** : rien n'est
  persisté, rien ne se déclenche. Un dépassement est un état affiché, pas un
  événement.
- **Le budget ignore le filtre de comptes.** Un budget porte sur tous les
  comptes de l'espace ; la revue, elle, peut n'en afficher qu'une partie. Le
  cas est réel et il n'a pas de solution côté données : dire ce que l'écran
  affiche alors (masquer la comparaison ? l'avertir ?) fait partie de la
  question 2 ci-dessous.
- **« Sans catégorie » ne peut pas avoir de budget** : ce n'est pas une
  catégorie, c'est le reliquat des transactions non classées. Il apparaît
  pourtant dans l'anneau et dans la colonne, en dernier.
- **Le segment « À classer » non plus.** Sur une parente détaillée, il
  représente ce que la parente porte encore en propre, sans sous-catégorie :
  une dépense bien réelle mais qu'aucun budget ne couvre. Il se dessine
  aujourd'hui en barre hachurée avec un triangle d'alerte.
- **Pas de budget de revenus.** Les moyennes et les propositions ne portent que
  sur les dépenses.
- **Pas de budget par compte, par membre, ni par personne** : les transactions
  d'un espace partagé n'ont pas d'auteur.

Si un de ces éléments te paraît indispensable à l'écran, signale-le comme une
demande explicite plutôt que de l'intégrer discrètement.

## Cinq questions que le design doit trancher

1. **La plus structurante — budget contre moyenne.** Chaque chiffre du bandeau
   et chaque poste ouvert porte déjà son **écart à une moyenne de référence**,
   en pastille colorée. Le budget est une seconde référence, de même nature
   visuelle et concurrente au même endroit. Il la **remplace** ? Il s'installe
   **à côté** ? C'est une **bascule** (moyenne / budget) ? Attention : le budget
   ne couvre qu'une partie des postes — « remplacer » laisse les autres sans
   aucune comparaison. Ta réponse commande tout le reste du brief.
2. **Les périodes qui ne sont pas un mois.** Le sélecteur propose « Ce mois »,
   « Mois dernier », « 30 derniers jours », « Ce trimestre », « Cette année », et
   le calendrier permet une plage quelconque. Un budget mensuel ne s'y compare
   plus directement. Tu masques la comparaison hors mois calendaire plein ? Tu
   multiplies le budget par le nombre de mois couverts ? Tu proratises ? Le
   même choix vaut pour le filtre de comptes ci-dessus.
3. **L'anneau encode-t-il le budget ?** La longueur d'un arc est une part du
   total dépensé : un dépassement ne peut pas l'allonger, et un poste sous
   budget n'a pas d'arc plus court pour autant. Repère de cible sur l'arc ?
   Seconde piste concentrique ? Rien du tout, et le budget ne vit que dans la
   colonne et le bandeau ? Une réponse « rien dans l'anneau » est parfaitement
   acceptable si elle est argumentée.
4. **Le mois en cours est partiel.** Le 6 du mois, avoir consommé 20 % d'un
   budget n'est pas la même nouvelle que le 28. Tu montres une **allure**
   (attendu à cette date) ou seulement le consommé brut ? Si allure, dis
   comment elle se distingue visuellement du budget lui-même, et ce qu'elle
   devient sur un mois passé, où elle n'a plus de sens.
5. **« Pas de budget » et « budget à 0 » sont deux états distincts** et tous
   deux réels. Comment les distingue-t-on ? Et un poste sans budget doit-il
   proposer d'en poser un depuis la revue, ou renvoyer vers `/budgets` ?

## Contraintes

- Tout en français.
- Thèmes clair et sombre, comme les autres écrans.
- Densité identique à l'existant : corps de texte ~12,5–13 px, contrôles ~31–34 px
  de haut, coins arrondis 7–14 px.
- L'écran de la revue occupe **toute la hauteur du viewport**, en pleine
  largeur — ce n'est pas le gabarit centré des écrans de réglages.
- La colonne des postes fait **254 px**, et cette largeur est **la même** que
  celle de la colonne du poste ouvert dans le bandeau : les deux sont alignées.
  Si tu l'élargis, les deux bougent ensemble.
- La ligne d'un poste fait 37 px de haut et contient déjà icône + intitulé +
  montant sur une rangée, et une barre de 3 px sous eux. Y ajouter le budget
  demande soit de la densifier, soit de l'agrandir : tranche explicitement.
- Écran de bureau en priorité ; il n'a pas besoin d'être responsive au-delà de
  rester lisible en fenêtre étroite. La colonne des postes disparaît déjà
  sous 1024 px.
- Prévois les états : aucun budget posé nulle part, tous les postes budgétés,
  un poste très largement dépassé (200 %+), un poste budgété sans aucune
  dépense sur la période.

---

## Notes hors brief (ne pas envoyer à Claude Design)

- **Deux « moyennes » incompatibles cohabiteront** si le design en affiche une.
  Celle de la revue (`averagesByCategory`, `lib/history.ts`) est ancrée sur la
  **fin de la période affichée**, respecte le filtre de comptes et n'est pas
  arrondie ; celle des budgets (`budgetPlan`, `packages/api/src/categories/budgets.ts`)
  porte sur les 6 mois complets précédant le **mois réel courant**, tous comptes,
  arrondie à 5 €. Sur un mois passé elles donnent deux chiffres différents sous
  le même mot. Choisir laquelle l'écran montre avant de porter la maquette.
- **Le loader de `_revue` devra appeler `categories.budgets.plan`** — une requête
  agrégée de plus, déjà écrite, non scopée par comptes ni par période.
- **Si la réponse aux questions 2 ou 4 exige un budget scopé** par comptes ou
  proratisé côté serveur, c'est un changement de `budgetPlan` : le nommer comme
  tel plutôt que de le supposer gratuit.
- `transactions.totals` n'a plus d'appelant depuis le 2026-08-04 : si le design
  redemande des totaux de sélection, la procédure existe déjà.
