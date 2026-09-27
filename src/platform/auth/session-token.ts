import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionPayload = {
  /** User id. */
  sub: string;
  /** Issued at, seconds since epoch. */
  iat: number;
  /** Expires at, seconds since epoch. */
  exp: number;
};

const MIN_SECRET_LENGTH = 32;

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function assertSecret(secret: string) {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
}

/** Encodes `payload` as `<base64url json>.<base64url hmac-sha256>`. */
export function createSessionToken(
  payload: SessionPayload,
  secret: string,
): string {
  assertSecret(secret);
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Returns the payload only if the signature is valid and it has not expired. */
export function verifySessionToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): SessionPayload | null {
  assertSecret(secret);
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isSessionPayload(payload)) return null;
  if (payload.exp <= Math.floor(now.getTime() / 1000)) return null;
  return payload;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const { sub, iat, exp } = value as Record<string, unknown>;
  return (
    typeof sub === "string" &&
    sub.length > 0 &&
    typeof iat === "number" &&
    typeof exp === "number"
  );
}
