// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

/** Actions that create or end the session and so cannot require a permission. */
const SESSION_ACTIONS = new Set(["platform/auth/actions.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "generated") return [];
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("server actions", () => {
  it("every exported server action calls requirePermission", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use server["']/.test(source) || SESSION_ACTIONS.has(rel)) {
        continue;
      }
      const bodies = source.split(/export\s+async\s+function\s+/).slice(1);
      bodies.forEach((body) => {
        if (!body.includes("requirePermission(")) {
          offenders.push(`${rel}: ${body.slice(0, body.indexOf("("))}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
