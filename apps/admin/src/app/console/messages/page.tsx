"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetchAdmin } from "@/lib/api";
import { Badge, Card, Empty, PageHeader, Spinner } from "@/components/ui";

type Message = {
  id: string;
  toNumber: string;
  body: string | null;
  channel: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
  project: { name: string };
  provider: { name: string; displayName: string } | null;
};

function statusTone(s: string): "green" | "amber" | "red" | "neutral" {
  if (s === "DELIVERED" || s === "SENT") return "green";
  if (s === "FAILED" || s === "REJECTED") return "red";
  if (s === "QUEUED" || s === "SENDING") return "amber";
  return "neutral";
}

export default function AdminMessagesPage() {
  const messages = useQuery({
    queryKey: ["admin-messages"],
    queryFn: () =>
      apiFetchAdmin<{ data: Message[] }>("/admin/messages?limit=50"),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <PageHeader title="Messages" description="Latest platform SMS/MMS traffic." />
      {messages.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Spinner /> Loading…
        </div>
      ) : messages.isError ? (
        <Empty>{(messages.error as Error).message}</Empty>
      ) : (messages.data?.data.length ?? 0) === 0 ? (
        <Empty>No messages yet.</Empty>
      ) : (
        <div className="space-y-2">
          {messages.data!.data.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  <Badge tone="violet">{m.channel}</Badge>
                  <span className="font-mono text-sm">{m.toNumber}</span>
                </div>
                <span className="text-xs text-zinc-500">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-200">{m.body}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {m.project.name}
                {m.provider ? ` · ${m.provider.displayName}` : ""}
                {m.errorMessage ? ` · ${m.errorMessage}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
