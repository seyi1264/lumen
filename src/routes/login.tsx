import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center p-6"><div className="h-40 w-full max-w-sm animate-pulse rounded-md bg-raised" /></main>;
  }
  if (user) return <Navigate to="/" />;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message ?? "Authentication failed. Check your details and try again.");
        return;
      }
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <Card className="w-full max-w-md p-6 md:p-8">
        <LockKeyhole className="size-5 text-primary" />
        <h1 className="mt-4 font-display text-3xl">{mode === "sign-in" ? "Sign in to Lumen" : "Create your Lumen account"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your drafts, Buffer connection, and scheduled posts are private to your account.
        </p>
        <div className="mt-5 grid grid-cols-2 border-b border-border/80">
          {(["sign-in", "sign-up"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setMode(item); setError(null); }}
              className={`h-10 border-b-2 text-sm ${mode === item ? "border-primary text-fg" : "border-transparent text-muted"}`}
            >
              {item === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "sign-up" && (
            <div>
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required className="mt-1.5" />
            </div>
          )}
          <div>
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="account-password">Password</Label>
            <Input
              id="account-password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={mode === "sign-up" ? 8 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-1.5"
            />
          </div>
          {error && <p role="alert" className="text-sm text-loss">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <Link to="/" className="mt-5 inline-block text-sm text-primary underline-offset-4 hover:underline">
          Return to Lumen
        </Link>
      </Card>
    </main>
  );
}