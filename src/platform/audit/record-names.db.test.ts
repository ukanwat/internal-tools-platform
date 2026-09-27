import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { recordKey, resolveRecordNames } from "./record-names";

setupTestDatabase();

describe("resolveRecordNames", () => {
  it("names users and leaves unknown records out", async () => {
    const admin = seedUser("ADMIN");
    const names = await resolveRecordNames([
      { entityType: "User", entityId: admin.id },
      { entityType: "Refund", entityId: "rf_1" },
      { entityType: null, entityId: null },
    ]);
    expect(names).toEqual({ [recordKey("User", admin.id)]: "Ada Admin" });
  });
});
