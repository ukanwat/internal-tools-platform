import { redirect } from "next/navigation";

import { getCurrentUser } from "@/platform/auth";
import { SignInPicker } from "@/platform/auth/sign-in-picker";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <SignInPicker />
    </main>
  );
}
