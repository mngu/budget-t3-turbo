#!/usr/bin/env tsx
// CLI : synchronisation complète (Enable Banking → import → catégorisation).
// L'autorisation des banques se fait désormais dans l'app (page /banques).
import { performSync } from "../src/lib/sync-core";

performSync()
  .then(({ expired, rateLimited }) => {
    if (expired.length > 0) {
      console.log(`\nℹ️  ${expired.length} banque(s) à renouveler : ${expired.join(", ")}`);
      console.log("   Rendez-vous sur la page Banques de l'app pour ré-autoriser.");
    }
    if (rateLimited.length > 0) {
      console.log(
        `\nℹ️  Limite d'accès bancaire atteinte pour : ${rateLimited.join(", ")} — réessayez dans ~6 h.`,
      );
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
