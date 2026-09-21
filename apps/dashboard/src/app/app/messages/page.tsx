"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
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
  Select,
  Spinner,
} from "@/components/ui";

type Message = {
  id: string;
  toNumber: string;
  fromNumber: string | null;
  body: string | null;
  channel: string;
  status: string;
  direction?: string;
  deviceId?: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function statusTone(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "DELIVERED" || status === "SENT") return "green";
  if (status === "FAILED" || status === "REJECTED" || status === "UNDELIVERED") return "red";
  if (status === "QUEUED" || status === "SCHEDULED" || status === "SENDING") return "amber";
  return "neutral";
}

export default function MessagesPage() {
  const { token, projectId } = useAuth();
  const qc = useQueryClient();
  const [to, setTo] = useState("+15551234567");
  const [body, setBody] = useState("Hello from CPaaS");
  const [channel, setChannel] = useState("SMS");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["messages", token, projectId],
    enabled: !!token && !!projectId,
    queryFn: () =>
      apiFetch<{ data: Message[] }>(
        `/messages?projectId=${encodeURIComponent(projectId!)}&limit=50`,
        { token: token! }
      ),
    refetchInterval: 10_000,
  });

  const send = useMutation({
    mutationFn: () =>
      apiFetch<Message>("/messages", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ to, body, channel, projectId }),
      }),
    onSuccess: (msg) => {
      setSuccess(`Message ${msg.id} · ${msg.status}`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Messaging"
        description="Send SMS/MMS/WhatsApp/RCS and inspect recent traffic."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <Alert tone="success">{success}</Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="font-semibold">Send message</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="To (E.164)">
            <Input value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="SMS">SMS</option>
              <option value="MMS">MMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="RCS">RCS</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Body">
              <Input value={body} onChange={(e) => setBody(e.target.value)} />
            </Field>
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!projectId || send.isPending || !to.trim() || !body.trim()}
          onClick={() => send.mutate()}
        >
          {send.isPending ? <Spinner /> : null}
          Send
        </Button>
      </Card>

      <h2 className="mb-3 font-semibold">Recent messages</h2>
      {list.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : list.isError ? (
        <Empty>{(list.error as Error).message}</Empty>
      ) : (list.data?.data.length ?? 0) === 0 ? (
        <Empty>No messages yet. Send one above.</Empty>
      ) : (
        <div className="space-y-3">
          {list.data!.data.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                  <Badge tone="blue">{m.channel}</Badge>
                  {m.direction === "INBOUND" && <Badge>IN</Badge>}
                  <span className="font-mono text-sm">{m.toNumber}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm">{m.body}</p>
              {m.errorMessage && (
                <p className="mt-1 text-xs text-red-600">{m.errorMessage}</p>
              )}
              <p className="mt-1 font-mono text-[11px] text-slate-400">{m.id}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
