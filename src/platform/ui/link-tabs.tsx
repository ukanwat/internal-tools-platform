import Link from "next/link";

import { cn } from "cn";

export type LinkTab = {
  href: string;
  label: string;
  count?: number;
  active: boolean;
};

/** URL-driven tabs, so the selected tab survives reloads and is shareable. */
export function LinkTabs({ tabs }: { tabs: LinkTab[] }) {
  return (
    <nav className="flex gap-1 border-b text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2",
            tab.active
              ? "border-primary font-medium"
              : "text-muted-foreground border-transparent",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="bg-muted ml-2 rounded-full px-1.5 text-xs">
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
