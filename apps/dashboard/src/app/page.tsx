"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { apiFetch, clearTokens, getAccessToken, setTokens } from "@/lib/api";
import { bootstrapSession } from "@/lib/auth";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session";
  const [email, setEmail] = useState("dev@cpaas.local");
  const [password, setPassword] = useState("ChangeMeDev123!");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionExpired) {
      clearTokens();
      return;
    }
    if (getAccessToken()) router.replace("/app");
  }, [router, sessionExpired]);

  const login = useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ accessToken: string; refreshToken: string }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      setTokens(data.accessToken, data.refreshToken);
      await bootstrapSession();
      return data;
    },
    onSuccess: () => router.push("/app"),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            CPaaS
          </p>
          <h1 className="mt-1 text-2xl font-bold">Customer dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage verify, messaging, API keys, webhooks, and billing.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            login.mutate();
          }}
        >
          <Field label="Email">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </Field>
          {sessionExpired && !error && (
            <Alert tone="info">Your session expired. Please sign in again.</Alert>
          )}
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Spinner /> : null}
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Spinner /> <span className="ml-2">Loading…</span>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
