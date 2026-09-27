import type { ReactNode } from "react";

/** Standard page body: padding that shrinks on phones and a readable max width. */
export function PageBody({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
      {children}
    </main>
  );
}
