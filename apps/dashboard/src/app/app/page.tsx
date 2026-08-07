"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetchAuth } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

export default function OverviewPage() {
  const { projectId, orgId } = useAuth();

  const analytics = useQuery({
    queryKey: ["analytics", projectId],
    enabled: !!projectId,
    queryFn: () =>
      apiFetchAuth<{
        periodDays: number;
        messages: number;
        delivered: number;
        failed: number;
        deliveryRate: number;
        verifications: number;
        spendMinor: number;
        providers: Array<{
          provider: string | null;
          _sum: { totalMinor: number | null; quantity: number | null };
          _count: number;
        }>;
      }>(`/analytics/overview?projectId=${encodeURIComponent(projectId!)}`),
  });

  const wallet = useQuery({
    queryKey: ["wallet", orgId],
    enabled: !!orgId,
    queryFn: () =>
      apiFetchAuth<{ balanceMinor: string; currency: string }>("/billing/wallet"),
  });

  if (!projectId) {
    return (
      <Empty>
        No project selected. Wait for session bootstrap or create a project via API.
      </Empty>
    );
  }

  const a = analytics.data;
  const balance = wallet.data
    ? (Number(wallet.data.balanceMinor) / 100).toFixed(2)
    : "—";

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Usage, delivery, and wallet for the last 30 days."
      />

      {analytics.isLoading || wallet.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading metrics…
        </div>
      ) : analytics.isError ? (
        <Empty>{(analytics.error as Error).message}</Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Messages" value={String(a?.messages ?? 0)} />
            <Metric
              label="Delivery rate"
              value={`${Math.round((a?.deliveryRate ?? 0) * 100)}%`}
            />
            <Metric label="Verifications" value={String(a?.verifications ?? 0)} />
            <Metric
              label="Wallet"
              value={`$${balance}`}
              hint={wallet.data?.currency ?? "USD"}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Delivery</h2>
              <div className="mt-4 space-y-2 text-sm">
                <Row k="Delivered" v={String(a?.delivered ?? 0)} tone="green" />
                <Row k="Failed" v={String(a?.failed ?? 0)} tone="red" />
                <Row k="Period" v={`${a?.periodDays ?? 30} days`} />
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">Provider spend</h2>
              <div className="mt-4 space-y-2">
                {(a?.providers?.length ?? 0) === 0 && (
                  <p className="text-sm text-slate-500">No usage recorded yet.</p>
                )}
                {a?.providers?.map((p) => (
                  <div
                    key={String(p.provider)}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{p.provider ?? "unknown"}</span>
                    <span className="text-slate-500">
                      qty {p._sum.quantity ?? 0} · $
                      {((p._sum.totalMinor ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <QuickLink href="/app/verify" title="Send OTP" desc="Verify flow" />
            <QuickLink href="/app/messages" title="Send SMS" desc="Messaging" />
            <QuickLink href="/app/keys" title="API keys" desc="sk_test / sk_live" />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      {tone ? <Badge tone={tone}>{v}</Badge> : <span className="font-medium">{v}</span>}
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-500 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-slate-500">{desc}</p>
    </Link>
  );
}
