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
  Spinner,
} from "@/components/ui";

type Webhook = {
  id: string;
  url: string;
  events: string[];
  status: string;
  secret: string;
  description: string | null;
  createdAt: string;
};

type Delivery = {
  id: string;
  event: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  webhook: { id: string; url: string };
};

const DEFAULT_EVENTS = [
  "message.sent",
  "message.delivered",
  "message.failed",
  "verification.approved",
  "verification.failed",
];

export default function WebhooksPage() {
  const { token, projectId } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState("https://webhook.site/your-id");
  const [events, setEvents] = useState(DEFAULT_EVENTS.join(","));
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Webhook | null>(null);

  const list = useQuery({
    queryKey: ["webhooks", token, projectId],
    enabled: !!token && !!projectId,
    queryFn: () =>
      apiFetch<{ data: Webhook[] }>(
        `/webhooks?projectId=${encodeURIComponent(projectId!)}`,
        { token: token! }
      ),
  });

  const deliveries = useQuery({
    queryKey: ["webhook-deliveries", token, projectId],
    enabled: !!token && !!projectId,
    queryFn: () =>
      apiFetch<{ data: Delivery[] }>(
        `/webhooks/deliveries?projectId=${encodeURIComponent(projectId!)}`,
        { token: token! }
      ),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<Webhook>("/webhooks", {
        method: "POST",
        token: token!,
        body: JSON.stringify({
          url,
          events: events.split(",").map((e) => e.trim()).filter(Boolean),
          projectId,
          description: "Created from dashboard",
        }),
      }),
    onSuccess: (wh) => {
      setCreated(wh);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const disable = useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/webhooks/${id}/disable?projectId=${encodeURIComponent(projectId!)}`,
        {
          method: "POST",
          token: token!,
        }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["webhooks"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Signed outbound webhooks with retries and delivery logs."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {created && (
        <div className="mb-4">
          <Alert tone="success">
            Webhook created. Signing secret:{" "}
            <code className="break-all font-mono text-xs">{created.secret}</code>
          </Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="font-semibold">Create webhook</h2>
        <div className="mt-4 space-y-3">
          <Field label="URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label="Events (comma-separated)">
            <Input value={events} onChange={(e) => setEvents(e.target.value)} />
          </Field>
          <Button
            disabled={!projectId || create.isPending || !url.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Spinner /> : null}
            Create
          </Button>
        </div>
      </Card>

      <h2 className="mb-3 font-semibold">Endpoints</h2>
      {list.isLoading ? (
        <div className="mb-6 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : (list.data?.data.length ?? 0) === 0 ? (
        <div className="mb-6">
          <Empty>No webhooks yet.</Empty>
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {list.data!.data.map((w) => (
            <Card key={w.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={w.status === "ACTIVE" ? "green" : "red"}>{w.status}</Badge>
                  <span className="break-all text-sm font-medium">{w.url}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{w.events.join(", ")}</p>
              </div>
              <Button
                variant="danger"
                disabled={w.status !== "ACTIVE" || disable.isPending}
                onClick={() => disable.mutate(w.id)}
              >
                Disable
              </Button>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 font-semibold">Recent deliveries</h2>
      {deliveries.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : (deliveries.data?.data.length ?? 0) === 0 ? (
        <Empty>No deliveries yet.</Empty>
      ) : (
        <div className="space-y-2">
          {deliveries.data!.data.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    tone={
                      d.status === "SUCCESS"
                        ? "green"
                        : d.status === "DLQ" || d.status === "FAILED"
                          ? "red"
                          : "amber"
                    }
                  >
                    {d.status}
                  </Badge>
                  <span className="text-sm font-medium">{d.event}</span>
                </div>
                <span className="text-xs text-slate-500">
                  attempt {d.attempts} · {new Date(d.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 break-all text-xs text-slate-500">{d.webhook.url}</p>
              {d.lastError && <p className="mt-1 text-xs text-red-600">{d.lastError}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
