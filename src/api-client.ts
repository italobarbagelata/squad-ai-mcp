// Cliente HTTP con JWT y refresh automático para el squad-ai-app backend

const API_URL = process.env.SQUAD_API_URL ?? "http://localhost:8001";
const EMAIL = process.env.SQUAD_EMAIL ?? "";
const PASSWORD = process.env.SQUAD_PASSWORD ?? "";

let accessToken: string | null = null;
let refreshToken: string | null = null;

async function login(): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json() as Record<string, string>;
  accessToken = data.accessToken ?? data.access_token ?? null;
  refreshToken = data.refreshToken ?? data.refresh_token ?? null;
}

async function refreshAuth(): Promise<void> {
  if (!refreshToken) {
    await login();
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      await login();
      return;
    }
    const data = await res.json() as Record<string, string>;
    accessToken = data.accessToken ?? data.access_token ?? null;
    refreshToken = data.refreshToken ?? data.refresh_token ?? refreshToken;
  } catch {
    await login();
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!accessToken) {
    await login();
  }

  const doRequest = async (): Promise<Response> =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

  let res = await doRequest();

  if (res.status === 401) {
    await refreshAuth();
    res = await doRequest();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function ensureAuth(): Promise<void> {
  if (!accessToken) {
    await login();
  }
}
