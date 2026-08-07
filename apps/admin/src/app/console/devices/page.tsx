"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type Device = {
  id: string;
  name: string;
  status: string;
  platform: string;
  model: string | null;
  manufacturer: string | null;
  batteryPercent: number | null;
  networkType: string | null;
  lastHeartbeatAt: string | null;
  project: { id: string; name: string; slug: string };
};

function deviceTone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "ONLINE") return "green";
  if (status === "OFFLINE" || status === "PENDING") return "amber";
  if (status === "DISABLED") return "red";
  return "neutral";
}

export default function AdminDevicesPage() {
  const devices = useQuery({
    queryKey: ["admin-devices"],
    queryFn: () => apiFetchAdmin<{ data: Device[] }>("/admin/devices"),
    refetchInterval: 15_000,
  });

  return (
    <div>
      <PageHeader
        title="Devices"
        description="Android SMS gateways registered across projects."
      />
      {devices.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : devices.isError ? (
        <Empty>{(devices.error as Error).message}</Empty>
      ) : (devices.data?.data.length ?? 0) === 0 ? (
        <Empty>No devices registered yet. Pair the Android gateway app.</Empty>
      ) : (
        <div className="space-y-2">
          {devices.data!.data.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{d.name}</p>
                  <Badge tone={deviceTone(d.status)}>{d.status}</Badge>
                  <Badge>{d.platform}</Badge>
                </div>
                <span className="text-xs text-zinc-500">
                  {d.lastHeartbeatAt
                    ? `Heartbeat ${new Date(d.lastHeartbeatAt).toLocaleString()}`
                    : "No heartbeat"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {d.manufacturer ?? "—"} {d.model ?? ""} · project {d.project.name}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Battery {d.batteryPercent ?? "—"}% · network {d.networkType ?? "—"}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
