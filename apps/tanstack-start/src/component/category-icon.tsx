import type { LucideIcon } from "lucide-react";
import {
  AppleIcon,
  BabyIcon,
  BanknoteIcon,
  BeefIcon,
  BikeIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CarIcon,
  CoffeeIcon,
  CroissantIcon,
  DropletsIcon,
  DumbbellIcon,
  FerrisWheelIcon,
  FilmIcon,
  FlameIcon,
  FuelIcon,
  Gamepad2Icon,
  GiftIcon,
  GraduationCapIcon,
  HammerIcon,
  HandHeartIcon,
  HeartPulseIcon,
  HouseIcon,
  IceCreamConeIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MusicIcon,
  PawPrintIcon,
  PiggyBankIcon,
  PillIcon,
  PizzaIcon,
  PlaneIcon,
  PlaneTakeoffIcon,
  ReceiptIcon,
  RoadIcon,
  ScissorsIcon,
  ShieldIcon,
  ShipIcon,
  ShirtIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SofaIcon,
  SparklesIcon,
  SproutIcon,
  SquareParkingIcon,
  TrainFrontIcon,
  TvIcon,
  UtensilsIcon,
  WalletIcon,
  WifiIcon,
  WineIcon,
  ZapIcon,
} from "lucide-react";

import { cn } from "@budget/ui";

// Résolution nom Lucide → composant. La table vit ici et non dans
// `@budget/shared`, qui ne porte que les noms et leurs mots-clés : y importer
// `lucide-react` ferait entrer la librairie dans un package dont la seule
// dépendance runtime est `zod` (voir le commentaire de shared/src/icons.ts).
//
// Table explicite plutôt qu'un `import * as lucide` indexé par nom : celui-ci
// embarquerait les ~1500 icônes de la librairie dans le bundle client.
const ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCartIcon,
  utensils: UtensilsIcon,
  croissant: CroissantIcon,
  apple: AppleIcon,
  beef: BeefIcon,
  coffee: CoffeeIcon,
  wine: WineIcon,
  "ice-cream-cone": IceCreamConeIcon,
  pizza: PizzaIcon,
  car: CarIcon,
  bus: BusIcon,
  "train-front": TrainFrontIcon,
  plane: PlaneIcon,
  fuel: FuelIcon,
  "square-parking": SquareParkingIcon,
  bike: BikeIcon,
  ship: ShipIcon,
  road: RoadIcon,
  house: HouseIcon,
  "key-round": KeyRoundIcon,
  zap: ZapIcon,
  droplets: DropletsIcon,
  flame: FlameIcon,
  wifi: WifiIcon,
  sofa: SofaIcon,
  hammer: HammerIcon,
  sprout: SproutIcon,
  "ferris-wheel": FerrisWheelIcon,
  film: FilmIcon,
  music: MusicIcon,
  "gamepad-2": Gamepad2Icon,
  dumbbell: DumbbellIcon,
  baby: BabyIcon,
  "graduation-cap": GraduationCapIcon,
  "book-open": BookOpenIcon,
  "paw-print": PawPrintIcon,
  wallet: WalletIcon,
  banknote: BanknoteIcon,
  "piggy-bank": PiggyBankIcon,
  landmark: LandmarkIcon,
  receipt: ReceiptIcon,
  shield: ShieldIcon,
  "heart-pulse": HeartPulseIcon,
  pill: PillIcon,
  "shopping-bag": ShoppingBagIcon,
  smartphone: SmartphoneIcon,
  tv: TvIcon,
  shirt: ShirtIcon,
  scissors: ScissorsIcon,
  gift: GiftIcon,
  briefcase: BriefcaseIcon,
  "plane-takeoff": PlaneTakeoffIcon,
  "hand-heart": HandHeartIcon,
  sparkles: SparklesIcon,
};

/**
 * Icône d'une catégorie parente. `name` nul (ou hors jeu, cas d'une donnée
 * héritée) rend la **pastille creuse** de la maquette : c'est l'état « aucune
 * icône choisie », où la couleur travaille seule — pas un carré vide à cacher.
 */
export function CategoryIcon({
  name,
  className,
  color,
}: {
  name: string | null;
  className?: string;
  color?: string | null;
}) {
  const Icon = name ? ICONS[name] : undefined;
  if (!Icon) {
    return (
      <span
        aria-hidden
        className={cn(
          "size-4 rounded-sm border-[1.5px] border-dashed border-current opacity-55",
          className,
        )}
      />
    );
  }
  return (
    <Icon
      className={cn(className ?? "size-4")}
      style={{ color: color ?? "#999999" }}
    />
  );
}
