import { countApprovals } from "@/platform/approvals";
import { getCurrentUser } from "@/platform/auth";
import { signOut } from "@/platform/auth/actions";
import { hasPermission, ROLE_LABELS } from "@/platform/permissions";
import { TOOLS, type ToolDefinition } from "@/platform/tools";
import { AppShell, type NavItem } from "@/platform/ui/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) return children;

  const waiting = await countApprovals(user, "waiting");
  // Navigation only; each page enforces its own permission.
  const navItems = (kind: ToolDefinition["kind"]): NavItem[] =>
    TOOLS.filter(
      (tool) =>
        tool.kind === kind &&
        (!tool.permission || hasPermission(user.role, tool.permission)),
    ).map((tool) => ({
      href: tool.href,
      label: tool.name,
      icon: tool.icon,
      badge: tool.key === "approvals" ? waiting : undefined,
    }));
  const tools = navItems("tool");

  return (
    <AppShell
      sections={[
        { items: [{ href: "/", label: "Home", icon: "home" }] },
        ...(tools.length > 0 ? [{ label: "Tools", items: tools }] : []),
        { label: "Oversight", items: navItems("platform") },
      ]}
      user={{
        name: user.name,
        email: user.email,
        roleLabel: ROLE_LABELS[user.role],
      }}
      signOut={signOut}
    >
      {children}
    </AppShell>
  );
}
