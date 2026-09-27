-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_created_at_idx" ON "attachments"("entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Attachments are records: never changed or removed.
CREATE FUNCTION attachments_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'attachments are append-only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attachments_append_only
BEFORE UPDATE OR DELETE ON "attachments"
FOR EACH ROW EXECUTE FUNCTION attachments_reject_mutation();
