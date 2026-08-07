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

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  environment: string;
  status: string;
  scopes: string[];
  rateLimitRpm: number | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function KeysPage() {
  const { token, projectId } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("Dashboard key");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keys = useQuery({
    queryKey: ["api-keys", token, projectId],
    enabled: !!token && !!projectId,
    queryFn: () =>
      apiFetch<{ data: ApiKeyRow[] }>(
        `/api-keys?projectId=${encodeURIComponent(projectId!)}`,
        { token: token! }
      ),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<{ secret: string; id: string; name: string }>("/api-keys", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ name, projectId }),
      }),
    onSuccess: (data) => {
      setCreatedSecret(data.secret);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const rotate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ secret: string }>(
        `/api-keys/${id}/rotate?projectId=${encodeURIComponent(projectId!)}`,
        { method: "POST", token: token! }
      ),
    onSuccess: (data) => {
      setCreatedSecret(data.secret);
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const disable = useMutation({
    mutationFn: (id: string) =>
      apiFetch(
        `/api-keys/${id}/disable?projectId=${encodeURIComponent(projectId!)}`,
        { method: "POST", token: token! }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["api-keys"] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <PageHeader
        title="API Keys"
        description="Create, rotate, and disable project API keys (sk_test_ / sk_live_)."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {createdSecret && (
        <div className="mb-4">
          <Alert tone="success">
            <p className="font-semibold">Copy this secret now — it won’t be shown again.</p>
            <code className="mt-2 block break-all rounded-lg bg-black/5 p-2 text-xs dark:bg-white/10">
              {createdSecret}
            </code>
            <Button
              variant="secondary"
              className="mt-2"
              type="button"
              onClick={() => void navigator.clipboard.writeText(createdSecret)}
            >
              Copy to clipboard
            </Button>
          </Alert>
        </div>
      )}

      <Card className="mb-6">
        <h2 className="font-semibold">Create key</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button
            disabled={!projectId || create.isPending || !name.trim()}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Spinner /> : null}
            Create key
          </Button>
        </div>
      </Card>

      {keys.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading keys…
        </div>
      ) : keys.isError ? (
        <Empty>{(keys.error as Error).message}</Empty>
      ) : (keys.data?.data.length ?? 0) === 0 ? (
        <Empty>No API keys yet.</Empty>
      ) : (
        <div className="space-y-3">
          {keys.data!.data.map((k) => (
            <Card key={k.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{k.name}</p>
                  <Badge tone={k.status === "ACTIVE" ? "green" : "red"}>{k.status}</Badge>
                  <Badge tone="blue">{k.environment}</Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {k.prefix}…{k.lastFour}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Created {new Date(k.createdAt).toLocaleString()}
                  {k.lastUsedAt
                    ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}`
                    : " · Never used"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={k.status !== "ACTIVE" || rotate.isPending}
                  onClick={() => rotate.mutate(k.id)}
                >
                  Rotate
                </Button>
                <Button
                  variant="danger"
                  disabled={k.status !== "ACTIVE" || disable.isPending}
                  onClick={() => disable.mutate(k.id)}
                >
                  Disable
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
