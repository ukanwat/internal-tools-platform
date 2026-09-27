"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { uploadAttachment } from "@/platform/attachments/actions";
import {
  ATTACHMENT_CONTENT_TYPES,
  formatFileSize,
  type AttachmentContentType,
} from "@/platform/attachments/files";
import type { AttachmentEntity } from "@/platform/attachments/types";

type Props = {
  entity: AttachmentEntity;
  allowedTypes: readonly AttachmentContentType[];
  maxBytes: number;
};

export function AttachmentUploadForm({
  entity,
  allowedTypes,
  maxBytes,
}: Props) {
  const [state, action, pending] = useActionState(uploadAttachment, null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    form.current?.reset();
    router.refresh();
  }, [state, router]);

  const accept = allowedTypes
    .flatMap((type) => [type, ...ATTACHMENT_CONTENT_TYPES[type].extensions])
    .join(",");
  const labels = allowedTypes
    .map((type) => ATTACHMENT_CONTENT_TYPES[type].label)
    .join(", ");

  return (
    <form ref={form} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="entityType" value={entity.type} />
      <input type="hidden" name="entityId" value={entity.id} />
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          required
          accept={accept}
          aria-label="File to upload"
          className="text-sm file:mr-2 file:rounded-md file:border file:bg-transparent file:px-2 file:py-1 file:text-sm"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        {labels}, up to {formatFileSize(maxBytes)}. Uploaded files are kept
        permanently.
      </p>
      {state && (
        <p
          role="status"
          className={
            state.ok ? "text-sm text-emerald-700" : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
