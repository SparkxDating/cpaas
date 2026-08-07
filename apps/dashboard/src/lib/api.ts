const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiError = { error?: { message?: string; code?: string } };

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function isAuthFailure(status: number, message: string): boolean {
  if (status === 401 || status === 403) return true;
  const m = message.toLowerCase();
  return (
    m.includes("invalid access token") ||
    m.includes("invalid refresh") ||
    m.includes("authentication required") ||
    m.includes("jwt")
  );
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string; apiKey?: string; skipAuthRedirect?: boolean } = {}
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  if (opts.apiKey) headers.set("x-api-key", opts.apiKey);

  const res = await fetch(`${API_URL}/v1${path}`, {
    ...opts,
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as ApiError & T;
  if (!res.ok) {
    const message = json?.error?.message ?? `Request failed (${res.status})`;
    if (isAuthFailure(res.status, message)) {
      throw new AuthError(message);
    }
    throw new Error(message);
  }
  return json as T;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cpaas_access");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cpaas_refresh");
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem("cpaas_access", access);
  localStorage.setItem("cpaas_refresh", refresh);
}

export function clearTokens() {
  localStorage.removeItem("cpaas_access");
  localStorage.removeItem("cpaas_refresh");
  localStorage.removeItem("cpaas_project_id");
  localStorage.removeItem("cpaas_org_id");
}

export function getSelectedProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cpaas_project_id");
}

export function setSelectedProjectId(id: string) {
  localStorage.setItem("cpaas_project_id", id);
}

export function getSelectedOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cpaas_org_id");
}

export function setSelectedOrgId(id: string) {
  localStorage.setItem("cpaas_org_id", id);
}

/** Try refresh token; returns new access token or null. */
export async function tryRefreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const data = await apiFetch<{
      accessToken: string;
      refreshToken: string;
    }>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: refresh }),
      skipAuthRedirect: true,
    });
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Authenticated fetch: uses access token, refreshes once on AuthError, then rethrows.
 */
export async function apiFetchAuth<T>(
  path: string,
  opts: RequestInit & { apiKey?: string } = {}
): Promise<T> {
  let token = getAccessToken();
  if (!token) throw new AuthError("Not signed in");

  try {
    return await apiFetch<T>(path, { ...opts, token });
  } catch (err) {
    if (!(err instanceof AuthError)) throw err;
    const next = await tryRefreshAccessToken();
    if (!next) throw err;
    return apiFetch<T>(path, { ...opts, token: next });
  }
}

export { API_URL };
