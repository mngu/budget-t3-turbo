# Veille — Actual Budget (2026-08-26)

Relevé de ce que fait, et de ce qu'on réclame à, [Actual Budget](https://actualbudget.org) —
outil de finances personnelles open source au positionnement voisin du nôtre (local-first,
autohébergé, synchronisation bancaire), mais à une échelle de communauté que nous n'avons pas.

**Objet** : nourrir les décisions de feature de ce projet. Ce document n'engage rien — ce n'est
ni un ADR ni une spec. C'est un instantané daté ; les chiffres cités bougent.

---

## 1. Méthode, et pourquoi elle change la lecture

Actual **ferme ses feature requests**, livrées ou refusées. Le backlog ouvert est à 82 % du bug
(136 bugs sur 165 issues ouvertes, aucune `[Feature]`). Deux conséquences :

- Le classement par 👍 **toutes issues confondues** n'est pas un backlog : c'est
  **l'historique de la demande satisfaite** sur quatre ans. Beaucoup plus utile — le tri a déjà
  été fait par les mainteneurs, et les votes portent sur des demandes qui ont survécu à la
  confrontation avec l'implémentation.
- Les issues **`[Feedback]`** ouvertes (12) sont les features expérimentales derrière feature
  flag, dont on collecte le retour. Là, le signal est le **nombre de commentaires**, pas les 👍.

Sources : issues et labels via l'API GitHub (`gh`), le site officiel, la doc des features
expérimentales, le roadmap 2026.

> **Écarté après vérification** : une recherche web remonte des bullets (« Safe-to-Spend
> Dashboard », « Smart Budget Planner ») qui viennent d'une **app homonyme sur l'App Store**,
> pas d'Actual Budget. Ne pas les reprendre.

---

## 2. Les features les plus utilisées

Deux sources fiables : les déclarations des mainteneurs dans le roadmap 2026, et le volume de
discussion.

| Feature                                                           | Signal                                                                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Table de transactions**                                         | « probablement la feature la plus importante de l'app, davantage encore que le budget lui-même » — réécriture prévue en 2026                                     |
| **Goal templates** (objectifs par catégorie, syntaxe `#template`) | « utilisée par beaucoup d'entre vous, sinon la plupart » — alors qu'elle est expérimentale et se pilote en tapant du texte dans le champ _notes_ d'une catégorie |
| **Bank sync**                                                     | 136 bugs ouverts, canal Discord dédié dans le template d'issue, 4 fournisseurs (GoCardless, SimpleFIN, Enable Banking, Pluggy)                                   |
| **Rules** (payee → catégorie, regex)                              | 3 des 12 chantiers ouverts en dépendent                                                                                                                          |
| **Custom reports / dashboard**                                    | 4 des 12 chantiers ouverts sont des rapports                                                                                                                     |
| **Schedules** (échéances récurrentes)                             | irriguent le budget, les prévisions, la vue calendrier                                                                                                           |

Socle du produit : **enveloppes budgétaires** (on ne budgète que l'argent réellement encaissé),
local-first, chiffrement optionnel, autohébergement.

---

## 3. Le classement de la demande (features **déjà livrées**)

Quatre ans de vote sur ce que veulent des gens qui gèrent leurs finances personnelles.

| 👍      | Demande                                                                |
| ------- | ---------------------------------------------------------------------- |
| **490** | Objectifs de budget — UI                                               |
| **369** | **Bank sync : reconnaître les virements entre ses propres comptes**    |
| 333     | Multi-devises                                                          |
| 324     | Sous-catégories                                                        |
| 319     | Intégration bancaire (Plaid)                                           |
| 315     | Multi-utilisateurs                                                     |
| 241     | Colonnes redimensionnables (table de transactions)                     |
| **204** | **Barre de progression des objectifs**                                 |
| **198** | **Pièces jointes sur les transactions** (photo de ticket)              |
| 177     | 2FA / passkeys                                                         |
| 163     | Rapports personnalisés                                                 |
| **147** | Alternative à GoCardless → c'est **Enable Banking**, notre fournisseur |
| 140     | Rapport de soldes projetés                                             |
| **123** | **Tags sur les transactions**                                          |
| 121     | Fusionner des transactions non appariées                               |
| 109     | Sync bancaire automatique périodique                                   |
| 107     | Changer le 1ᵉʳ jour du mois                                            |
| **87**  | **Vue budget : afficher les transactions à venir**                     |
| 64      | Vue calendrier des échéances                                           |

**Lecture transverse** : **7 des 20 premières demandes portent sur la qualité de l'import
bancaire**, pas sur le budget (virements internes, fusion de doublons, sync périodique,
alternative à GoCardless, apprentissage des tiers…). Ce classement valide le pari de ce
projet : le travail est dans le tuyau qui amène des transactions propres, l'écran de budget
n'étant que la récompense.

---

## 4. Les 12 chantiers ouverts (ce qui se construit aujourd'hui)

| Commentaires | Sujet                                                          |
| ------------ | -------------------------------------------------------------- |
| 145          | UI d'automatisation du budget (« Goals UI »)                   |
| **141**      | **Fournisseur Enable Banking**                                 |
| 104          | Cartes-formules / règles-formules (mode « Excel »)             |
| 85           | Diagramme de Sankey (flux revenus → dépenses)                  |
| 67           | Templating dans les actions de règles                          |
| 63           | Symboles de devise                                             |
| 23 / 20 / 8  | Rapports : analyse budgétaire, prévision de solde, Monte-Carlo |
| 10 👍        | Plugins frontend — priorité n°1 du roadmap 2026                |

---

## 5. Le fil Enable Banking (#7799) — même fournisseur que nous

141 commentaires. Les problèmes rencontrés par leurs utilisateurs sont ceux que notre pipeline
peut rencontrer :

- **Virements entre deux comptes suivis non appariés** → un tiers fantôme est créé et les
  agrégats sont faussés. C'est aussi leur demande n°2 de tous les temps (+369).
- **Opérations en attente / empreintes de carte** comptées comme des crédits, qui « cassent » le
  solde courant, puis rebasculent en débit une fois débitées.
- **La date de début choisie à la liaison est ignorée** → 371 transactions historiques importées
  d'un coup.
- **Erreurs de consentement muettes** : liste de comptes vide au lieu de « votre application
  Enable Banking n'est pas activée » / « le consentement a expiré ».
- Liste de banques non triée ; comptes absents après autorisation chez certaines banques
  traditionnelles (Fineco IT, OTP Banka SI).

---

## 6. Ce qu'on en tire pour ce projet

Filtré par notre réalité : 3 comptes, un foyer, sync bancaire comme unique source,
catégorisation LLM.

### ① Les échéances récurrentes + le solde projeté — _le vrai trou_

Rien dans nos routes ni notre schéma ne connaît le récurrent. C'est le socle d'Actual
(schedules → budget → prévision), et nous avons de quoi le **déduire sans saisie** :
`counterparty` + `amount` + périodicité sur l'historique donnent « Loyer, ~1 200 €, le 5 ».
De là : « il reste 640 € réellement disponibles avant la fin du mois, 3 prélèvements à venir ».
C'est la question que se pose un humain le 18 du mois, et l'anneau n'y répond pas.

### ② Sortir l'apprentissage de la catégorisation de sa boîte noire

Ne **pas** construire un moteur de règles — il en existe un en creux
(`category_source: manual | auto | llm`, court-circuit ≥2 similaires même contrepartie).
Ce qui manque est l'inverse : _rendre visible_ ce qu'il apprend. « Rangé dans Courses parce que
7 transactions Carrefour l'étaient », « corrigé une fois → les 14 suivantes suivront ».
Deux issues récentes d'Actual sont exactement ça (`imported_payee → payee learning`, et le bug
« Category learning isn't happening »).

### ③ Objectifs par catégorie et report d'enveloppe — _la grosse_

+490 et +204 en votes, « utilisée par la plupart » selon les mainteneurs. Mais c'est un
**changement de modèle, pas une feature** : `categories.budget_amount` passerait de cible fixe à
enveloppe roulante (le non-dépensé de janvier gonfle février, le dépassement le creuse).
Ça touche `budget_detailed`, l'invariant « parente = somme des enfants » et chaque agrégat.
À décider avant de coder.

### ④ Le Sankey

85 commentaires chez eux. Revenus → grands postes → sous-postes, sur un mois ou une année.
Presque gratuit ici : `breakdown.ts` calcule déjà la hiérarchie que le diagramme veut afficher.
Complément de l'anneau, qui montre la répartition mais pas le **flux**.

### ⑤ Les tags (+123)

Transversaux aux catégories — « Vacances Italie », « Travaux salle de bain »,
« remboursable par Paul ». Une catégorie répond « quel type de dépense », un tag répond
« quel projet », et la seconde question n'a aucune réponse dans notre modèle. C'est aussi ce qui
rend un **espace partagé** utile : marquer qui doit rembourser quoi.

### ⑥ Les pièces jointes (+198)

Photo du ticket sur la transaction. Peu de code, forte valeur perçue, referme la boucle
« c'était quoi ce paiement de 84 € ? » que ni la catégorie ni le libellé bancaire ne referment.

### ⑦ Robustesse Enable Banking

Tiré du §5 : surfacer l'expiration de consentement comme une erreur nommée et actionnable,
traiter les `pending` à part dans les agrégats (la colonne `status` existe), respecter une date
de début à la liaison.

### À écarter explicitement

Multi-devises (+333), groupes de comptes (+146), rapprochement bancaire (+47), OIDC/2FA (+177),
actions et crypto (+74), plugins. Ce sont des préoccupations de **communauté autohébergée
hétérogène** — elles n'existent pas à l'échelle de 3 comptes personnels dans un foyer. Actual les
porte parce qu'il sert des milliers d'installations ; nous en servons une.

---

## 7. Le cas des virements internes

La demande n°2 d'Actual (+369, « reconnaître les virements entre ses propres comptes ») est
précisément ce que ce projet a **retiré** avec `5cb162f`. La veille l'a fait remarquer, et le
reliquat qui traînait encore (colonnes `transfer_pair_id` / `transfer_source`, neutralisation
dans les agrégats, param d'URL `internes`) a été supprimé dans la foulée — voir le tombstone
dans `packages/api/CLAUDE.md` et la migration `0004_drop_transfer_pairing`.

**La fonctionnalité est à refaire autrement.** Ce que la veille apporte à cette refonte :

- 369 personnes la réclament ailleurs — le besoin n'est pas une lubie, il est structurel dès
  qu'on suit plus d'un compte.
- Leurs utilisateurs Enable Banking la rencontrent en direct (§5) : sans appariement, un tiers
  fantôme est créé et les totaux gonflent.
- La spec d'origine (`2026-08-03-virements-internes-design.md`) reste dans ce dossier. Deux de
  ses acquis, mesurés sur nos vraies données, survivent au changement d'approche : le signal
  décisif est **négatif** (un IBAN de contrepartie renseigné qui ne désigne pas la jumelle refuse
  la paire), et `mcc` étant vide sur 100 % des lignes, c'est `bank_code` qui sert de veto — en
  **liste noire**, SG ne renseignant pas ce champ.

---

## 8. Deux leçons de forme

**Le classement se lit à deux niveaux.** En surface : « les gens veulent des objectifs de
budget ». En profondeur : la majorité de la demande porte sur l'import bancaire (§3).

**La feature « utilisée par la plupart » chez eux a une UX indéfendable** — on la pilote en
tapant `#template 200 monthly` dans un champ _notes_, au point qu'ils lui construisent enfin une
interface en 2026. L'inverse de ce projet, qui soigne l'interface d'abord. Le mérite d'Actual est
d'avoir découvert ce que les gens voulaient _avant_ d'investir dans l'écran.

---

## Sources

- [actualbudget.org](https://actualbudget.org/)
- [Roadmap 2026](https://actualbudget.org/blog/roadmap-for-2026/)
- [Features expérimentales](https://actualbudget.org/docs/experimental/)
- [#7799 — Enable Banking bank sync provider](https://github.com/actualbudget/actual/issues/7799)
- [#1628 — Bank Sync : Recognise transfers between accounts](https://github.com/actualbudget/actual/issues/1628)
- [#496 — Budget goals, UI implementation](https://github.com/actualbudget/actual/issues/496)
- [#1919 — Sankey Chart](https://github.com/actualbudget/actual/issues/1919)
