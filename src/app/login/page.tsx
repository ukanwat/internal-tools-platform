import { ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/platform/auth";
import { SignInPicker } from "@/platform/auth/sign-in-picker";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="bg-muted/40 flex flex-1 flex-col items-center justify-center gap-6 p-4 md:p-8">
      <div className="flex items-center gap-2 font-semibold">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
          <ShieldCheckIcon className="size-4" />
        </div>
        Ops Console
      </div>
      <SignInPicker />
    </main>
  );
}
