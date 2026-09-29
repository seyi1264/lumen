import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center p-6"><div className="h-40 w-full max-w-sm animate-pulse rounded-md bg-raised" /></main>;
  }
  if (user) return <Navigate to="/" />;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <Card className="w-full max-w-md p-6 md:p-8">
        <LockKeyhole className="size-5 text-primary" />
        <h1 className="mt-4 font-display text-3xl">Workspace access</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Lumen uses your authenticated workspace identity. Open this app through your authorized workspace to continue.
        </p>
        <Link to="/" className="mt-5 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Return to Lumen
        </Link>
      </Card>
    </main>
  );
}