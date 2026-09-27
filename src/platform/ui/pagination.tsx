import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, pageCount, hrefForPage }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page - 1)} />}
          >
            <ChevronLeftIcon />
            Previous
          </Button>
        )}
        {page < pageCount && (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefForPage(page + 1)} />}
          >
            Next
            <ChevronRightIcon />
          </Button>
        )}
      </div>
    </nav>
  );
}
