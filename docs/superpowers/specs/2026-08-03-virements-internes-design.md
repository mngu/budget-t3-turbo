# Virements internes entre comptes — design

Date : 2026-08-03

## Contexte et objectif

Un virement d'un compte à un autre — tous deux connectés — produit deux transactions : un débit sur le compte source, un crédit sur le compte destinataire. Rien en base ne les relie, donc les deux entrent dans les agrégats : un aller-retour de 2 000 € ajoute 2 000 € aux entrées **et** 2 000 € aux sorties du mois. Aucun argent n'est entré ni sorti du foyer, mais tous les chiffres de la revue sont gonflés.

Mesuré sur la base réelle (mai → août 2026) : les paires candidates pèsent **~11,6 k€** pour des mois affichés autour de 13 k€ d'entrées, soit ~20 % de gonflage. L'objectif est de détecter ces paires automatiquement, de les neutraliser dans tout ce qui agrège, et de laisser les lignes visibles et corrigeables.

### Pourquoi pas « exclure la catégorie _Épargne & virements internes_ »

C'est la solution évidente et elle ne marche pas. Sur les données réelles, le LLM a rangé **25** de ces transactions en `Revenus › Apport Alex`, 9 en `Revenus › Apport Camille`, 4 seulement en `Autres › Virement interne`. La catégorisation ne porte donc pas l'information, et elle ne le pourrait pas de façon fiable : elle regarde une transaction isolée, alors qu'un virement interne est une propriété d'une **paire**. En prime, une catégorie « virements internes » contiendrait aussi de la vraie épargne, qui est bien une sortie du budget courant.

Le fait doit donc être persisté sur la transaction, pas déduit de sa catégorie.

## Détection

### Critères d'appariement

Une paire candidate est formée d'un débit `d` et d'un crédit `c` tels que :

- `d.amount = c.amount` et `d.currency = c.currency` ;
- `d.account_id <> c.account_id` (tous les comptes de la table `accounts` sont ceux de l'utilisateur : un appariement inter-comptes est par construction un mouvement interne) ;
- `abs(c.booking_date - d.booking_date) <= 3` jours ;
- ni `d` ni `c` n'est déjà apparié (l'appariement est un-à-un).

Sur l'historique réel, ces critères seuls produisent 24 paires, dont **4 fausses**. Les signaux ci-dessous les écartent.

### Signaux de décision, par ordre d'autorité

`raw` porte, quand la banque le renseigne, l'IBAN de la contrepartie : `raw.debtor_account.iban` sur un crédit, `raw.creditor_account.iban` sur un débit. Seul Revolut le fournit chez nous (18/21 crédits, 10/241 débits) ; Caisse d'Épargne et Société Générale ne le fournissent jamais. Il suffit qu'**une seule** des deux jambes le porte pour trancher la paire entière.

1. **Confirmation par IBAN** — l'IBAN de contrepartie d'une jambe est celui d'un compte de `accounts`. La paire est certaine, quel que soit l'écart de dates.
2. **Veto par IBAN** — l'IBAN de contrepartie d'une jambe est renseigné et n'appartient à **aucun** compte de `accounts`. La paire est refusée, sans appel. C'est le signal le plus utile des deux : il couvre 19 jambes contre 9 pour la confirmation, et c'est lui qui sépare `Apport Alex` (interne) de `Apport Camille` (vraie entrée du foyer, virement depuis le compte non connecté de la conjointe) alors que les deux ont le même montant, le même jour, et le même compte destinataire.
3. **Veto par `bank_code`** — une jambe dont le `bank_code` désigne une opération par carte, un retrait ou un prélèvement ne peut pas être un virement. Liste : `CARD_PAYMENT`, `CARD_REFUND`, `REV_PAYMENT` (Revolut), `28` (CB), `29` (retrait DAB), `30` (remboursement CB), `62` (cotisation), `B1` (prélèvement) (Caisse d'Épargne). C'est un **veto**, jamais une liste blanche : Société Générale ne renseigne pas `bank_code` du tout, une liste blanche l'exclurait entièrement de la détection.
4. **Écart de dates** — 0 ou 1 jour suffit. Un écart de 2 ou 3 jours n'est accepté **que** confirmé par IBAN. Sur les données réelles, les seuls candidats à 3 jours sans confirmation sont précisément deux des faux positifs.

`mcc` n'est utilisé nulle part : la colonne est vide sur **100 %** des lignes (0/461 débits), les trois banques ne la renseignent pas.

### Appariement un-à-un

Une jambe peut avoir plusieurs candidats (vu dans les données : un débit de 2 000 € face à deux crédits de 2 000 € le même week-end). L'algorithme :

1. génère toutes les paires candidates, vetos appliqués ;
2. les trie par autorité décroissante : confirmée par IBAN d'abord, puis écart de dates croissant ;
3. les consomme dans cet ordre en sautant celles dont une jambe est déjà prise.

Aucune paire n'est retenue par tirage au sort entre deux candidats de même score : à égalité parfaite, la première rencontrée l'emporte, et l'utilisateur dispose de l'action manuelle pour corriger. Le cas ne s'est pas présenté sur l'historique.

### Quand elle tourne

`detectInternalTransfers()` est une passe **idempotente sur toute la table**, pas seulement sur les lignes fraîchement importées. C'est nécessaire, pas défensif : `monthlyHistory` alimente `referenceAverage` sur 12 mois, et n'apparier que les nouveaux imports ferait comparer un mois courant propre à des mois passés gonflés — un écart inventé de toutes pièces sur chaque tuile de comparaison.

Elle s'insère dans `pipeline.ts`, entre l'import et la catégorisation, et partage le verrou `sync`. Comme la catégorisation, elle est _best-effort_ : son échec est logué et n'invalide pas un import réussi.

Elle ne touche jamais une ligne à `transfer_source = 'manual'`, dans un sens comme dans l'autre — même contrat que `category_source`.

## Stockage

Deux colonnes additives sur `transactions` :

- `transfer_pair_id integer references transactions.id` — l'autre jambe de la paire. Auto-référence via `AnyPgColumn`, comme `categories.parent_id`. Les deux lignes se pointent mutuellement.
- `transfer_source text enum('auto','manual')` — qui a posé (ou retiré) l'appariement.

Plus un index sur `transfer_pair_id`.

Pourquoi des colonnes plutôt qu'une table `internal_transfers(debit_id, credit_id)` : le filtre devient un prédicat sur `transactions` **sans jointure supplémentaire**, alors que `transactionsFilterQuery` en traîne déjà trois dont CLAUDE.md rappelle qu'un oubli compile et ne casse qu'une fois le filtre posé. Et la paire `(pair_id, source)` reprend telle quelle l'idiome déjà documenté de `(category_id, category_source)`, dont la règle « `manual` n'est jamais écrasé » se transpose sans rien inventer.

Les trois états, dont le troisième est ce qu'une table de paires aurait demandé une table de tombstones pour exprimer :

| `transfer_pair_id` | `transfer_source` | Sens                                                                          |
| ------------------ | ----------------- | ----------------------------------------------------------------------------- |
| `NULL`             | `NULL`            | transaction ordinaire                                                         |
| id de la jumelle   | `auto`            | paire détectée                                                                |
| id de la jumelle   | `manual`          | paire posée à la main — la détection n'y touche plus                          |
| `NULL`             | `manual`          | « ce n'est pas un virement interne » — la détection ne la ré-appariera jamais |

## Neutralisation : la règle du périmètre

**Une paire n'est neutralisée que si ses deux jambes appartiennent aux comptes sélectionnés.** Si la jumelle est hors sélection, la ligne redevient une vraie entrée ou une vraie sortie — parce qu'elle en est vraiment une, pour le périmètre regardé.

| Sélection                 | −2 000 (CE)          | +2 000 (Revolut)     |
| ------------------------- | -------------------- | -------------------- |
| Tous les comptes (défaut) | neutralisé           | neutralisé           |
| Revolut seul              | hors périmètre       | **compté en entrée** |
| Caisse d'Épargne seule    | **compté en sortie** | hors périmètre       |

L'alternative — « un virement interne est interne, on l'exclut toujours » — est plus simple à énoncer et fausse dès qu'on isole un compte : Revolut afficherait 1 600 € de loyer sorti et 0 € entré, un solde massivement négatif sur un compte qui n'a jamais été à découvert. La règle du périmètre garantit une propriété vérifiable en permanence, et c'est elle qui la rend défendable à l'écran : **le solde affiché = la variation réelle des comptes affichés**, quelle que soit la sélection.

Trois précisions qui découlent du choix, et qu'il ne faut pas éroder :

- **Le périmètre, c'est les comptes, et rien d'autre.** Ni `dateFrom`/`dateTo`, ni `q`, ni `category`, ni `direction` n'entrent dans la condition. Les dates en particulier : les paires vont jusqu'à 3 jours d'écart, donc à cheval sur deux mois (un candidat 31/07 ↔ 03/08 existe dans les données). Si la période entrait dans le périmètre, juillet afficherait −2 000 et août +2 000 — l'artefact qu'on supprime, déplacé sur la frontière de mois. Une paire retenue est neutralisée des deux côtés, période affichée ou non.
- **La condition suit le filtre du picker, pas `account_id`.** Le sélecteur de comptes travaille sur `coalesce(display_name, bank_name)` ; les deux comptes Société Générale partagent ce libellé et sont indissociables dans l'UI. La sous-requête ré-applique donc exactement le prédicat `bank` de `transactionsFilterQuery` — sinon le filtre et sa condition de périmètre ne diraient pas la même chose.
- **`bank` est le seul filtre ré-appliqué à la jumelle.** Une liste vide ou `undefined` vaut « tous les comptes », donc toutes les paires sont neutralisées : c'est le cas par défaut.

### Implémentation

Dans `transactionsFilterQuery`, un `NOT EXISTS` corrélé :

```sql
not exists (
  select 1 from transactions jumelle
  join accounts jumelle_compte on jumelle_compte.id = jumelle.account_id
  where jumelle.id = transactions.transfer_pair_id
    and <prédicat bank appliqué à jumelle_compte>
)
```

Pas de jointure ajoutée à la requête principale, une seule fonction à corriger si la définition bouge.

## Où l'exclusion s'applique

| Écran / requête                                       | Virements internes                          |
| ----------------------------------------------------- | ------------------------------------------- |
| `/transactions` — `listTransactions`                  | **visibles**, badge « ⇄ »                   |
| Tuiles Débits/Crédits — `transactionTotals`           | exclus, avec mention du montant écarté      |
| `/` — `transactionsByCategory`, anneau et bandeau     | exclus                                      |
| `/categorie/$name` — détail d'une part de l'anneau    | exclus                                      |
| `/classer` et file « À revoir » — `reviewQueue`       | exclus                                      |
| Historique et moyenne de référence — `monthlyHistory` | exclus                                      |
| `bankCounts` (pastilles du sélecteur de comptes)      | **inclus** — seule exception, voir plus bas |

L'exclusion n'est **pas** un filtre utilisateur sur les agrégats : elle est neutralisée à l'intérieur de chaque fonction, jamais laissée à l'appelant. C'est le motif que `monthlyHistory` applique déjà à `direction`, pour la même raison — un oubli à l'appel serait invisible à l'écran, tous les chiffres restant plausibles.

Seul le relevé complet lit le param de recherche `internes` (`toutes` par défaut, `masquer`, `seulement`). `seulement` est l'écran d'audit de la détection : c'est là qu'on vérifie les paires trouvées et qu'on écarte un faux positif.

### Le coût de la règle « seul le relevé les montre », et le piège qu'elle pose

Une variante plus simple existait : exclure partout, y compris du relevé, avec une puce pour les révéler. Elle a été écartée — la table est le relevé, elle doit se réconcilier avec ce que la banque affiche, et une ligne de −2 000 € absente est plus déroutante que le problème qu'on répare.

Le prix à payer est réel et il a été payé pendant l'implémentation : la décision quitte l'unique `transactionsFilterQuery` pour se répartir sur **chaque liste qui détaille un agrégat**. `/classer` (les cartes à classer) et `/categorie/$name` (les lignes du zoom) passent par `transactions.list`, qui honore le param puisqu'il sert aussi le relevé : ils listaient donc des virements que l'agrégat au-dessus d'eux avait écartés — `/classer` présentant un virement interne comme du travail à faire, et le zoom affichant un total qui ne fait pas la somme de ses lignes, sans la mention qui l'explique sur `/transactions`. Les deux ont été corrigés par `aggregateDetail()` (`lib/transactions-search.ts`), à côté de `wholePeriod` et `reviewScope`.

**Toute nouvelle liste bâtie sur `transactions.list` doit passer par `aggregateDetail`**, sauf à vouloir délibérément le relevé complet. C'est le point de vigilance permanent de ce design.

### La seule exception : `bankCounts`

Les pastilles du sélecteur de comptes comptent des **lignes**, pas de l'argent, et elles annoncent ce que la table affichera une fois le compte coché. Deux raisons de ne rien y exclure, la seconde étant décisive : la table montre ces lignes par défaut, et surtout `bankCounts` neutralise `bank` (sinon cocher un compte mettrait les autres à zéro et on ne saurait plus vers quoi basculer) — son périmètre est donc « tous les comptes » alors que le clic va le restreindre. Une paire aujourd'hui neutralisée cesse de l'être dès qu'on isole l'un de ses deux comptes : la pastille annoncerait 2 pour une table qui en liste 3. Repéré à l'écran pendant l'implémentation, où le panneau affichait « 11 transactions sur la période » au-dessus d'une table de 13 lignes.

### Le cas particulier de `reviewQueue`

`reviewQueue` calcule le sens dominant de chaque catégorie par une requête **sans aucun `where`** (`queries.ts:395`), sur tout l'historique. Elle doit exclure les jambes appariées — sans périmètre de comptes, puisque la requête n'en a aucun : c'est une statistique de la catégorie, pas du mois ni de la sélection. Sans cette exclusion, « Revenus » resterait crédit-dominant à cause des legs internes et le motif « sens inhabituel » désignerait les mauvaises lignes.

## UI

**Table des transactions** — un badge à côté du libellé, sur le modèle de la pastille « à revoir » existante :

- jumelle dans la sélection → « ⇄ interne », et la ligne est décomptée dans la mention des tuiles ;
- jumelle hors sélection → « ⇄ vers _Caisse d'Épargne (perso)_ » : l'information reste utile, mais la ligne compte, et rien ne prétend le contraire dans les tuiles.

**Tuiles Débits/Crédits** — sous-ligne « hors 1 virement interne (2 000 €) », cliquable vers `internes=seulement`. Elle n'est pas décorative : les tuiles ne font plus la somme des lignes affichées, et c'est cette mention qui transforme un écart inexplicable en information. Sans elle, mieux vaudrait ne rien exclure.

**Puce dans `RefineBar`** (`/transactions` seulement) — `Toutes` / `Masquer` / `Seulement`.

**Action manuelle** — sur une ligne appariée, « Ce n'est pas un virement interne » : passe les **deux** jambes à `transfer_pair_id = NULL, transfer_source = 'manual'`. Irréversible par la détection, ce qui est le but.

L'appariement manuel d'une paire non détectée n'est **pas** dans ce lot. Il demande un sélecteur de jambe (chercher la transaction jumelle) qui est un écran à part entière, et le cas ne se présente pas sur les données actuelles. Les colonnes le permettent déjà (`transfer_source = 'manual'` avec un `pair_id`), c'est l'UI qui manque.

## Interaction avec la catégorisation

Aucune. Une jambe appariée reste catégorisée comme avant : la catégorisation ignore `transfer_pair_id`, et le prompt n'en sait rien. Deux raisons : la détection tourne avant la catégorisation mais peut apparier plus tard une ligne déjà classée (une jumelle arrivée à l'import suivant), et surtout CLAUDE.md interdit de coder en dur un nom de catégorie dans le prompt — « ne classe pas les virements internes » n'aurait de sens qu'adossé à une catégorie nommée.

Conséquence visible et voulue : la ligne garde son étiquette `Revenus › Apport Alex` dans le relevé, mais elle ne pèse plus dans l'anneau ni dans le total de la catégorie.

## Cas limites et limites connues

- **Virement multi-devises** : jamais apparié, l'égalité de devise étant une garde nécessaire (un virement EUR → USD n'a pas le même montant sur les deux jambes). Limite assumée ; aucune occurrence dans les données.
- **Virement vers un compte non connecté** (Livret A, compte de la conjointe) : une seule jambe visible, rien à apparier — et c'est correct, cet argent quitte bien le périmètre des comptes suivis. Si un tel compte devait être neutralisé, il faudrait un marquage à une jambe, hors de ce lot.
- **Une jambe supprimée** : `transfer_pair_id` référence `transactions.id` ; rien ne supprime de transaction aujourd'hui. Si cela devenait possible, la contrainte de clé étrangère refuserait la suppression — à traiter le moment venu, pas par anticipation.
- **Frais de virement** : un virement dont le destinataire reçoit un montant différent (frais prélevés en route) ne s'apparie pas. Non observé sur des virements SEPA internes.
- **Réauthentification bancaire** : `accounts.uid` change tous les ~180 jours, pas `accounts.iban` — la confirmation par IBAN lit `accounts.iban`, elle survit donc à une reconnexion. Un compte sans IBAN en base (le compte SG id 3) ne peut ni confirmer ni vetoer, il retombe sur les critères de date et de `bank_code`.

## Tests (`packages/api/src/transactions/internal-transfers.test.ts`)

La fonction de décision est pure (elle reçoit les jambes et les IBAN des comptes, elle renvoie les paires) : les tests portent sur elle, sans base. Cas repris des données réelles :

- paire confirmée par IBAN à J+0 → appariée ;
- deux candidats pour un même débit, l'un confirmé par IBAN, l'autre vetoé par IBAN externe (03/08, 2 000 €, « Apport Alex » vs « PROVISIONS Camille ») → seule la confirmée est retenue ;
- crédit de salaire à J+3 avec IBAN externe (« EMPLOYEUR INC », 500 €) → jamais apparié ;
- débit `CARD_PAYMENT` face à un virement de même montant à J+2 (« Mini Golf Marais », 10 €) → vetoé ;
- paire sans aucun IBAN à J+0, aucun `bank_code` de veto (CE perso → CE commun) → appariée ;
- même paire à J+2 sans confirmation IBAN → refusée ;
- un débit, deux crédits éligibles de même score → un seul appariement, l'autre crédit reste libre ;
- même compte, ou devises différentes → jamais apparié ;
- un compte sans IBAN en base (le compte SG id 3) → ni confirmation ni veto, la paire retombe sur les autres critères ;
- montant écrit « 2000.0 » face à « 2000.00 » → apparié quand même.

Plus, dans `pipeline.test.ts`, l'ordre import → appariement → catégorisation, et le fait qu'un échec d'appariement n'invalide pas l'import (best-effort).

### Ce qui n'est pas couvert par des tests, et pourquoi

À énoncer plutôt qu'à laisser deviner :

- **La garde `manual`** vit dans le `where` SQL de `detectInternalTransfers`, pas dans le matcher pur : elle n'est pas testable dans ce fichier, et aucun test ne la couvre aujourd'hui.
- **La règle du périmètre** (`twinWithinScope`) est du SQL, et tous les tests de ce dépôt mockent `@budget/db/client` — il n'existe pas de harnais de test adossé à une base. Elle a été vérifiée à la main sur les données réelles : tous comptes → 6 paires écartées de juillet (3 698,60 € par sens) ; Revolut seul → les mêmes lignes comptées, badge « ⇄ Caisse d'Épargne (perso) », aucune mention d'exclusion ; `masquer` (231) + `seulement` (12) = `toutes` (243).
- **`unlinkInternalTransfer`** n'a aucune couverture : le vérifier en vrai aurait marqué `manual` une paire réelle de la base de l'utilisateur, ce que la détection ne défait pas. La dialog a été ouverte et fermée sans valider.

Un harnais de test sur base jetable serait le vrai remède aux trois ; il dépasse ce lot.
