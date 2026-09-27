import { describe, expect, it } from "vitest";

import { auditFiltersToQuery, parseAuditFilters } from "./filters";

describe("audit filters", () => {
  it("parses valid params", () => {
    expect(
      parseAuditFilters({
        actor: "user_admin",
        action: "auth.sign_in",
        outcome: "DENIED",
        page: "2",
      }),
    ).toEqual({
      actorId: "user_admin",
      action: "auth.sign_in",
      outcome: "DENIED",
      page: 2,
    });
  });

  it("drops empty and invalid values", () => {
    expect(
      parseAuditFilters({ actor: "", outcome: "MAYBE", page: "-3" }),
    ).toEqual({
      actorId: undefined,
      action: undefined,
      outcome: undefined,
      page: 1,
    });
  });

  it("round-trips to a query string", () => {
    const filters = {
      actorId: "user_admin",
      outcome: "SUCCESS" as const,
      page: 3,
    };
    expect(auditFiltersToQuery(filters)).toBe(
      "?actor=user_admin&outcome=SUCCESS&page=3",
    );
    expect(auditFiltersToQuery({ page: 1 })).toBe("");
  });
});

describe("audit filters with inherited property names", () => {
  it.each(["toString", "constructor", "__proto__"])(
    "drops outcome=%s",
    (outcome) => {
      expect(parseAuditFilters({ outcome }).outcome).toBeUndefined();
    },
  );
});
