/**
 * OWNER: UI
 * WHAT: The ONLY way this division reaches the server. Typed fetch + error normalisation.
 * RULE: No direct fetch() calls in components.
 *       Unwraps the API response envelope { status, statusCode, data } automatically.
 */

export interface ApiEnvelope<T> {
  status: boolean;
  statusCode: number;
  data: T;
  message?: string;
  error?: {
    code: string;
    details?: unknown;
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code = "UNKNOWN_ERROR", details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const ADMIN_TOKEN_KEY = "aspg.adminToken";

/**
 * A deployed guard refuses ADMIN without `Authorization: Bearer <ASPG_ADMIN_TOKEN>`, so freezing an
 * agent or approving a held payment needs the token in the browser. It is deliberately NOT a
 * NEXT_PUBLIC_ variable: that would bake it into every bundle and hand it to every visitor.
 *
 * The operator arrives once at `?admin=<token>`; it moves to sessionStorage and is stripped from
 * the URL so it does not survive in the address bar, a screenshot, or a copied link. Everyone else
 * gets a read-only dashboard, which is the correct default for a public demo.
 */
export function readAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("admin");
    if (fromUrl) {
      window.sessionStorage.setItem(ADMIN_TOKEN_KEY, fromUrl);
      url.searchParams.delete("admin");
      window.history.replaceState(null, "", url.toString());
      return fromUrl;
    }
    return window.sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    // Private-browsing sessionStorage throws. A read-only dashboard is the safe degradation.
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  const adminToken = readAdminToken();
  if (adminToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${adminToken}`);
  }

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers,
    });
  } catch (error) {
    throw new ApiClientError(
      error instanceof Error ? error.message : "Network error occurred",
      0,
      "NETWORK_ERROR"
    );
  }

  let json: ApiEnvelope<T>;
  try {
    json = (await response.json()) as ApiEnvelope<T>;
  } catch {
    if (!response.ok) {
      throw new ApiClientError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        "HTTP_ERROR"
      );
    }
    // If not JSON and was 2xx (rare)
    return null as T;
  }

  if (!response.ok || json.status === false) {
    const message = json.message || `Request failed with status ${json.statusCode || response.status}`;
    const code = json.error?.code || "API_ERROR";
    const details = json.error?.details;
    throw new ApiClientError(message, json.statusCode || response.status, code, details);
  }

  return json.data;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "GET",
  });
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  return request<T>(path, {
    ...init,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
