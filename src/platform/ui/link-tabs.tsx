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
    <nav className="bg-muted text-muted-foreground inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-lg p-1 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-1 whitespace-nowrap transition-colors",
            tab.active
              ? "bg-background text-foreground font-medium shadow-sm"
              : "hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab.active
                  ? "bg-primary text-primary-foreground"
                  : "bg-background",
              )}
            >
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
