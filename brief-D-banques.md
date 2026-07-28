# Brief D — La page Banques (connexion bancaire)

## Le produit

Outil de finances personnelles, à usage strictement privé (une seule personne, pas de
SaaS, pas d'onboarding à vendre, personne à convaincre). Il synchronise les transactions
de 3 comptes bancaires (Revolut, Caisse d'Épargne, Société Générale), les catégorise
automatiquement par IA, et sert à faire la revue du budget du mois. Toute l'interface est
en **français**.

La connexion aux banques passe par un agrégateur (Enable Banking) et le cadre européen
DSP2 : je ne saisis jamais mes identifiants bancaires dans l'app, je suis redirigé vers ma
banque, j'y valide une authentification forte, et je reviens. Le consentement ainsi donné
a une durée de vie — c'est le fait central de cette page.

## Ce que je te demande

**Le système de design existe déjà.** Les écrans de la revue du mois sont le portage de la
maquette « Revue du mois » (projet `fc13100e-7ea1-4dac-8d2f-6614e40a7209`). Deux écrans
secondaires n'ont jamais été portés et sont restés au look shadcn générique d'avant :
`/categories` et `/banques`. **Ce brief ne traite que `/banques`** — les catégories font
l'objet d'un brief séparé. Dessine-la **dans le langage de cette maquette**, pas dans un
troisième langage.

C'est un écran d'**états**, pas de mise en page : sa difficulté est le nombre de
situations à couvrir (première configuration, aucune banque, consentement qui se dégrade,
attentes longues, erreurs). Je veux chaque état dessiné, pas seulement le cas nominal.

## Le système à respecter (jeu de tokens de la maquette)

Typo : **Geist Variable** pour le texte, **Geist Mono Variable** pour tous les chiffres et
identifiants (IBAN, clés, dates techniques) — chiffres tabulaires. Deux micro-styles
récurrents : un intitulé de section en capitales (`10,5 px`, `tracking .06em`, couleur
`subtle`) et les nombres en mono.

Rayon de base `--radius: 0.625rem`. Rôles ajoutés par la maquette au jeu shadcn :
`sunken` (sous le fond : barres d'outils, rails), `surface-2` (entre le fond et la carte :
en-têtes de groupe, lignes survolées), `subtle` (3ᵉ palier de texte, sous
`muted-foreground`), `border-strong`, `track`, et trois paires sémantiques
`ok` / `warn` / `bad` avec leur variante `-soft` (fond pâle). **Ces trois paires sont
exactement le vocabulaire du badge de consentement** — sers-t'en plutôt que d'inventer des
couleurs de statut.

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

Une nuance à connaître pour les formulaires en thème sombre : la bordure standard y est
très ténue (`oklch(1 0 0 / 7.5%)`), et les champs de saisie utilisent volontairement un
contraste plus fort (`oklch(1 0 0 / 15%)`) — sans quoi un champ n'aurait plus ni bord ni
fond visibles. Cette page est la plus chargée en formulaires de toute l'app : c'est là que
ça se voit.

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

Une question ouverte que je te laisse, propre à cette page : le déclencheur de
synchronisation vit aujourd'hui dans le sélecteur de comptes de la revue, qui ne suit pas
ici. Or c'est la page des banques — lancer une synchronisation ou constater qu'elle a
échoué y a du sens. Dis-moi si tu penses qu'elle doit en porter un, et sous quelle forme.

---

## Le travail à faire sur cet écran

Je n'y vais que rarement, et toujours pour une de ces trois raisons :

1. **« Est-ce que mes banques sont encore connectées ? »** Le consentement DSP2 expire au
   bout de ~180 jours : deux fois par an, la synchronisation casse et il faut
   réautoriser. C'est l'information numéro un de la page, et elle doit être lisible **avant
   l'expiration**, pas après. Une expiration découverte trop tard, c'est un mois de
   transactions manquantes.
2. **Réautoriser ou révoquer** une banque. Réautoriser sort de l'app (redirection pleine
   page vers la banque, authentification forte dans son application mobile, retour
   automatique). Ce n'est pas instantané et ça se passe en partie hors de l'écran.
3. **Connecter une banque de plus** — rare. Et une seule fois dans la vie de
   l'installation : la configuration technique de l'agrégateur.

## Structure actuelle (à repenser, pas à recopier)

**A. Première configuration** (tant que les identifiants Enable Banking ne sont pas
posés) — une carte « Configuration Enable Banking » : 3 étapes numérotées (créer un compte
et une application sur enablebanking.com, déclarer l'URL de redirection — affichée en
`code` avec un bouton copier —, renseigner les identifiants), puis les champs
**Application ID**, **URL de redirection**, **Clé privée** (zone de texte monospace pour
un `.pem`, `-----BEGIN PRIVATE KEY-----`), puis une checklist à 3 points qui passent de
gris (en attente) à vert ou rouge :
« Identifiants renseignés » · « Clé acceptée par l'API Enable Banking » · « URL de
redirection enregistrée dans le Control Panel », un message d'erreur éventuel, et un
bouton « Valider la configuration ».

**B. Liste des connexions** (configuré) — titre « 🏦 Banques », bouton « Ajouter une
banque », puis une carte par banque : logo, nom de l'établissement, **badge de
consentement**, boutons « Renouveler » / « Révoquer », séparateur, puis la liste des
comptes rattachés (nom donné + IBAN, les comptes exclus barrés et marqués « (exclu) »).

**C. Ajout d'une banque**, en deux étapes :
- *Choisissez votre banque* — champ de recherche (« Rechercher une banque (ex : Caisse
  d'Epargne, Revolut…) »), liste de résultats (logo, nom, pays, bouton « Connecter »), et
  la note « Vous serez redirigé vers votre banque pour autoriser l'accès (authentification
  forte), puis ramené ici automatiquement. »
- *Vos comptes* — « Comptes découverts — nommez-les et choisissez lesquels suivre » :
  une case à cocher, un champ de nom, l'IBAN ; puis « Enregistrer et synchroniser », qui
  bascule en « Synchronisation initiale en cours… ».

## Les états à dessiner

- **Badge de consentement, ses quatre niveaux** : normal (« Expire dans 173 j »),
  alerte proche (« Expire dans 12 j »), **expiré** (« Consentement expiré »),
  **révoqué**. Le passage du normal à l'alerte est ce que la page doit rendre évident —
  c'est le cœur du travail sur cet écran. À toi de décider si ça vaut aussi un signal en
  dehors de la carte concernée.
- **Non configuré** (formulaire A) et **configuré mais aucune banque** (« Aucune banque
  connectée pour l'instant — ajoutez-en une pour commencer »).
- **Recherche de banque sans résultat** (« Aucune banque trouvée »).
- **Attentes longues** : « Synchronisation initiale en cours… » après le choix des comptes,
  et le bouton « Connecter » qui part en redirection pleine page — l'utilisateur quitte
  l'app, il faut que ce soit annoncé.
- **Erreur de configuration** sous la checklist (message brut renvoyé par l'API).
- **Compte exclu du suivi** : présent mais barré, dans la liste d'une carte comme dans
  l'étape 2 du wizard.

## Données réelles

Seulement **2 des 3 banques sont connectées** aujourd'hui — la Société Générale ne l'est
pas encore, et deux comptes détectés ne sont rattachés à aucune connexion. La page doit
bien se lire à 2 sur 3, pas seulement pleine.

| Établissement | Pays | Statut | Consentement |
|---|---|---|---|
| Revolut | FR | actif | jusqu'au 17 janv. 2027 → « Expire dans 173 j » |
| Caisse d'Epargne Ile De France | FR | actif | jusqu'au 17 janv. 2027 → « Expire dans 173 j » |

Comptes rattachés (IBAN partiellement masqués ici, l'app les affiche en entier) :

- Revolut → **Revolut (Commun)** · `FR76 2823 •••• 1473`
- Caisse d'Epargne Ile De France → **Caisse d'Épargne (perso)** · `FR76 1751 •••• 3029` ·
  **Caisse d'Épargne (commun)** · `FR76 1751 •••• 4807`

Deux détails de données à ne pas lisser :

- Le nom de l'établissement vient du fournisseur, brut, **sans accents et parfois long**
  (« Caisse d'Epargne Ile De France ») : le design doit tenir avec ça, sans compter sur des
  noms de marque courts et propres.
- Un logo de banque peut manquer : prévoir le cas sans faire un trou dans la carte.
- Une même banque peut porter **plusieurs comptes** (ici la Caisse d'Épargne en a deux, un
  perso et un commun), et l'établissement recherché à l'ajout peut être listé sous un pays
  qui n'est pas le mien — Revolut est licencié en Lituanie, ce qui est normal et ne doit
  pas ressembler à une erreur.

## Contraintes non négociables

- **Français** partout. Dates courtes du type `17 janv. 2027`.
- **Thème clair et thème sombre**, tous les deux conçus avec les tokens ci-dessus, pas une
  inversion automatique.
- **Desktop d'abord** (usage sur grand écran), mais jamais de défilement horizontal de la
  page.
- Les actions **destructives** (Révoquer) doivent être distinctes des actions ordinaires,
  et le rester dans les deux thèmes.
- Rien ici ne doit ressembler à une demande d'identifiants bancaires : l'app n'en reçoit
  jamais. Les seuls secrets saisis sont ceux de mon propre compte agrégateur, à la
  première configuration.
- Aucun composant de graphique : cette page est du texte, des cartes de statut, des
  formulaires et des états.

## Ce que je veux en retour

La page complète, **dans les deux thèmes**, avec les vraies données, et **chaque état
listé ci-dessus** rendu (pas seulement décrit), y compris les deux étapes du wizard
d'ajout et la première configuration. Les décisions que j'attends de toi :

- la version amputée de l'en-tête et ce qui signale « page de réglages » ;
- le traitement du badge de consentement et de sa dégradation dans le temps — le vrai
  sujet de l'écran ;
- l'anatomie d'une carte de banque : où vivent le statut, les actions, et la liste des
  comptes, sans que la carte devienne une barre d'outils ;
- le traitement de la première configuration : une carte dense mêlant instructions
  numérotées, champs, secret multiligne et checklist de validation ;
- le traitement des attentes et des sorties d'app (redirection vers la banque,
  synchronisation initiale).
