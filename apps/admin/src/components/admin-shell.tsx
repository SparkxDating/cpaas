"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { clearAdminToken, getAdminToken } from "@/lib/api";
import { Button, Spinner } from "./ui";

const nav = [
  { href: "/console", label: "Overview", exact: true },
  { href: "/console/users", label: "Users" },
  { href: "/console/organizations", label: "Organizations" },
  { href: "/console/providers", label: "Providers" },
  { href: "/console/devices", label: "Devices" },
  { href: "/console/messages", label: "Messages" },
  { href: "/console/verifications", label: "OTP / Verify" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getAdminToken();
    setReady(true);
    if (!t) router.replace("/");
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        <Spinner /> <span className="ml-2">Loading…</span>
      </div>
    );
  }

  if (!getAdminToken()) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-8">
      <aside className="flex w-56 shrink-0 flex-col">
        <div className="mb-6">
          <p className="text-lg font-bold text-zinc-50">CPaaS Admin</p>
          <p className="text-xs text-zinc-500">Platform console</p>
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
                    ? "bg-violet-600 text-white"
                    : "text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-8">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              clearAdminToken();
              router.replace("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
