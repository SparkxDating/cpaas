"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type Verification = {
  id: string;
  channel: string;
  status: string;
  to: string;
  attempts: number;
  sendCount: number;
  expiresAt: string;
  approvedAt: string | null;
  createdAt: string;
  project: { name: string };
};

function statusTone(s: string): "green" | "amber" | "red" | "neutral" {
  if (s === "APPROVED") return "green";
  if (s === "PENDING") return "amber";
  if (s === "EXPIRED" || s === "MAX_ATTEMPTS" || s === "CANCELED") return "red";
  return "neutral";
}

export default function AdminVerificationsPage() {
  const rows = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () =>
      apiFetchAdmin<{ data: Verification[] }>("/admin/verifications?limit=50"),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <PageHeader
        title="OTP / Verify"
        description="Recent verification attempts across all projects."
      />
      {rows.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : rows.isError ? (
        <Empty>{(rows.error as Error).message}</Empty>
      ) : (rows.data?.data.length ?? 0) === 0 ? (
        <Empty>No verifications yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.data!.data.map((v) => (
            <Card key={v.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                  <Badge>{v.channel}</Badge>
                  <span className="font-mono text-sm">{v.to}</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {v.project.name} · attempts {v.attempts} · sends {v.sendCount}
                {v.approvedAt
                  ? ` · approved ${new Date(v.approvedAt).toLocaleString()}`
                  : ` · expires ${new Date(v.expiresAt).toLocaleString()}`}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
