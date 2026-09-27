import Link from "next/link";

type Props = {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, pageCount, hrefForPage }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav className="flex items-center gap-4 text-sm">
      {page > 1 && <Link href={hrefForPage(page - 1)}>Previous</Link>}
      <span className="text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {page < pageCount && <Link href={hrefForPage(page + 1)}>Next</Link>}
    </nav>
  );
}
