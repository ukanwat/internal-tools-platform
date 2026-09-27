import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Internal Tools Platform
      </h1>
      <p className="text-muted-foreground">Nothing here yet.</p>
      <Button>Get started</Button>
    </main>
  );
}
