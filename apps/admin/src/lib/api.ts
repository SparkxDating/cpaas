const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ApiError = { error?: { message?: string } };

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function apiFetch<T>(
  path: string,
  opts: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("content-type", "application/json");
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);

  const res = await fetch(`${API_URL}/v1${path}`, { ...opts, headers });
  const json = (await res.json().catch(() => ({}))) as ApiError & T;
  if (!res.ok) {
    const msg = json?.error?.message ?? `Request failed (${res.status})`;
    if (res.status === 401 || /token|auth|unauthorized/i.test(msg)) {
      throw new AuthError(msg);
    }
    throw new Error(msg);
  }
  return json as T;
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cpaas_admin_token");
}

export function setAdminToken(token: string) {
  localStorage.setItem("cpaas_admin_token", token);
}

export function clearAdminToken() {
  localStorage.removeItem("cpaas_admin_token");
}

export async function apiFetchAdmin<T>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new AuthError("Not signed in");
  return apiFetch<T>(path, { ...opts, token });
}

export { API_URL };
