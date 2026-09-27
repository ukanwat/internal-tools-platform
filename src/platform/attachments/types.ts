import type { AttachmentContentType } from "./files";

export type AttachmentEntity = { type: string; id: string };

/** What the browser gets about a stored file. */
export type AttachmentView = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: Date;
  downloadUrl: string;
};

export type AttachmentList = {
  entity: AttachmentEntity;
  canView: boolean;
  canUpload: boolean;
  allowedTypes: readonly AttachmentContentType[];
  maxBytes: number;
  attachments: AttachmentView[];
};
