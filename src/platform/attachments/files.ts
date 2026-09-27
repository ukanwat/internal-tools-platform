export const ATTACHMENT_CONTENT_TYPES = {
  "application/pdf": { label: "PDF", extensions: [".pdf"] },
  "image/png": { label: "PNG", extensions: [".png"] },
  "image/jpeg": { label: "JPEG", extensions: [".jpg", ".jpeg"] },
  "image/webp": { label: "WebP", extensions: [".webp"] },
} as const;

export type AttachmentContentType = keyof typeof ATTACHMENT_CONTENT_TYPES;

export const DEFAULT_ALLOWED_TYPES: readonly AttachmentContentType[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

/** Also the ceiling: the server action body limit in next.config.ts allows no more. */
export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function startsWith(bytes: Uint8Array, signature: readonly number[], at = 0) {
  return signature.every((byte, i) => bytes[at + i] === byte);
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** The file's type from its first bytes, or null if it is not a supported type. */
export function detectContentType(
  bytes: Uint8Array,
): AttachmentContentType | null {
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8))
    return "image/webp";
  return null;
}

const MAX_FILENAME_LENGTH = 200;
// Control characters and bidirectional overrides (used to disguise extensions).
const UNSAFE_CHARACTERS = /[\p{Cc}\u202a-\u202e\u2066-\u2069]/gu;

/** A display-safe file name: no directories, control or bidi characters. */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.toWellFormed().replace(UNSAFE_CHARACTERS, "").trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return "file";
  const chars = Array.from(cleaned);
  if (chars.length <= MAX_FILENAME_LENGTH) return cleaned;
  const dot = chars.lastIndexOf(".");
  const ext = dot > 0 && chars.length - dot <= 10 ? chars.slice(dot) : [];
  return [...chars.slice(0, MAX_FILENAME_LENGTH - ext.length), ...ext].join("");
}

/** `Content-Disposition` that always downloads, with a UTF-8 file name. */
export function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
