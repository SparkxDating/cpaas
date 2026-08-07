"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type User = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { memberships: number };
};

export default function AdminUsersPage() {
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiFetchAdmin<{ data: User[] }>("/admin/users"),
  });

  return (
    <div>
      <PageHeader title="Users" description="Platform user accounts (latest 100)." />
      {users.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : users.isError ? (
        <Empty>{(users.error as Error).message}</Empty>
      ) : (users.data?.data.length ?? 0) === 0 ? (
        <Empty>No users.</Empty>
      ) : (
        <div className="space-y-2">
          {users.data!.data.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-zinc-100">{u.email}</p>
                  <Badge tone={u.status === "ACTIVE" ? "green" : "red"}>{u.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{u.name ?? "—"}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {u._count.memberships} org memberships · joined{" "}
                  {new Date(u.createdAt).toLocaleString()}
                  {u.lastLoginAt
                    ? ` · last login ${new Date(u.lastLoginAt).toLocaleString()}`
                    : " · never logged in"}
                </p>
              </div>
              <p className="font-mono text-[11px] text-zinc-600">{u.id}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
