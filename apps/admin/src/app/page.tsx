"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, getAdminToken, setAdminToken } from "@/lib/api";
import { Alert, Button, Input, Spinner } from "@/components/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@cpaas.local");
  const [password, setPassword] = useState("ChangeMeAdmin123!");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminToken()) router.replace("/console");
  }, [router]);

  const login = useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // Sanity-check admin routes work with this token
      await apiFetch("/admin/stats", { token: data.accessToken });
      setAdminToken(data.accessToken);
      return data;
    },
    onSuccess: () => router.push("/console"),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-violet-400">
          CPaaS
        </p>
        <h1 className="mt-1 text-2xl font-bold">Platform Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Sign in with a platform admin account.
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            login.mutate();
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-300">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-300">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Spinner /> : null}
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-500">
          Seed: admin@cpaas.local / ChangeMeAdmin123!
        </p>
      </div>
    </main>
  );
}
