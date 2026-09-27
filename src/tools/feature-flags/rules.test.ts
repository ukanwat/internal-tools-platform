import { describe, expect, it } from "vitest";

import { hasPermission } from "@/platform/permissions/policy";

import {
  classifyFlagChange,
  flagChangePermission,
  parseRolloutPercent,
} from "./rules";

const off = (rolloutPercent = 0) => ({ enabled: false, rolloutPercent });
const on = (rolloutPercent: number) => ({ enabled: true, rolloutPercent });

describe("classifyFlagChange", () => {
  it.each([
    ["turn on", off(), on(100)],
    ["raise rollout", on(10), on(50)],
    ["turn off", on(50), off(50)],
  ])("applies any staging change straight away: %s", (_, from, to) => {
    expect(classifyFlagChange("STAGING", from, to)).toBe("apply");
  });

  it.each([
    ["turning on", off(10), on(10)],
    ["turning on at a lower rollout", off(50), on(10)],
    ["raising the rollout", on(10), on(25)],
    ["raising the rollout while off", off(0), off(50)],
  ])("needs approval in production for %s", (_, from, to) => {
    expect(classifyFlagChange("PRODUCTION", from, to)).toBe("approval");
  });

  it.each([
    ["turning off", on(50), off(50)],
    ["turning off and resetting the rollout", on(50), off(0)],
    ["lowering the rollout", on(50), on(5)],
  ])("applies %s in production straight away", (_, from, to) => {
    expect(classifyFlagChange("PRODUCTION", from, to)).toBe("apply");
  });

  it("reports no-op changes", () => {
    expect(classifyFlagChange("PRODUCTION", on(10), on(10))).toBe("unchanged");
  });
});

describe("flagChangePermission", () => {
  it("maps each kind of change to its permission", () => {
    expect(flagChangePermission("STAGING", "apply")).toBe(
      "flags.change_staging",
    );
    expect(flagChangePermission("PRODUCTION", "apply")).toBe(
      "flags.reduce_production",
    );
    expect(flagChangePermission("PRODUCTION", "approval")).toBe(
      "flags.request_production",
    );
  });

  it("lets engineers use the kill switch but only eng managers approve", () => {
    expect(hasPermission("ENGINEER", "flags.reduce_production")).toBe(true);
    expect(hasPermission("ENGINEER", "flags.approve_production")).toBe(false);
    expect(hasPermission("ENG_MANAGER", "flags.approve_production")).toBe(true);
    expect(hasPermission("SUPPORT", "flags.view")).toBe(false);
  });
});

describe("parseRolloutPercent", () => {
  it.each([
    ["0", 0],
    ["100", 100],
    [" 25 ", 25],
    ["101", null],
    ["-1", null],
    ["2.5", null],
    ["", null],
    [null, null],
  ])("parses %j", (input, expected) => {
    expect(parseRolloutPercent(input)).toBe(expected);
  });
});
