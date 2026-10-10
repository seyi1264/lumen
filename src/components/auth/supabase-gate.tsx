import type { Session } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearConfig, getSupabase, readConfig, saveConfig } from "@/lib/supabase/client";
import { pullStudio } from "@/lib/supabase/sync";
import { useStudioStore } from "@/lib/studio/store";
import schemaSql from "../../../supabase/schema.sql?raw";

export function SupabaseGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [schemaRetrying, setSchemaRetrying] = useState(false);
  const [pullAttempt, setPullAttempt] = useState(0);
  const userId = session?.user.id;

  useEffect(() => {
    window.localStorage.removeItem("lumen-studio-v1");
    const config = readConfig();
    setConfigured(Boolean(config));
    const sb = getSupabase();
    if (!sb) {
      setReady(true);
      return;
    }
    let stop = false;
    void sb.auth.getSession().then(({ data }) => {
      if (stop) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      stop = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    void pullStudio()
      .then((snap) => {
        if (cancel || !snap) return;
        useStudioStore.getState().replaceStudio(snap);
        setSchemaMissing(false);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Could not load your desk.";
        if (isMissingSchemaError(message)) {
          setSchemaMissing(true);
        } else {
          setSchemaMissing(false);
          toast.error(message);
        }
      })
      .finally(() => {
        if (!cancel) setSchemaRetrying(false);
      });
    return () => {
      cancel = true;
    };
  }, [userId, pullAttempt]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-6 text-sm text-muted">
        Opening the desk
      </div>
    );
  }

  if (!configured) return <ConnectScreen onConnected={() => setConfigured(true)} />;
  if (!session) {
    return (
      <SignInScreen
        onSwitchProject={() => {
          clearConfig();
          useStudioStore.getState().clearStudio();
          setSession(null);
          setConfigured(false);
        }}
      />
    );
  }
  if (schemaMissing) {
    return (
      <SchemaSetupScreen
        retrying={schemaRetrying}
        onRetry={() => {
          setSchemaRetrying(true);
          setPullAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }

  return <>{children}</>;
}

function isMissingSchemaError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("pgrst205") ||
    normalized.includes("could not find the table") ||
    normalized.includes("schema cache")
  );
}

function ConnectScreen({ onConnected }: { onConnected: () => void }) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");

  return (
    <div className="min-h-dvh bg-bg px-4 py-16 text-fg">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[0.65rem] font-medium tracking-[0.16em] text-subtle uppercase">Lumen</p>
        <h1 className="mt-3 font-display text-4xl">Connect your Supabase</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Better Auth is not used. Paste the project URL and the anon public key from Supabase
          settings. Do not paste the service role key.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const clean = url.trim().replace(/\/+$/, "");
            if (!clean.startsWith("https://") || !clean.includes("supabase")) {
              toast.error("Use the project URL from Supabase. It looks like https://xxxx.supabase.co");
              return;
            }
            if (anonKey.trim().length < 20) {
              toast.error("That anon key looks too short.");
              return;
            }
            saveConfig({ url: clean, anonKey: anonKey.trim() });
            onConnected();
          }}
        >
          <div>
            <Label htmlFor="sb-url">Project URL</Label>
            <Input
              id="sb-url"
              className="mt-1.5"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="sb-key">Anon public key</Label>
            <Input
              id="sb-key"
              className="mt-1.5"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJ..."
              autoComplete="off"
              type="password"
            />
          </div>
          <Button type="submit">Connect</Button>
        </form>

        <div className="mt-10">
          <SchemaSqlPanel />
        </div>
      </div>
    </div>
  );
}

function SchemaSetupScreen({
  retrying,
  onRetry,
}: {
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-dvh bg-bg px-4 py-16 text-fg">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[0.65rem] font-medium tracking-[0.16em] text-subtle uppercase">Lumen</p>
        <h1 className="mt-3 font-display text-4xl">Your Supabase tables are missing</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This project is connected, but Lumen could not find its database tables. Run the SQL below
          in your Supabase SQL editor, then check the connection again.
        </p>
        <div className="mt-8">
          <SchemaSqlPanel />
        </div>
        <Button type="button" className="mt-5" disabled={retrying} onClick={onRetry}>
          {retrying ? "Checking…" : "I've run the SQL — check again"}
        </Button>
      </div>
    </div>
  );
}

function SchemaSqlPanel() {
  const [copied, setCopied] = useState(false);
  const sqlRef = useRef<HTMLPreElement>(null);

  async function copySql() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(schemaSql);
      setCopied(true);
      toast("SQL copied.");
      return;
    } catch {
      // Preview iframes can deny the Clipboard API; select the SQL for a manual copy fallback.
    }

    const selection = window.getSelection();
    const range = document.createRange();
    if (sqlRef.current && selection) {
      range.selectNodeContents(sqlRef.current);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    try {
      if (document.execCommand("copy")) {
        selection?.removeAllRanges();
        setCopied(true);
        toast("SQL copied.");
      } else {
        toast.error("Clipboard access is blocked. The SQL is selected; copy it manually.");
      }
    } catch {
      toast.error("Clipboard access is blocked. The SQL is selected; copy it manually.");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Run this SQL once</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => void copySql()}>
          {copied ? "Copied" : "Copy SQL"}
        </Button>
      </div>
      <p className="mt-2 text-sm text-muted">
        In Supabase, open the SQL editor, paste, and run. This creates your tables and locks each row
        to the signed-in account.
      </p>
      <pre
        ref={sqlRef}
        className="mt-4 max-h-64 overflow-auto rounded-md bg-surface p-4 text-xs leading-relaxed text-muted"
      >
        {schemaSql}
      </pre>
    </>
  );
}

function SignInScreen({ onSwitchProject }: { onSwitchProject: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");

  async function submit(e: FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    try {
      const result =
        mode === "in"
          ? await sb.auth.signInWithPassword({ email: email.trim(), password })
          : await sb.auth.signUp({ email: email.trim(), password });
      if (result.error) {
        toast.error(result.error.message);
        return;
      }
      if (mode === "up" && !result.data.session) {
        toast("Account created. Confirm the email, then sign in.");
        setMode("in");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-[0.65rem] font-medium tracking-[0.16em] text-subtle uppercase">Lumen</p>
        <h1 className="mt-3 font-display text-4xl">{mode === "in" ? "Sign in" : "Create an account"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This is your Supabase account. The desk starts empty.
        </p>
        <div className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Working" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Need an account?" : "Already have one?"}
          </button>
          <button type="button" className="block text-sm text-subtle hover:text-fg" onClick={onSwitchProject}>
            Use a different Supabase project
          </button>
        </div>
      </form>
    </div>
  );
}

export async function signOutStudio() {
  const sb = getSupabase();
  await sb?.auth.signOut();
  useStudioStore.getState().clearStudio();
}
