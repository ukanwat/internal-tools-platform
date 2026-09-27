import { ArrowRightIcon, CircleCheckIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approvalRegistry,
  countApprovals,
  listApprovals,
} from "@/platform/approvals";
import { ApprovalStatusBadge } from "@/platform/approvals/components/approval-status-badge";
import { requireUser } from "@/platform/auth";
import { hasPermission, ROLE_LABELS } from "@/platform/permissions";
import { TOOLS } from "@/platform/tools";
import { PageBody, PageHeader } from "@/platform/ui";
import { TOOL_ICONS } from "@/platform/ui/app-shell";
import { LocalTime } from "@/platform/ui/local-time";

const PREVIEW = 5;

export default async function Home() {
  const user = await requireUser();
  const [{ requests: waiting, counts }, mineOpen] = await Promise.all([
    listApprovals(user, "waiting", approvalRegistry),
    countApprovals(user, "mine"),
  ]);
  const tools = TOOLS.filter(
    (tool) => !tool.permission || hasPermission(user.role, tool.permission),
  );

  return (
    <PageBody>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`Signed in as ${ROLE_LABELS[user.role]}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Waiting for you</CardTitle>
          <CardDescription>
            {counts.waiting === 0
              ? "You're all caught up."
              : `${counts.waiting} ${counts.waiting === 1 ? "request needs" : "requests need"} your decision.`}
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/approvals?tab=waiting" />}
            >
              Open approvals
              <ArrowRightIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {waiting.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CircleCheckIcon className="text-primary size-4" />
              Nothing needs your sign-off.
              {mineOpen > 0 &&
                ` You have ${mineOpen} ${mineOpen === 1 ? "request" : "requests"} of your own.`}
            </div>
          ) : (
            <ul className="divide-y">
              {waiting.slice(0, PREVIEW).map((request) => (
                <li key={request.id}>
                  <Link
                    href="/approvals?tab=waiting"
                    className="hover:bg-muted/50 -mx-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {request.summary}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {request.typeLabel} · from {request.requestedBy.name} ·{" "}
                        <LocalTime date={request.createdAt} />
                      </span>
                    </div>
                    <ApprovalStatusBadge status={request.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Your tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = TOOL_ICONS[tool.icon];
            const body = (
              <Card
                className={
                  tool.href
                    ? "hover:ring-primary/40 h-full transition-shadow hover:ring-2"
                    : "h-full opacity-70"
                }
              >
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-9 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle>{tool.name}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                  {!tool.href && (
                    <CardAction>
                      <Badge variant="secondary">Coming soon</Badge>
                    </CardAction>
                  )}
                </CardHeader>
              </Card>
            );
            return tool.href ? (
              <Link key={tool.key} href={tool.href} className="rounded-xl">
                {body}
              </Link>
            ) : (
              <div key={tool.key}>{body}</div>
            );
          })}
        </div>
      </section>
    </PageBody>
  );
}
