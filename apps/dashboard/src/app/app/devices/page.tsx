"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAuth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Badge,
  Card,
  Empty,
  PageHeader,
  Spinner,
} from "@/components/ui";

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
  deviceTokenPrefix: string;
};

function tone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "ONLINE") return "green";
  if (status === "OFFLINE" || status === "PENDING") return "amber";
  if (status === "DISABLED") return "red";
  return "neutral";
}

export default function DevicesPage() {
  const { projectId } = useAuth();

  const devices = useQuery({
    queryKey: ["devices", projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiFetchAuth<{ data: Device[] }>(
        `/device?projectId=${encodeURIComponent(projectId!)}`
      ),
    refetchInterval: 5_000,
  });

  return (
    <div>
      <PageHeader
        title="Android gateways"
        description="Phones registered as SMS gateways for this project. Keep the gateway app running so status stays ONLINE."
      />

      <Card className="mb-6 text-sm text-slate-600 dark:text-slate-300">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Pairing steps</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Create an API key under API Keys (copy <code className="text-xs">sk_test_…</code>).</li>
          <li>Open <code className="text-xs">android/gateway</code> in Android Studio → run on a real phone.</li>
          <li>
            API base = your PC LAN IP, e.g. <code className="text-xs">http://192.168.1.14:3001</code>{" "}
            (not localhost on the phone).
          </li>
          <li>Paste the API key → Register device → Start gateway service.</li>
          <li>Send an SMS from Messaging — it routes to an ONLINE gateway first.</li>
        </ol>
      </Card>

      {devices.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading devices…
        </div>
      ) : devices.isError ? (
        <Empty>{(devices.error as Error).message}</Empty>
      ) : (devices.data?.data.length ?? 0) === 0 ? (
        <Empty>No devices yet. Register the Android app with your project API key.</Empty>
      ) : (
        <div className="space-y-3">
          {devices.data!.data.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{d.name}</p>
                  <Badge tone={tone(d.status)}>{d.status}</Badge>
                </div>
                <span className="text-xs text-slate-500">
                  {d.lastHeartbeatAt
                    ? `Heartbeat ${new Date(d.lastHeartbeatAt).toLocaleString()}`
                    : "No heartbeat"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {d.manufacturer ?? "—"} {d.model ?? ""} · battery {d.batteryPercent ?? "—"}% ·{" "}
                {d.networkType ?? "network?"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                {d.id} · token {d.deviceTokenPrefix}…
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
