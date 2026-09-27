import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/platform/auth";
import { signOut } from "@/platform/auth/actions";
import { hasPermission, ROLE_LABELS } from "@/platform/permissions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) return children;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-semibold">
            Internal Tools
          </Link>
          {/* Navigation only; the audit page enforces audit.view itself. */}
          <Link href="/approvals" className="text-muted-foreground">
            Approvals
          </Link>
          {hasPermission(user.role, "audit.view") && (
            <Link href="/admin/audit" className="text-muted-foreground">
              Audit log
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span>
            {user.name}{" "}
            <span className="text-muted-foreground">
              ({ROLE_LABELS[user.role]})
            </span>
          </span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
