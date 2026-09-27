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
  it("renders who, what, record, outcome and why in plain English", () => {
    render(<AuditLogTable entries={[base]} />);
    expect(screen.getByText("Sam Support")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
    expect(screen.getByText("Approve a refund")).toBeInTheDocument();
    expect(screen.getByText("rf_1")).toBeInTheDocument();
    expect(screen.getByText("Refund")).toBeInTheDocument();
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

  it("shows record names instead of IDs when known", () => {
    render(
      <AuditLogTable
        entries={[
          {
            ...base,
            action: "approvals.approve",
            entityType: "ApprovalRequest",
            entityId: "req_1",
          },
        ]}
        recordNames={{ "ApprovalRequest:req_1": "Refund £20 to Jane" }}
      />,
    );
    expect(screen.getByText("Approved a request")).toBeInTheDocument();
    expect(screen.getByText("Refund £20 to Jane")).toBeInTheDocument();
    expect(screen.getByText("Approval request")).toBeInTheDocument();
    expect(screen.queryByText("req_1")).not.toBeInTheDocument();
  });

  it("shows an empty state", () => {
    render(<AuditLogTable entries={[]} />);
    expect(screen.getByText(/No audit entries/)).toBeInTheDocument();
  });
});
