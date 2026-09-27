import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/platform/attachments/actions", () => ({
  uploadAttachment: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { AttachmentUploadForm } = await import("./attachment-upload-form");

describe("AttachmentUploadForm", () => {
  it("limits the picker to the allowed types and states the limits", () => {
    const { container } = render(
      <AttachmentUploadForm
        entity={{ type: "KycCase", id: "kyc_1" }}
        allowedTypes={["application/pdf", "image/png"]}
        maxBytes={5 * 1024 * 1024}
      />,
    );
    expect(screen.getByLabelText("File to upload")).toHaveAttribute(
      "accept",
      "application/pdf,.pdf,image/png,.png",
    );
    expect(screen.getByText(/PDF, PNG, up to 5.0 MB/)).toBeInTheDocument();
    expect(container.querySelector('input[name="entityId"]')).toHaveValue(
      "kyc_1",
    );
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });
});
