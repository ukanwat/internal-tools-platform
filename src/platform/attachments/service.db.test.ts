import { describe, expect, it } from "vitest";

import { seedUser, setupTestDatabase } from "../../../test/db";

import { db } from "@/platform/db";
import { createMemoryFileStorage } from "@/platform/integrations/storage";

import { createAttachmentPolicyRegistry } from "./policies";
import {
  downloadAttachment,
  listAttachments,
  uploadAttachment,
} from "./service";

setupTestDatabase();

const support = seedUser("SUPPORT");
const reviewer = seedUser("COMPLIANCE_REVIEWER");
const lead = seedUser("COMPLIANCE_LEAD");

const PDF = new TextEncoder().encode("%PDF-1.7 passport scan");
const kyc = { type: "KycCase", id: "kyc_1" };
const leadOnly = { type: "KycCase", id: "kyc_lead_only" };
const closed = { type: "KycCase", id: "kyc_closed" };

const policies = createAttachmentPolicyRegistry([
  {
    entityType: "KycCase",
    viewPermission: "kyc.view",
    uploadPermission: "kyc.review",
    canView: async (id, actor) => id !== leadOnly.id || actor.id === lead.id,
    canUpload: async (id, actor) =>
      id !== closed.id && (id !== leadOnly.id || actor.id === lead.id),
    maxBytes: 64,
  },
]);

function setup() {
  return { policies, storage: createMemoryFileStorage() };
}

async function uploadOk(deps: ReturnType<typeof setup>, entity = kyc) {
  const result = await uploadAttachment(
    entity.id === leadOnly.id ? lead : reviewer,
    { entity, file: { name: "passport.pdf", bytes: PDF } },
    deps,
  );
  if (!result.ok) throw new Error(result.error);
  return result.attachment;
}

const auditFor = (action: string) =>
  db.auditLog.findMany({ where: { action }, orderBy: { createdAt: "asc" } });

describe("uploadAttachment", () => {
  it("stores the file and logs the upload on the record", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps);
    expect(attachment).toMatchObject({
      filename: "passport.pdf",
      contentType: "application/pdf",
      sizeBytes: PDF.byteLength,
      uploadedBy: reviewer.name,
      downloadUrl: `/api/attachments/${attachment.id}`,
    });
    const row = await db.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    expect(await deps.storage.get(row.storageKey)).toEqual(PDF);

    const [entry] = await auditFor("attachments.upload");
    expect(entry).toMatchObject({
      actorId: reviewer.id,
      outcome: "SUCCESS",
      entityType: "KycCase",
      entityId: "kyc_1",
      after: {
        attachmentId: attachment.id,
        filename: "passport.pdf",
        sha256: row.sha256,
      },
    });
  });

  it("blocks and logs a role without the upload permission", async () => {
    const deps = setup();
    const result = await uploadAttachment(
      support,
      { entity: kyc, file: { name: "a.pdf", bytes: PDF } },
      deps,
    );
    expect(result).toEqual({
      ok: false,
      error: "You cannot upload files here",
    });
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: support.id } }),
    ).toMatchObject({ action: "kyc.review", outcome: "DENIED" });
    expect(await db.attachment.count()).toBe(0);
  });

  it("lets the tool's policy refuse uploads on a record, and logs it", async () => {
    const deps = setup();
    for (const [actor, entity] of [
      [reviewer, closed],
      [reviewer, leadOnly],
    ] as const) {
      const result = await uploadAttachment(
        actor,
        { entity, file: { name: "a.pdf", bytes: PDF } },
        deps,
      );
      expect(result.ok).toBe(false);
    }
    expect(await auditFor("attachments.upload")).toMatchObject([
      { outcome: "DENIED", entityId: closed.id },
      { outcome: "DENIED", entityId: leadOnly.id },
    ]);
    expect(await db.attachment.count()).toBe(0);
  });

  it("checks the file's contents and size, not its name", async () => {
    const deps = setup();
    const upload = (name: string, bytes: Uint8Array) =>
      uploadAttachment(reviewer, { entity: kyc, file: { name, bytes } }, deps);
    expect(
      await upload("id.pdf", new TextEncoder().encode("<script>")),
    ).toEqual({ ok: false, error: "Allowed file types: PDF, PNG, JPEG" });
    expect(await upload("id.pdf", new Uint8Array())).toEqual({
      ok: false,
      error: "The file is empty",
    });
    expect(await upload("id.pdf", new Uint8Array(65).fill(0x25))).toMatchObject(
      { ok: false, error: "Files must be 64 B or smaller" },
    );
    expect(await db.attachment.count()).toBe(0);
    expect(await auditFor("attachments.upload")).toEqual([]);
  });

  it("rejects record types without a policy", async () => {
    const result = await uploadAttachment(
      reviewer,
      {
        entity: { type: "Other", id: "x" },
        file: { name: "a.pdf", bytes: PDF },
      },
      setup(),
    );
    expect(result).toEqual({
      ok: false,
      error: "Files are not enabled for Other",
    });
  });

  it("sanitizes the stored file name", async () => {
    const result = await uploadAttachment(
      reviewer,
      { entity: kyc, file: { name: "../../x\u202Efdp.pdf", bytes: PDF } },
      setup(),
    );
    expect(result).toMatchObject({
      ok: true,
      attachment: { filename: "xfdp.pdf" },
    });
  });
});

describe("downloadAttachment", () => {
  it("returns the bytes and logs who downloaded which file", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps);
    expect(await downloadAttachment(support, attachment.id, deps)).toEqual({
      ok: true,
      filename: "passport.pdf",
      contentType: "application/pdf",
      bytes: PDF,
    });
    const [entry] = await auditFor("attachments.download");
    expect(entry).toMatchObject({
      actorId: support.id,
      outcome: "SUCCESS",
      entityType: "KycCase",
      entityId: "kyc_1",
      after: { attachmentId: attachment.id, filename: "passport.pdf" },
    });
  });

  it("blocks and logs a role without the view permission", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps);
    const finance = seedUser("FINANCE_APPROVER");
    expect(
      await downloadAttachment(finance, attachment.id, deps),
    ).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(
      await db.auditLog.findFirstOrThrow({ where: { actorId: finance.id } }),
    ).toMatchObject({
      action: "kyc.view",
      outcome: "DENIED",
      entityId: "kyc_1",
    });
    expect(
      await db.auditLog.count({
        where: { action: "attachments.download", outcome: "SUCCESS" },
      }),
    ).toBe(0);
  });

  it("enforces the tool's record-level policy and logs the denial", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps, leadOnly);
    expect(
      await downloadAttachment(reviewer, attachment.id, deps),
    ).toMatchObject({ ok: false, status: 403 });
    expect(await downloadAttachment(lead, attachment.id, deps)).toMatchObject({
      ok: true,
    });
    expect(await auditFor("attachments.download")).toMatchObject([
      { actorId: reviewer.id, outcome: "DENIED", entityId: leadOnly.id },
      { actorId: lead.id, outcome: "SUCCESS", entityId: leadOnly.id },
    ]);
  });

  it("logs anonymous attempts and refuses them", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps);
    expect(await downloadAttachment(null, attachment.id, deps)).toMatchObject({
      ok: false,
      status: 401,
    });
    expect(await auditFor("attachments.download")).toMatchObject([
      { actorId: null, outcome: "DENIED", entityId: "kyc_1" },
    ]);
  });

  it("returns 404 for unknown files", async () => {
    expect(await downloadAttachment(reviewer, "nope", setup())).toMatchObject({
      ok: false,
      status: 404,
    });
  });

  it("refuses to serve a stored file that no longer matches its checksum", async () => {
    const deps = setup();
    const attachment = await uploadOk(deps);
    const other = { ...deps, storage: createMemoryFileStorage() };
    const row = await db.attachment.findUniqueOrThrow({
      where: { id: attachment.id },
    });
    await other.storage.put(row.storageKey, new TextEncoder().encode("%PDF-x"));
    expect(
      await downloadAttachment(reviewer, attachment.id, other),
    ).toMatchObject({ ok: false, status: 500 });
    expect(await auditFor("attachments.download")).toMatchObject([
      { outcome: "FAILURE", reason: "Stored file does not match its checksum" },
    ]);
  });
});

describe("listAttachments", () => {
  it("lists files only for viewers the role and policy allow", async () => {
    const deps = setup();
    await uploadOk(deps);
    await uploadOk(deps, leadOnly);

    expect(await listAttachments(support, kyc, deps)).toMatchObject({
      canView: true,
      canUpload: false,
      attachments: [{ filename: "passport.pdf" }],
    });
    expect(await listAttachments(reviewer, leadOnly, deps)).toMatchObject({
      canView: false,
      canUpload: false,
      attachments: [],
    });
    expect(
      await listAttachments(seedUser("FINANCE_APPROVER"), kyc, deps),
    ).toMatchObject({ canView: false, attachments: [] });
    expect(await listAttachments(lead, leadOnly, deps)).toMatchObject({
      canView: true,
      canUpload: true,
      allowedTypes: ["application/pdf", "image/png", "image/jpeg"],
      maxBytes: 64,
    });
  });
});

describe("attachments table", () => {
  it("rejects updates and deletes", async () => {
    const attachment = await uploadOk(setup());
    await expect(
      db.attachment.delete({ where: { id: attachment.id } }),
    ).rejects.toThrow(/append-only/);
    await expect(
      db.attachment.update({
        where: { id: attachment.id },
        data: { filename: "renamed.pdf" },
      }),
    ).rejects.toThrow(/append-only/);
    await expect(db.attachment.deleteMany()).rejects.toThrow(/append-only/);
    expect(await db.attachment.count()).toBe(1);
  });
});
