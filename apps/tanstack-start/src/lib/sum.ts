// Les sommes de l'app avaient toutes la même forme — un `reduce` avec son
// accumulateur et son `0` initial — pour dire « additionne ce champ ». Le `0`
// n'est pas décoratif : c'est lui qui fait rendre 0 sur une liste vide au lieu
// de lever, cas courant ici (une catégorie sans sous-catégorie, un mois sans
// mouvement). Il est fixé une fois plutôt que réécrit à chaque appel.
export function sumBy<T>(items: readonly T[], value: (item: T) => number) {
  return items.reduce((total, item) => total + value(item), 0);
}
