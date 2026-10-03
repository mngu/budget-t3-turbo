import { modalVariants } from "@heroui/styles";
import { describe, expect, it } from "vitest";

import { cn } from "./index";

describe("cn : les crans typographiques ne sont pas des couleurs", () => {
  const CRANS = [
    "text-hero",
    "text-title",
    "text-amount",
    "text-heading",
    "text-subheading",
    "text-body",
    "text-control",
    "text-meta",
    "text-label",
  ];

  it.each(CRANS)("garde %s à côté d'une couleur", (cran) => {
    expect(cn(cran, "text-bad")).toBe(`${cran} text-bad`);
    expect(cn("text-subtle", cran)).toBe(`text-subtle ${cran}`);
  });

  it("départage deux crans entre eux, le dernier gagne", () => {
    expect(cn("text-body", "text-meta")).toBe("text-meta");
  });

  it("départage toujours deux couleurs entre elles", () => {
    expect(cn("text-subtle", "text-bad")).toBe("text-bad");
  });
});

describe("HeroUI : son tailwind-merge connaît les mêmes crans", () => {
  it("garde la couleur et le cran passés à un composant", () => {
    expect(
      modalVariants().footer({ className: "text-subtle text-meta" }),
    ).toContain("text-subtle text-meta");
  });
});
