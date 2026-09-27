import { requireUser } from "@/platform/auth";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/platform/permissions";

export default async function Home() {
  const user = await requireUser();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {user.name}
      </h1>
      <p className="text-muted-foreground">
        Signed in as {ROLE_LABELS[user.role]}. No tools yet.
      </p>
      <section>
        <h2 className="mb-2 text-sm font-medium">Your permissions</h2>
        <ul className="flex flex-wrap gap-2">
          {ROLE_PERMISSIONS[user.role].map((permission) => (
            <li
              key={permission}
              className="rounded-md border px-2 py-1 font-mono text-xs"
            >
              {permission}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
