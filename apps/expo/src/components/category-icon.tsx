import type { LucideIcon } from "lucide-react-native";

import * as icons from "lucide-react-native/icons";

// categories.icon stores Lucide's kebab-case name, as on the web.
const toPascal = (name: string) =>
  name.replace(/(^|-)(\w)/g, (_, __, c: string) => c.toUpperCase());

export function CategoryIcon({
  name,
  color,
}: {
  name: string | null;
  color: string;
}) {
  const Icon =
    (name && (icons as Record<string, LucideIcon>)[toPascal(name)]) ||
    icons.Tag;
  return <Icon size={18} color={color} />;
}
