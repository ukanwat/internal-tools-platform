import { describe, expect, it } from "vitest";

import {
  auditFiltersToQuery,
  parseAuditFilters,
  shouldHideSignIns,
} from "./filters";

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

describe("sign-in visibility", () => {
  it("hides sign-ins by default", () => {
    const filters = parseAuditFilters({});
    expect(filters.includeSignIns).toBeUndefined();
    expect(shouldHideSignIns(filters)).toBe(true);
  });

  it("shows them with signins=1 and keeps that in the query", () => {
    const filters = parseAuditFilters({ signins: "1" });
    expect(shouldHideSignIns(filters)).toBe(false);
    expect(auditFiltersToQuery(filters)).toBe("?signins=1");
  });

  it("shows them when an action is picked", () => {
    expect(
      shouldHideSignIns(parseAuditFilters({ action: "auth.sign_in" })),
    ).toBe(false);
  });
});
