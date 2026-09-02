// Tek canonical backend kaynağı: production Cloudflare Worker (admin.safiradestan.com).
// Yeni ayrı bir mobil veritabanı/backend YOK - aynı D1/KV altyapısı.
export const API_BASE = "https://admin.safiradestan.com/api/mobile/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class SessionExpiredError extends ApiError {
  constructor() {
    super(401, "Oturum süresi doldu.");
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Ağ bağlantısı yok.");
  }

  if (response.status === 401) {
    throw new SessionExpiredError();
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? "İstek başarısız oldu.");
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Login/health, auth header olmadan (login henüz token üretmedi, health public).
export async function loginRequest(password: string, deviceLabel: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, deviceLabel }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data?.error ?? "Giriş başarısız.");
  return data as { ok: true; token: string; expiresIn: number };
}

export async function logoutRequest(): Promise<void> {
  if (!authToken) return;
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch {
    // Sunucu tarafı revoke başarısız olsa bile cihazdaki token'ı silmek önceliklidir - AuthContext bunu ayrıca yapar.
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
