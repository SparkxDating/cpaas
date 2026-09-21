"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetchAuth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
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
  pendingOutbox?: number;
};

type PairingResponse = {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  apiBases: string[];
  payload: { apiBase: string; pairingCode: string };
};

function tone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "ONLINE") return "green";
  if (status === "OFFLINE" || status === "PENDING") return "amber";
  if (status === "DISABLED") return "red";
  return "neutral";
}

export default function DevicesPage() {
  const { projectId } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const devices = useQuery({
    queryKey: ["devices", projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiFetchAuth<{ data: Device[] }>(
        `/device?projectId=${encodeURIComponent(projectId!)}`
      ),
    refetchInterval: 5_000,
  });

  const pairing = useMutation({
    mutationFn: () =>
      apiFetchAuth<PairingResponse>("/device/pairing-codes", {
        method: "POST",
        body: JSON.stringify({ projectId }),
      }),
    onError: (e: Error) => setError(e.message),
    onSuccess: () => setError(null),
  });

  const toggle = useMutation({
    mutationFn: ({ id, disabled }: { id: string; disabled: boolean }) =>
      apiFetchAuth(
        `/device/${id}/${disabled ? "disable" : "enable"}?projectId=${encodeURIComponent(projectId!)}`,
        { method: "POST" }
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <PageHeader
        title="Android gateways"
        description="Pair a physical phone, keep the gateway service running, then send SMS from Messaging."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Pair a phone</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>PC and phone on the same Wi‑Fi. API must be reachable at a LAN IP, not localhost.</li>
          <li>Open <code className="text-xs">android/gateway</code> in Android Studio and run on a real SIM phone.</li>
          <li>Generate a pairing code below. On the phone: paste API base + code → Pair → Start gateway.</li>
          <li>Status becomes <strong>ONLINE</strong> after the first heartbeat (~5s). Then send a test SMS from Messaging.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!projectId || pairing.isPending} onClick={() => pairing.mutate()}>
            {pairing.isPending ? <Spinner /> : null}
            Generate pairing code
          </Button>
        </div>

        {pairing.data && (
          <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500">Pairing code (10 min)</p>
            <p className="font-mono text-3xl font-bold tracking-[0.2em]">{pairing.data.code}</p>
            <p className="text-xs text-slate-500">
              Expires {new Date(pairing.data.expiresAt).toLocaleTimeString()}
            </p>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">API base on the phone</p>
              {pairing.data.apiBases.length === 0 ? (
                <p className="text-sm text-amber-700">
                  No LAN IPv4 detected. Run <code>ipconfig</code> and use{" "}
                  <code>http://&lt;Wi‑Fi IPv4&gt;:3001</code>.
                </p>
              ) : (
                <ul className="space-y-1">
                  {pairing.data.apiBases.map((url) => (
                    <li key={url} className="flex flex-wrap items-center gap-2">
                      <code className="text-sm">{url}</code>
                      <Button variant="ghost" type="button" onClick={() => void copy(url, url)}>
                        {copied === url ? "Copied" : "Copy"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                void copy(
                  "payload",
                  `${pairing.data.payload.apiBase}\n${pairing.data.code}`
                )
              }
            >
              {copied === "payload" ? "Copied" : "Copy API base + code"}
            </Button>
          </div>
        )}
      </Card>

      {devices.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading devices…
        </div>
      ) : devices.isError ? (
        <Empty>{(devices.error as Error).message}</Empty>
      ) : (devices.data?.data.length ?? 0) === 0 ? (
        <Empty>No devices yet. Generate a pairing code and register the Android app.</Empty>
      ) : (
        <div className="space-y-3">
          {devices.data!.data.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{d.name}</p>
                  <Badge tone={tone(d.status)}>{d.status}</Badge>
                  {(d.pendingOutbox ?? 0) > 0 && (
                    <Badge tone="amber">{d.pendingOutbox} queued</Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {d.lastHeartbeatAt
                    ? `Heartbeat ${new Date(d.lastHeartbeatAt).toLocaleString()}`
                    : "No heartbeat yet — start the gateway service"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {d.manufacturer ?? "—"} {d.model ?? ""} · battery {d.batteryPercent ?? "—"}% ·{" "}
                {d.networkType ?? "network?"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                {d.id} · token {d.deviceTokenPrefix}…
              </p>
              <div className="mt-3">
                {d.status === "DISABLED" ? (
                  <Button
                    variant="secondary"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: d.id, disabled: false })}
                  >
                    Enable
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: d.id, disabled: true })}
                  >
                    Disable
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
