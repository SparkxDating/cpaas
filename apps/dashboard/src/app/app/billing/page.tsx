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

type Txn = {
  id: string;
  type: string;
  amountMinor: string;
  balanceAfter: string;
  currency: string;
  description: string | null;
  createdAt: string;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  totalMinor: string;
  currency: string;
  createdAt: string;
};

export default function BillingPage() {
  const { token, orgId } = useAuth();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const wallet = useQuery({
    queryKey: ["wallet", token, orgId],
    enabled: !!token && !!orgId,
    queryFn: () =>
      apiFetch<{ balanceMinor: string; holdMinor: string; currency: string }>(
        "/billing/wallet",
        { token: token! }
      ),
  });

  const txns = useQuery({
    queryKey: ["wallet-txns", token, orgId],
    enabled: !!token && !!orgId,
    queryFn: () =>
      apiFetch<{ data: Txn[] }>("/billing/transactions", { token: token! }),
  });

  const invoices = useQuery({
    queryKey: ["invoices", token, orgId],
    enabled: !!token && !!orgId,
    queryFn: () =>
      apiFetch<{ data: Invoice[] }>("/billing/invoices", { token: token! }),
  });

  const recharge = useMutation({
    mutationFn: () => {
      const dollars = Number(amount);
      if (!Number.isFinite(dollars) || dollars <= 0) {
        throw new Error("Enter a positive amount in dollars");
      }
      const amountMinor = Math.round(dollars * 100);
      return apiFetch<{ balanceMinor: string }>("/billing/wallet/recharge", {
        method: "POST",
        token: token!,
        body: JSON.stringify({
          amountMinor,
          organizationId: orgId,
          reference: `dashboard-${Date.now()}`,
        }),
      });
    },
    onSuccess: (w) => {
      setOk(`Wallet recharged. New balance: $${(Number(w.balanceMinor) / 100).toFixed(2)}`);
      setError(null);
      void qc.invalidateQueries({ queryKey: ["wallet"] });
      void qc.invalidateQueries({ queryKey: ["wallet-txns"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const balance = wallet.data
    ? (Number(wallet.data.balanceMinor) / 100).toFixed(2)
    : "—";

  return (
    <div>
      <PageHeader
        title="Billing"
        description="Wallet balance, recharges, transactions, and invoices."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {ok && (
        <div className="mb-4">
          <Alert tone="success">{ok}</Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Wallet balance
          </p>
          {wallet.isLoading ? (
            <div className="mt-4">
              <Spinner />
            </div>
          ) : (
            <>
              <p className="mt-2 text-4xl font-bold">${balance}</p>
              <p className="mt-1 text-sm text-slate-500">
                {wallet.data?.currency ?? "USD"} · hold $
                {wallet.data
                  ? (Number(wallet.data.holdMinor) / 100).toFixed(2)
                  : "0.00"}
              </p>
            </>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Recharge (dev / manual)</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Amount (USD)">
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </div>
            <Button
              disabled={!orgId || recharge.isPending}
              onClick={() => recharge.mutate()}
            >
              {recharge.isPending ? <Spinner /> : null}
              Add funds
            </Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Transactions</h2>
      {txns.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : (txns.data?.data.length ?? 0) === 0 ? (
        <Empty>No transactions yet.</Empty>
      ) : (
        <div className="space-y-2">
          {txns.data!.data.map((t) => (
            <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={t.type === "CREDIT" ? "green" : "amber"}>{t.type}</Badge>
                <span className="text-sm">{t.description ?? "—"}</span>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">
                  {t.type === "DEBIT" ? "−" : "+"}$
                  {(Number(t.amountMinor) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-slate-500">
                  bal ${(Number(t.balanceAfter) / 100).toFixed(2)} ·{" "}
                  {new Date(t.createdAt).toLocaleString()}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Invoices</h2>
      {invoices.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      ) : (invoices.data?.data.length ?? 0) === 0 ? (
        <Empty>No invoices yet.</Empty>
      ) : (
        <div className="space-y-2">
          {invoices.data!.data.map((inv) => (
            <Card key={inv.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{inv.number}</p>
                <p className="text-xs text-slate-500">
                  {new Date(inv.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <Badge>{inv.status}</Badge>
                <p className="mt-1 font-semibold">
                  ${(Number(inv.totalMinor) / 100).toFixed(2)} {inv.currency}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
