"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiFetchAdmin, AuthError, clearAdminToken } from "@/lib/api";
import { Empty, PageHeader, Spinner, Stat } from "@/components/ui";

type Stats = {
  users: number;
  orgs: number;
  projects: number;
  messages: number;
  devices: number;
  providers: number;
  messages24h: number;
  verifications24h: number;
  onlineDevices: number;
};

export default function AdminOverviewPage() {
  const router = useRouter();
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetchAdmin<Stats>("/admin/stats"),
    retry: false,
  });

  if (stats.isError && stats.error instanceof AuthError) {
    clearAdminToken();
    router.replace("/");
  }

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Platform-wide totals and last-24h activity."
      />
      {stats.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading stats…
        </div>
      ) : stats.isError ? (
        <Empty>{(stats.error as Error).message}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Users" value={stats.data!.users} />
          <Stat label="Organizations" value={stats.data!.orgs} />
          <Stat label="Projects" value={stats.data!.projects} />
          <Stat label="Messages (all time)" value={stats.data!.messages} />
          <Stat
            label="Messages (24h)"
            value={stats.data!.messages24h}
            hint="Last 24 hours"
          />
          <Stat
            label="OTP / Verify (24h)"
            value={stats.data!.verifications24h}
          />
          <Stat label="Devices" value={stats.data!.devices} />
          <Stat
            label="Online gateways"
            value={stats.data!.onlineDevices}
            hint="Heartbeat &lt; 2 min"
          />
          <Stat label="Active providers" value={stats.data!.providers} />
        </div>
      )}
    </div>
  );
}
