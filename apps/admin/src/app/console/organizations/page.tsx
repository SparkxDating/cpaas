"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type Org = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner: { email: string; name: string | null };
  wallet: { balanceMinor: string; currency: string } | null;
  _count: { projects: number; members: number };
};

export default function AdminOrgsPage() {
  const orgs = useQuery({
    queryKey: ["admin-orgs"],
    queryFn: () => apiFetchAdmin<{ data: Org[] }>("/admin/organizations"),
  });

  return (
    <div>
      <PageHeader
        title="Organizations"
        description="Customer orgs, owners, wallets, and project counts."
      />
      {orgs.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : orgs.isError ? (
        <Empty>{(orgs.error as Error).message}</Empty>
      ) : (
        <div className="space-y-2">
          {orgs.data!.data.map((o) => (
            <Card key={o.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-zinc-50">{o.name}</p>
                  <p className="text-sm text-zinc-400">{o.slug}</p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Owner: {o.owner.email}
                    {o.owner.name ? ` (${o.owner.name})` : ""}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {o._count.members} members · {o._count.projects} projects · created{" "}
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone="violet">Wallet</Badge>
                  <p className="mt-2 text-xl font-bold">
                    $
                    {o.wallet
                      ? (Number(o.wallet.balanceMinor) / 100).toFixed(2)
                      : "0.00"}
                  </p>
                  <p className="text-xs text-zinc-500">{o.wallet?.currency ?? "USD"}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
