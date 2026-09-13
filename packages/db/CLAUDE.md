# `@budget/db`

Base **`budget_t3`**. Les règles de migrations versionnées et l'avertissement « ne jamais confondre avec la base `budget` » restent dans le `CLAUDE.md` de la racine.

### Seed initial de la table `categories`

Une catégorie appartient à un **espace** (`organization_id NOT NULL`, `UNIQUE(organization_id, name)`) : rien ne seede les catégories à la création d'un espace, et la catégorisation LLM sans catégorie est un no-op silencieux (les transactions restent sans catégorie). Sur un clone neuf, créer d'abord un compte depuis `/login` (ce qui crée l'espace personnel), puis seeder **pour cet espace** — ou créer les catégories depuis `/settings/categories`, ce qui revient au même :

```sql
INSERT INTO categories (organization_id, name, color)
SELECT o.id, v.name, v.color
FROM organization o,
     (VALUES
       ('Revenus', '#00c65a'), ('Logement', '#1447e6'), ('Alimentation', '#b55200'),
       ('Restaurants & bars', '#007857'), ('Transport', '#0084c8'), ('Santé', '#fb64b6'),
       ('Abonnements', '#83cc00'), ('Loisirs & shopping', '#8d56ff'),
       ('Épargne', '#fb2c36'), ('Frais & impôts', '#9810fa'), ('Autres', '#94a3b8')
     ) AS v(name, color)
WHERE o.is_personal
ON CONFLICT (organization_id, name) DO NOTHING;
```

Ce seed n'est qu'un point de départ : aucun de ces noms n'est référencé par le code (le prompt de catégorisation lit la table, voir `packages/api/CLAUDE.md`). Les couleurs doivent appartenir à la palette fermée de `@budget/shared/src/colors.ts` — c'est le routeur qui la contraint, pas la base.

### Extension `pg_trgm` (catégorisation few-shot)

La recherche de transactions similaires (`categorization/similar.ts`) utilise `similarity()` sur la description, fourni par l'extension PostgreSQL `pg_trgm`. Activée automatiquement sur un volume Docker neuf via `docker-initdb/01-pg_trgm.sql` (monté dans `/docker-entrypoint-initdb.d`, ne s'exécute qu'à la création initiale du volume — voir `docker-compose.yml`).

Sur une instance déjà initialisée avant ce script (ex. le volume partagé avec `budget-tracker`), l'activer manuellement une fois (hors du schéma Drizzle, donc absente des migrations) :

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
