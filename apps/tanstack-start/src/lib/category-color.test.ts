import { describe, expect, it } from "vitest";

import { shadeHex } from "./category-color";

describe("shadeHex", () => {
  it("rend le premier palier tel quel, hex compris", () => {
    expect(shadeHex("#fb2c36", "#ffffff", 0, 3)).toBe("#fb2c36");
    expect(shadeHex("#9810fa", "#22252b", 0, 1)).toBe("#9810fa");
  });

  it("rapproche les paliers suivants de la carte", () => {
    const [a, b, c] = [0, 1, 2].map((i) => shadeHex("#1447e6", "#ffffff", i, 3));
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(shadeHex("#1447e6", "#ffffff", 2, 3)).toBe(
      shadeHex("#1447e6", "#ffffff", 1, 2),
    );
  });
});
