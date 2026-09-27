import { ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { settleApprovals } from "@/platform/approvals";
import { ApprovalStatusBadge } from "@/platform/approvals/components/approval-status-badge";
import { requirePermission } from "@/platform/permissions/guard";
import { SensitiveValue } from "@/platform/sensitive/components/sensitive-value";
import { Attachments } from "@/platform/ui/attachments";
import { DataTable, LocalTime, PageBody, PageHeader } from "@/platform/ui";
import { RecordHistory } from "@/platform/ui/record-history";
import { kycEntity } from "@/tools/kyc/cases";
import {
  KycOutcomeBadge,
  KycRiskBadge,
  KycStatusBadge,
} from "@/tools/kyc/components/badges";
import { KycDecisionButtons } from "@/tools/kyc/components/decision-buttons";
import { getKycCaseDetail } from "@/tools/kyc/service";

export const metadata: Metadata = { title: "KYC case" };

export default async function KycCasePage({ params }: PageProps<"/kyc/[id]">) {
  const { id } = await params;
  const entity = kycEntity(id);
  const viewer = await requirePermission("kyc.view", entity);
  await settleApprovals();
  const detail = await getKycCaseDetail(viewer, id);
  if (!detail) notFound();
  const { case: kycCase, check } = detail;

  return (
    <PageBody>
      <PageHeader
        title={kycCase.customerName}
        description={
          <Link href="/kyc" className="underline-offset-4 hover:underline">
            Back to the review queue
          </Link>
        }
        actions={
          detail.canDecide && (
            <KycDecisionButtons
              caseId={kycCase.id}
              customerName={kycCase.customerName}
              leadApprovalRequired={detail.leadApprovalRequired}
            />
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Case</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
              <Row label="Status">
                <KycStatusBadge
                  status={kycCase.status}
                  awaitingLeadApproval={detail.awaitingLeadApproval}
                />
              </Row>
              <Row label="Risk">
                <KycRiskBadge risk={kycCase.riskLevel} />
              </Row>
              <Row label="Email">{kycCase.customerEmail}</Row>
              <Row label="Country">{kycCase.country}</Row>
              <Row label="Opened">
                <LocalTime date={kycCase.createdAt} />
              </Row>
              {kycCase.reviewedBy && (
                <Row label="Reviewed by">{kycCase.reviewedBy.name}</Row>
              )}
              {kycCase.decidedBy && kycCase.decidedAt && (
                <Row label="Decided by">
                  {kycCase.decidedBy.name} ·{" "}
                  <LocalTime date={kycCase.decidedAt} />
                </Row>
              )}
              {kycCase.decisionReason && (
                <Row label="Reason">
                  <span className="whitespace-pre-wrap">
                    {kycCase.decisionReason}
                  </span>
                </Row>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ID document</CardTitle>
            <CardDescription>
              Documents stay with the KYC vendor. Check {kycCase.vendorCheckId}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {check ? (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
                <Row label="Type">{check.documentType}</Row>
                <Row label="Issued by">{check.issuingCountry}</Row>
                <Row label="ID number">
                  <SensitiveValue view={detail.idNumber} />
                </Row>
                <Row label="Expires">{check.expiresOn}</Row>
                <Row label="Documents">
                  <a
                    href={check.documentsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    Open in KYC vendor
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                </Row>
              </dl>
            ) : (
              <p role="alert" className="text-destructive text-sm">
                {detail.vendorUnavailable
                  ? "The KYC vendor is unavailable. Try again later."
                  : "The KYC vendor has no check with this reference."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {check && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Check results</h2>
          <p className="text-muted-foreground text-sm">
            Completed <LocalTime date={check.completedAt} />
          </p>
          <DataTable
            rows={check.results}
            rowKey={(r) => r.key}
            empty="The vendor returned no results."
            columns={[
              { header: "Check", cell: (r) => r.label },
              {
                header: "Outcome",
                cell: (r) => <KycOutcomeBadge outcome={r.outcome} />,
              },
              {
                header: "Detail",
                cell: (r) => r.detail,
                className: "whitespace-normal",
              },
            ]}
          />
        </section>
      )}

      {detail.approvals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Compliance lead approval</h2>
          <DataTable
            rows={detail.approvals}
            rowKey={(a) => a.id}
            empty=""
            columns={[
              { header: "Request", cell: (a) => a.summary },
              {
                header: "Status",
                cell: (a) => <ApprovalStatusBadge status={a.status} />,
              },
              {
                header: "Reviewer",
                cell: (a) => (
                  <div className="flex flex-col gap-1">
                    <span>{a.requestedBy.name}</span>
                    <span className="text-muted-foreground whitespace-pre-wrap">
                      {a.requestReason}
                    </span>
                  </div>
                ),
                className: "whitespace-normal",
              },
              {
                header: "Lead",
                cell: (a) =>
                  a.decidedBy ? (
                    <div className="flex flex-col gap-1">
                      <span>{a.decidedBy.name}</span>
                      <span className="text-muted-foreground whitespace-pre-wrap">
                        {a.decisionReason}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href="/approvals"
                      className="underline-offset-4 hover:underline"
                    >
                      Waiting in approvals
                    </Link>
                  ),
                className: "whitespace-normal",
              },
            ]}
          />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Supporting documents</h2>
        <p className="text-muted-foreground text-sm">
          For example proof of source of funds. Files can be added while the
          case is open.
        </p>
        <Attachments viewer={viewer} entity={entity} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        <RecordHistory
          viewer={viewer}
          entityType={entity.type}
          entityId={entity.id}
        />
      </section>
    </PageBody>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}
