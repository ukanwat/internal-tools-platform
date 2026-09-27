import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SensitiveView } from "../types";

vi.mock("../actions", () => ({ revealSensitiveField: vi.fn() }));

const { SensitiveValue } = await import("./sensitive-value");

const view: SensitiveView = {
  field: "accountNumber",
  label: "Account number",
  entity: { type: "Customer", id: "cus_1" },
  masked: "••••6819",
  canReveal: true,
};

describe("SensitiveValue", () => {
  it("shows only the mask to roles that cannot reveal", () => {
    render(<SensitiveValue view={{ ...view, canReveal: false }} />);
    expect(screen.getByText("••••6819")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reveal" }),
    ).not.toBeInTheDocument();
  });

  it("asks for a reason before revealing", () => {
    render(<SensitiveValue view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(
      screen.getByLabelText("Reason for viewing account number"),
    ).toBeRequired();
    expect(screen.getByRole("button", { name: "Show" })).toBeInTheDocument();
  });
});
