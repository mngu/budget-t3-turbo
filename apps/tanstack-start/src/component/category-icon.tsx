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

// Keep shared metadata dependency-free and import icons explicitly for tree shaking.
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
