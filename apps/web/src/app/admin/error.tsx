"use client";
import { Button } from "@/components/ui/Button";
export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-surface-muted p-6 text-center">
      <h1 className="text-2xl font-bold">Admin service unavailable</h1>
      <p className="text-muted">
        Please check the API is running, then try again.
      </p>
      <Button
        variant="primary"
        onClick={reset}
        className="rounded-lg bg-brand px-5 py-3 text-on-dark"
      >
        Try again
      </Button>
    </main>
  );
}
