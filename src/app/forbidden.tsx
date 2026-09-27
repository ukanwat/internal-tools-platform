import { ShieldXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center md:p-8">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <ShieldXIcon className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="text-muted-foreground max-w-sm">
        Your role does not have permission to do this. The attempt was logged.
      </p>
      <Button nativeButton={false} render={<Link href="/" />}>
        Back to home
      </Button>
    </main>
  );
}
