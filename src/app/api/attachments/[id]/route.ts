import { downloadAttachment } from "@/platform/attachments/service";
import { contentDisposition } from "@/platform/attachments/files";
import { getCurrentUser } from "@/platform/auth/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await downloadAttachment(await getCurrentUser(), id);
  if (!result.ok) {
    return new Response(result.error, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return new Response(new Blob([result.bytes as Uint8Array<ArrayBuffer>]), {
    headers: {
      "Content-Type": result.contentType,
      "Content-Length": String(result.bytes.byteLength),
      "Content-Disposition": contentDisposition(result.filename),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
