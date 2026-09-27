// @vitest-environment node
import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "./session-token";

const SECRET = "a".repeat(32);
const NOW = new Date("2026-01-01T00:00:00Z");
const nowSec = NOW.getTime() / 1000;
const payload = { sub: "user_support", iat: nowSec, exp: nowSec + 60 };

describe("session token", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken(payload, SECRET);
    expect(verifySessionToken(token, SECRET, NOW)).toEqual(payload);
  });

  it("rejects a token whose payload was edited", () => {
    const token = createSessionToken(payload, SECRET);
    const [, signature] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, sub: "user_admin" }),
    ).toString("base64url");
    expect(
      verifySessionToken(`${forged}.${signature}`, SECRET, NOW),
    ).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(payload, "b".repeat(32));
    expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = createSessionToken(payload, SECRET);
    expect(
      verifySessionToken(token, SECRET, new Date(NOW.getTime() + 60_000)),
    ).toBeNull();
  });

  it.each(["", "abc", "a.b.c", "not-base64.sig"])(
    "rejects malformed token %j",
    (token) => {
      expect(verifySessionToken(token, SECRET, NOW)).toBeNull();
    },
  );

  it("refuses short secrets", () => {
    expect(() => createSessionToken(payload, "short")).toThrow(/at least 32/);
  });
});
