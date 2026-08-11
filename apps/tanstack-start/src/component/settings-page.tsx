import type { ReactNode } from "react";

import type { HeaderPage } from "./app-header";
import { AppHeader } from "./app-header";

/**
 * Le gabarit des écrans de réglages — `/categories`, `/budgets`, `/banques`,
 * `/espaces` et `/banques/ajouter` en avaient chacun une copie identique.
 *
 * Ce qu'il porte tient en une phrase : la barre d'application, une seule zone
 * de défilement, et un contenu centré à **1000 px** (250 u, §1.6). Cette
 * largeur est une valeur du système et non une préférence d'écran ; à cinq
 * exemplaires, elle n'avait aucun endroit où être corrigée une seule fois.
 *
 * Il s'arrête là. Le corps de chaque page reste chez elle : c'est la frontière
 * de l'ADR-0001, où la *mise en page* appartient à l'écran — mais un cadre de
 * page recopié cinq fois n'est plus la mise en page d'un écran, c'est celle de
 * l'application. La revue (`_revue.tsx`) ne l'emploie pas : elle n'a ni
 * contenu borné ni titre, son écran occupe la fenêtre entière.
 */
export function SettingsPage({
  page,
  title,
  aside,
  children,
}: {
  page: HeaderPage;
  title: ReactNode;
  /**
   * Ce qui accompagne le titre dans sa rangée — compteurs, actions. Posé tel
   * quel, sans conteneur : les écrans ne le cadrent pas de la même façon (une
   * rangée de compteurs se colle par `items-stretch`, une paire de boutons par
   * `items-center gap-4`), et un conteneur imposé ici demanderait une variante
   * par écran pour rien.
   */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader page={page} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-250 px-6 pt-5 pb-12">
          {/* La rangée garde sa hauteur même sans contenu à droite : c'est elle
              qui aligne le titre d'un écran de réglages à l'autre. */}
          <div className="flex min-h-9.5 flex-wrap items-center gap-6">
            <h1 className="text-title">{title}</h1>
            {aside}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
