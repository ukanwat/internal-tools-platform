import "server-only";

import { listAttachments } from "@/platform/attachments/service";
import { formatFileSize } from "@/platform/attachments/files";
import type { AttachmentEntity } from "@/platform/attachments/types";
import type { CurrentUser } from "@/platform/auth/types";

import { AttachmentUploadForm } from "./attachment-upload-form";
import { DataTable } from "./data-table";
import { formatTimestamp } from "./format";

type Props = { viewer: CurrentUser; entity: AttachmentEntity };

/**
 * A record's files and, if the tool's policy allows, an upload form.
 * Renders nothing for viewers who may neither see nor add files.
 */
export async function Attachments({ viewer, entity }: Props) {
  const list = await listAttachments(viewer, entity);
  if (!list.canView && !list.canUpload) return null;

  return (
    <section className="flex flex-col gap-3">
      {list.canView && (
        <DataTable
          rows={list.attachments}
          rowKey={(file) => file.id}
          empty="No files yet."
          columns={[
            {
              header: "File",
              cell: (file) => (
                <a
                  href={file.downloadUrl}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {file.filename}
                </a>
              ),
            },
            { header: "Size", cell: (file) => formatFileSize(file.sizeBytes) },
            { header: "Uploaded by", cell: (file) => file.uploadedBy },
            {
              header: "Uploaded",
              cell: (file) => formatTimestamp(file.createdAt),
              className: "text-muted-foreground text-xs",
            },
          ]}
        />
      )}
      {list.canUpload && (
        <AttachmentUploadForm
          entity={entity}
          allowedTypes={list.allowedTypes}
          maxBytes={list.maxBytes}
        />
      )}
    </section>
  );
}
