import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/platform/db";
import { ROLE_LABELS } from "@/platform/permissions/roles";

import { signInAs } from "./actions";

/** Fake login. Swap this component for an SSO redirect later. */
export async function SignInPicker() {
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in as</CardTitle>
        <CardDescription>
          Development login. Pick a seeded user to act as.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No users found. Run <code>npm run db:setup</code> to seed them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((user) => (
              <li key={user.id}>
                <form action={signInAs}>
                  <input type="hidden" name="userId" value={user.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-auto w-full justify-between py-3"
                  >
                    <span className="flex flex-col items-start">
                      <span>{user.name}</span>
                      <span className="text-muted-foreground text-xs font-normal">
                        {user.email}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {ROLE_LABELS[user.role]}
                    </span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
