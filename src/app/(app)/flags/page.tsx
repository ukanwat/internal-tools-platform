import type { Metadata } from "next";

import { requirePermission } from "@/platform/permissions";
import { PageBody, PageHeader } from "@/platform/ui";
import { FlagList } from "@/tools/feature-flags/components/flag-list";
import { listFlags } from "@/tools/feature-flags/service";

export const metadata: Metadata = { title: "Feature flags" };

export default async function FlagsPage() {
  const user = await requirePermission("flags.view");
  const flags = await listFlags();

  return (
    <PageBody>
      <PageHeader
        title="Feature flags"
        description="Staging changes apply straight away. In production, turning a flag on or raising its rollout needs an eng manager's approval; turning it off or scaling it back applies straight away."
      />
      <FlagList flags={flags} viewer={user} />
    </PageBody>
  );
}
