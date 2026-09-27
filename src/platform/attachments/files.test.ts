import { describe, expect, it } from "vitest";

import {
  contentDisposition,
  detectContentType,
  formatFileSize,
  sanitizeFilename,
} from "./files";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) =>
      typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v],
    ),
  );

describe("detectContentType", () => {
  it("recognises supported types from their contents", () => {
    expect(detectContentType(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(
      detectContentType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0)),
    ).toBe("image/png");
    expect(detectContentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectContentType(bytes("RIFF", 0, 0, 0, 0, "WEBPVP8 "))).toBe(
      "image/webp",
    );
  });

  it("rejects anything else, whatever it is named", () => {
    expect(detectContentType(bytes("<html><script>"))).toBeNull();
    expect(detectContentType(bytes("MZ", 0x90))).toBeNull();
    expect(detectContentType(new Uint8Array())).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("drops directories and unsafe characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\id.pdf")).toBe("id.pdf");
    expect(sanitizeFilename("invoice\u202Efdp.exe")).toBe("invoicefdp.exe");
    expect(sanitizeFilename("a\nb\u0000.pdf")).toBe("ab.pdf");
  });

  it("falls back for empty names and keeps the extension when truncating", () => {
    expect(sanitizeFilename("  ")).toBe("file");
    expect(sanitizeFilename("..")).toBe("file");
    const long = sanitizeFilename(`${"x".repeat(300)}.pdf`);
    expect(long).toHaveLength(200);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("contentDisposition", () => {
  it("always downloads, with an ASCII fallback and a UTF-8 name", () => {
    expect(contentDisposition('passport "scan".pdf')).toBe(
      `attachment; filename="passport _scan_.pdf"; filename*=UTF-8''passport%20%22scan%22.pdf`,
    );
    expect(contentDisposition("pièce.pdf")).toContain(
      "filename*=UTF-8''pi%C3%A8ce.pdf",
    );
  });
});

describe("formatFileSize", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
  });
});
