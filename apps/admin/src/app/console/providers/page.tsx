"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type Provider = {
  id: string;
  name: string;
  displayName: string;
  type: string;
  isActive: boolean;
  basePriority: number;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  lastHealthAt: string | null;
};

export default function AdminProvidersPage() {
  const providers = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => apiFetchAdmin<{ data: Provider[] }>("/admin/providers"),
  });

  return (
    <div>
      <PageHeader
        title="Providers"
        description="SMS/email/voice provider adapters and health scores."
      />
      {providers.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : providers.isError ? (
        <Empty>{(providers.error as Error).message}</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {providers.data!.data.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-50">{p.displayName}</p>
                  <p className="font-mono text-xs text-zinc-500">{p.name}</p>
                </div>
                <Badge tone={p.isActive ? "green" : "red"}>
                  {p.isActive ? "ACTIVE" : "OFF"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <span>Type: {p.type}</span>
                <span>Priority: {p.basePriority}</span>
                <span>Health: {(p.healthScore * 100).toFixed(0)}%</span>
                <span>Success: {(p.successRate * 100).toFixed(0)}%</span>
                <span>Latency: {p.avgLatencyMs} ms</span>
                <span>
                  Last check:{" "}
                  {p.lastHealthAt
                    ? new Date(p.lastHealthAt).toLocaleString()
                    : "never"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
