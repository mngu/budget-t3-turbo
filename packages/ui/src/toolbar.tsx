"use client";

/**
 * Réexport brut, sans style : `Toolbar` n'apporte pas un dessin mais un
 * **comportement** — le parcours au clavier d'un groupe de contrôles (une seule
 * tabulation pour entrer, les flèches pour circuler, `focusableWhenDisabled`
 * pour que les lignes en lecture seule restent atteignables). Chaque appelant
 * garde donc ses classes.
 *
 * Le fichier existe pour que les apps continuent de n'importer que `@budget/ui`
 * — aucune ne dépend de `@base-ui/react` directement, et ce n'est pas un hasard.
 */
export { Toolbar } from "@base-ui/react/toolbar";
