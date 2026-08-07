"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { AuthError, clearTokens, getAccessToken } from "@/lib/api";
import { bootstrapSession, useAuth, type Project } from "@/lib/auth";
import { Alert, Button, Select, Spinner } from "./ui";

const nav = [
  { href: "/app", label: "Overview", exact: true },
  { href: "/app/keys", label: "API Keys" },
  { href: "/app/devices", label: "Gateways" },
  { href: "/app/verify", label: "Verify" },
  { href: "/app/messages", label: "Messaging" },
  { href: "/app/webhooks", label: "Webhooks" },
  { href: "/app/billing", label: "Billing" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, projectId, ready, logout, selectProject } = useAuth();

  const session = useQuery({
    queryKey: ["session-bootstrap", token],
    enabled: !!token,
    queryFn: () => bootstrapSession(token!),
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (!session.data) return;
    if (session.data.projectId && !projectId) {
      selectProject(session.data.projectId, session.data.orgId ?? undefined);
    }
  }, [session.data, projectId, selectProject]);

  // Expired / invalid token → clear and force re-login
  useEffect(() => {
    if (!session.isError) return;
    const err = session.error;
    if (err instanceof AuthError || (err instanceof Error && /token|auth|unauthorized/i.test(err.message))) {
      clearTokens();
      router.replace("/?reason=session");
    }
  }, [session.isError, session.error, router]);

  if (!ready || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <Spinner /> <span className="ml-2">Loading session…</span>
      </div>
    );
  }

  if (session.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        <Spinner /> <span className="ml-2">Restoring session…</span>
      </div>
    );
  }

  if (session.isError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4">
        <Alert>
          Session expired or invalid. Please sign in again.
          <br />
          <span className="text-xs opacity-80">
            {(session.error as Error)?.message ?? "Invalid access token"}
          </span>
        </Alert>
        <Button
          onClick={() => {
            clearTokens();
            router.replace("/");
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  const projects: Project[] = session.data?.projects ?? [];
  const accessStillThere = !!getAccessToken();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-8">
      <aside className="flex w-56 shrink-0 flex-col">
        <div className="mb-6">
          <p className="text-lg font-bold tracking-tight">CPaaS</p>
          <p className="text-xs text-slate-500">Customer console</p>
        </div>
        <nav className="space-y-1">
          {nav.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-600 text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 pt-8">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Project
            </p>
            <Select
              value={projectId ?? ""}
              onChange={(e) => {
                const p = projects.find((x) => x.id === e.target.value);
                if (p) selectProject(p.id, p.organizationId);
              }}
              disabled={!projects.length}
            >
              {!projects.length && <option value="">No projects</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.environment})
                </option>
              ))}
            </Select>
          </div>
          {!accessStillThere && (
            <p className="text-xs text-amber-600">Session missing — sign in again.</p>
          )}
          <Button variant="secondary" className="w-full" onClick={logout}>
            Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
