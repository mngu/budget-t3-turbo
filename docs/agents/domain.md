# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** One `CONTEXT.md` + `docs/adr/` at the repo root. The repo is a pnpm/Turborepo monorepo, but the packages are _layers_ of one domain (personal finance for one household), not separate bounded contexts: `@budget/db` holds the schema, `@budget/api` the business pipeline, `apps/tanstack-start` the screens — all speaking of the same transactions, catégories, espaces and budgets. Splitting them into per-package contexts would duplicate one glossary five times. Revisit only if a package starts owning vocabulary the others don't share.

## Before exploring, read these

- **`CLAUDE.md`** at the repo root — the standing architecture and decision record for this project, and by far the densest source. Read it first; much of what an ADR would say already lives there.
- **`CONTEXT.md`** at the repo root, if it exists — the glossary.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- **`docs/superpowers/specs/`** — long-form design specs and Claude Design briefs, dated in their filenames. Not decisions in the ADR sense, but they carry the _why_ behind the screens.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CLAUDE.md                     ← architecture + decisions (already large)
├── CONTEXT.md                    ← glossary (created lazily)
├── docs/
│   ├── adr/                      ← 0001-….md (created lazily)
│   └── superpowers/specs/        ← design specs and briefs
├── packages/{api,auth,db,shared,ui}/src/
└── apps/{tanstack-start,expo}/src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

This project's vocabulary is **French** and the distinctions are load-bearing — « à classer » is not « sans catégorie », un « espace » is a better-auth organization, un « poste » is what `budgetSlots` defines. `CLAUDE.md` is the current authority on these; several of its paragraphs exist precisely because a synonym crept in once.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR — or a rule stated in `CLAUDE.md` — surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
