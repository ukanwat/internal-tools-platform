import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuditLogTable, type AuditLogRow } from "./audit-log-table";

const base: AuditLogRow = {
  id: "1",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  actor: { name: "Sam Support", email: "sam@example.com" },
  actorRole: "SUPPORT",
  action: "refunds.approve",
  outcome: "DENIED",
  entityType: "Refund",
  entityId: "rf_1",
  before: null,
  after: null,
  reason: "Role SUPPORT lacks permission refunds.approve",
};

describe("AuditLogTable", () => {
  it("renders who, what, record, outcome and why", () => {
    render(<AuditLogTable entries={[base]} />);
    expect(screen.getByText("Sam Support")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("refunds.approve")).toBeInTheDocument();
    expect(screen.getByText("Refund:rf_1")).toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
    expect(screen.getByText(base.reason!)).toBeInTheDocument();
  });

  it("shows anonymous actors and before/after values", () => {
    render(
      <AuditLogTable
        entries={[
          {
            ...base,
            actor: null,
            actorRole: null,
            outcome: "SUCCESS",
            before: { status: "PENDING" },
            after: { status: "APPROVED" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.getByText(/"PENDING"/)).toBeInTheDocument();
    expect(screen.getByText(/"APPROVED"/)).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<AuditLogTable entries={[]} />);
    expect(screen.getByText(/No audit entries/)).toBeInTheDocument();
  });
});
