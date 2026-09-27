import { describe, expect, it } from "vitest";

import { formatMoney, parseAmountMinor } from "./money";

describe("parseAmountMinor", () => {
  it("parses dollar amounts into minor units", () => {
    expect(parseAmountMinor("25")).toBe(2_500);
    expect(parseAmountMinor(" $1,240.50 ")).toBe(124_050);
    expect(parseAmountMinor("0.01")).toBe(1);
  });

  it("rejects anything that isn't a positive amount with at most two decimals", () => {
    for (const input of ["", "0", "-5", "1.005", "abc", "1e3", "12.3.4"]) {
      expect(parseAmountMinor(input)).toBeNull();
    }
  });
});

describe("formatMoney", () => {
  it("formats minor units", () => {
    expect(formatMoney(62_000, "USD")).toBe("$620.00");
  });
});
