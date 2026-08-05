# Brief Claude Design — écran « Espaces »

Prompt à passer tel quel à Claude Design (projet `fc13100e-7ea1-4dac-8d2f-6614e40a7209`,
celui qui porte « Revue du mois », « Transactions », « Catégories » et « Banques »).

Écrit le 2026-08-05, après le passage de l'app en multi-utilisateurs : le
cloisonnement par espace est en place côté serveur, mais **il n'y a aucune UI de
gestion de groupe** — créer un espace partagé, inviter, retirer un membre se
font en base. C'est ce trou que cette maquette doit combler.

Le brief liste volontairement ce qui n'existe pas en base : c'est la leçon des
portages précédents (bloc « Synchronisé à 07:12 » de Banques, pastille « N à
confirmer » de Catégories, score de confiance de la file « À revoir »), tous
abandonnés faute de source. Le tenir à jour si le modèle bouge.

---

## Contexte

Application web de finances personnelles, en français, usage familial (pas un
produit SaaS). Elle synchronise des comptes bancaires réels via PSD2, catégorise
les transactions et affiche une revue mensuelle.

Cet écran s'ajoute à un design existant du même projet — « Revue du mois »,
« Transactions », « Catégories », « Banques ». Reprends leur langage visuel :
même en-tête applicatif, mêmes tokens, même densité. Le gabarit des écrans de
réglages (Catégories, Banques) est : conteneur `mx-auto max-w-[1010px]`, titre
et bloc de compteurs sur une même rangée, chapô en dessous.

## Ce qu'est un « espace »

L'unité de cloisonnement des données. Un espace contient des comptes bancaires,
des catégories, des budgets et des transactions ; deux espaces ne voient rien
l'un de l'autre.

- Chaque utilisateur a un **espace personnel**, créé automatiquement à son
  inscription et nommé d'après lui.
- Un **espace partagé** (un foyer) réunit plusieurs utilisateurs. Tous ses
  membres voient les mêmes comptes et les mêmes catégories, sans distinction :
  il n'y a pas de notion de « ma » transaction dans un espace partagé.
- Deux rôles seulement : **propriétaire** et **membre**. Le propriétaire peut
  inviter, retirer un membre, renommer et supprimer l'espace.
- **Un compte bancaire appartient à exactement un espace.** Partager un compte,
  c'est ajouter un membre à l'espace qui le contient — il n'y a pas de partage
  compte par compte, et ce n'est pas une simplification à contourner dans le
  design.
- L'espace courant vit dans la session, pas dans l'URL. En changer **recharge
  la page** : la bascule n'est pas instantanée, ne la dessine pas comme un
  simple onglet.

## Où ça vit

Une nouvelle route `/espaces`, quatrième écran de réglages à côté de
`/categories`, `/budgets` et `/banques`, atteinte par le menu de l'engrenage de
l'en-tête. Ce menu porte déjà la bascule d'espace (liste plate, visible
seulement à partir de deux espaces) — dis si tu la fais évoluer.

## Ce qu'il faut couvrir

1. **Liste de mes espaces** — le personnel et les partagés, avec lequel est
   actif, et de quoi basculer.
2. **Créer un espace partagé.**
3. **Voir un espace** : ses membres, leur rôle, les invitations en attente, et
   ce qu'il contient (comptes, catégories, transactions).
4. **Inviter quelqu'un**, par adresse email — un email d'invitation est envoyé
   avec un lien d'acceptation. Une invitation a quatre états, et pas un de plus :
   en attente, acceptée, expirée, annulée. Prévois aussi le renvoi.
5. **Accepter une invitation** : l'écran que voit l'invité en ouvrant le lien.
   Deux cas — il a déjà un compte (il accepte, il est ajouté), ou il n'en a pas
   (il crée son compte d'abord ; l'inscription est **réservée aux invités**, il
   n'y a pas d'inscription libre).
6. **Quitter un espace**, **retirer un membre**, **annuler une invitation**,
   **renommer**, **supprimer un espace**.

## Les données réellement disponibles

N'affiche que ça — tout le reste devrait être inventé.

Par espace : nom, date de création, rôle de l'utilisateur courant, nombre de
membres, nombre d'invitations en attente, nombre de comptes bancaires, nombre
de catégories, nombre de transactions.

Par membre : nom, adresse email, rôle, date d'arrivée dans l'espace.

Par invitation : adresse email invitée, rôle proposé, statut, date d'expiration,
qui a invité.

Bonus disponible et utile sur un espace partagé : chaque connexion bancaire sait
**qui** s'est authentifié auprès de la banque. Le consentement PSD2 se renouvelle
tous les ~180 jours et **seule cette personne peut le faire** — un espace partagé
gagne à le dire.

## Ce qui n'existe pas — ne le dessine pas

C'est la règle la plus importante de ce projet : un écran ne promet que ce que
la base sait. Précédemment, plusieurs blocs de maquette ont dû être abandonnés
au portage faute de source. En particulier, **il n'y a pas** :

- de photo ni d'avatar (inscription par email/mot de passe, aucune image) ;
- de « dernière activité », « en ligne », « vu il y a 2 j » ;
- de trace de qui a fait quoi (qui a catégorisé, qui a connecté quelle banque —
  hormis l'auteur du consentement bancaire cité plus haut) ;
- de dépense par membre : les transactions d'un espace partagé n'ont pas
  d'auteur, elles appartiennent aux comptes.

Si un de ces éléments te paraît indispensable à l'écran, signale-le comme une
demande explicite plutôt que de l'intégrer discrètement.

## Trois questions que le design doit trancher

1. **Le cas de départ, et le plus délicat.** Quelqu'un utilise l'app depuis des
   mois : ses comptes, ses catégories, ses budgets et son historique sont dans
   son espace personnel. Il crée un espace « Foyer » — qui démarre **vide**. Rien
   ne permet aujourd'hui de déplacer un compte d'un espace à un autre. Quel
   parcours proposes-tu ? Reconnecter les banques dans le nouvel espace (l'app
   sait le faire, mais l'historique et les catégories ne suivent pas) ? Inviter
   l'autre personne dans l'espace personnel existant, quitte à le renommer ?
   Autre chose ? Le choix engage le reste de l'écran.
2. **L'espace personnel peut-il être partagé**, ou reste-t-il par principe à un
   seul membre ? Techniquement les deux sont possibles ; c'est une décision de
   produit.
3. **Supprimer un espace efface ses comptes, ses catégories et ses
   transactions**, définitivement. Quelle confirmation ? Et faut-il l'offrir
   pour l'espace personnel ?

## Contraintes

- Tout en français.
- Thèmes clair et sombre, comme les autres écrans.
- Densité identique à l'existant : corps de texte ~12,5–13 px, contrôles ~31–34 px
  de haut, coins arrondis 7–14 px.
- Écran de bureau en priorité ; il n'a pas besoin d'être responsive au-delà de
  rester lisible en fenêtre étroite.
- Prévois les états vides et intermédiaires : un seul espace (personnel, aucun
  partagé), un espace partagé sans autre membre, une invitation expirée, un lien
  d'invitation déjà utilisé.

---

## Notes hors brief (ne pas envoyer à Claude Design)

- **L'envoi d'email n'est pas encore en place** (aucun `sendInvitationEmail`
  configuré dans `@budget/auth`, aucune dépendance de mailer). Le brief le
  suppose fait, décision du 2026-08-05 : c'est peu de travail et ça évite de
  dessiner un contournement par lien à copier-coller qu'il faudrait défaire.
  À faire avant de porter l'écran, sinon l'invitation ne part pas.
- **Pas de suivi de délivrabilité**, et c'est assumé : « envoyée » et
  « acceptée » sont des faits, « reçue » ou « ouverte » n'en seront pas. Les
  quatre états d'invitation du point 4 sont exactement ceux de la table
  `invitation` de better-auth.
- La route d'acceptation (`/accept-invitation/<id>` ou équivalent) reste à
  créer ; `authClient.organization.acceptInvitation({ invitationId })` en est le
  seul appel.
