import { describe, expect, it } from "vitest";
import { PRICING, SIZE_OPTIONS, BASE_OPTIONS } from "./config";
import { computeLampPrice } from "./pricing";

describe("computeLampPrice", () => {
  it("matches the given pricing table for every size x base combo at qty=1", () => {
    for (const sizeId of Object.keys(SIZE_OPTIONS) as (keyof typeof SIZE_OPTIONS)[]) {
      for (const baseOption of Object.keys(BASE_OPTIONS) as (keyof typeof BASE_OPTIONS)[]) {
        expect(computeLampPrice(PRICING, sizeId, baseOption, 1)).toBe(PRICING[sizeId][baseOption]);
      }
    }
  });

  it("scales linearly with quantity", () => {
    expect(computeLampPrice(PRICING, "100x150", "none", 3)).toBe(PRICING["100x150"].none * 3);
  });

  it("clamps qty below 1 to 1", () => {
    expect(computeLampPrice(PRICING, "100x150", "none", 0)).toBe(PRICING["100x150"].none);
  });
});
