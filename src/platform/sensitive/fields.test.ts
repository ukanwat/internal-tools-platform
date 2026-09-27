import { describe, expect, it } from "vitest";

import { isSensitiveField, maskValue, redactSensitive } from "./fields";

describe("maskValue", () => {
  it("keeps the last four characters of long values", () => {
    expect(maskValue("GB29NWBK60161331926819")).toBe("••••6819");
  });

  it("fully masks short values", () => {
    expect(maskValue("12345678")).toBe("••••");
  });
});

describe("isSensitiveField", () => {
  it("only matches registered own keys", () => {
    expect(isSensitiveField("accountNumber")).toBe(true);
    expect(isSensitiveField("toString")).toBe(false);
    expect(isSensitiveField("name")).toBe(false);
  });
});

describe("redactSensitive", () => {
  it("masks sensitive properties at any depth and leaves the rest", () => {
    expect(
      redactSensitive({
        name: "Jo",
        accountNumber: "GB29NWBK60161331926819",
        customer: {
          idNumber: "AB123456789C",
          documents: [{ idNumber: "X99999999" }],
        },
        missing: { accountNumber: null },
      }),
    ).toEqual({
      name: "Jo",
      accountNumber: "••••6819",
      customer: { idNumber: "••••789C", documents: [{ idNumber: "••••9999" }] },
      missing: { accountNumber: null },
    });
  });

  it("does not mutate its input", () => {
    const input = { accountNumber: "GB29NWBK60161331926819" };
    redactSensitive(input);
    expect(input.accountNumber).toBe("GB29NWBK60161331926819");
  });
});
