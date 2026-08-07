"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";

export default function VerifyPage() {
  const { token, projectId } = useAuth();
  const [to, setTo] = useState("+15551234567");
  const [channel, setChannel] = useState("SMS");
  const [verificationId, setVerificationId] = useState("");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string; status: string; expiresAt: string; debugCode?: string }>(
        "/verify/send",
        {
          method: "POST",
          token: token!,
          body: JSON.stringify({ to, channel, projectId }),
        }
      ),
    onSuccess: (data) => {
      setVerificationId(data.id);
      setDebugCode(data.debugCode ?? null);
      setResult(`OTP sent · status ${data.status} · expires ${new Date(data.expiresAt).toLocaleTimeString()}`);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const check = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string; status: string }>("/verify/check", {
        method: "POST",
        token: token!,
        body: JSON.stringify({ id: verificationId, code, projectId }),
      }),
    onSuccess: (data) => {
      setResult(`Verification ${data.status}`);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Verify"
        description="Send and check OTPs over SMS, WhatsApp, voice, or email."
      />

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {result && (
        <div className="mb-4">
          <Alert tone="info">{result}</Alert>
        </div>
      )}
      {debugCode && (
        <div className="mb-4">
          <Alert tone="success">
            Dev debug code: <strong className="font-mono">{debugCode}</strong>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Send OTP</h2>
          <div className="mt-4 space-y-3">
            <Field label="Destination (E.164 or email)">
              <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+15551234567" />
            </Field>
            <Field label="Channel">
              <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="VOICE">Voice</option>
                <option value="EMAIL">Email</option>
              </Select>
            </Field>
            <Button
              className="w-full"
              disabled={!projectId || send.isPending || !to.trim()}
              onClick={() => send.mutate()}
            >
              {send.isPending ? <Spinner /> : null}
              Send verification
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Check OTP</h2>
          <div className="mt-4 space-y-3">
            <Field label="Verification ID">
              <Input
                value={verificationId}
                onChange={(e) => setVerificationId(e.target.value)}
                placeholder="clx..."
              />
            </Field>
            <Field label="Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                maxLength={8}
              />
            </Field>
            <Button
              className="w-full"
              variant="secondary"
              disabled={!projectId || check.isPending || !verificationId || !code}
              onClick={() => check.mutate()}
            >
              {check.isPending ? <Spinner /> : null}
              Check code
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
