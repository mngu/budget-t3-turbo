#!/usr/bin/env tsx
// CLI : lance l'analyse LLM et affiche l'arborescence de catégories proposée.
// N'applique rien en base — l'application se fait depuis l'UI
// (page /categories), qui a besoin de l'aperçu pour confirmation.
// Usage : pnpm suggest-categories
import { generateSuggestionsCore } from "../src/lib/suggest-categories-core";

// tsx ne charge pas .env tout seul (même logique que src/db/client.ts).
if (!process.env.ANTHROPIC_API_KEY) {
  try {
    process.loadEnvFile(".env");
  } catch {
    // .env absent : la variable doit venir de l'environnement
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY absente (.env).");
    process.exit(1);
  }

  console.log("🔍 Analyse des transactions en cours…");
  const { suggestions, sample } = await generateSuggestionsCore();
  console.log(
    `✅ ${suggestions.length} catégorie(s) proposée(s) à partir de ${sample.length} transactions.\n`,
  );

  for (const { parent, enfants } of suggestions) {
    console.log(`📦 ${parent}`);
    for (const enfant of enfants) {
      console.log(`   ├── ${enfant.name} (${enfant.txnIds.length} txns)`);
    }
  }
  console.log(
    "\nℹ️  Rendez-vous sur /categories dans l'app pour valider et appliquer.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
