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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

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
