export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://notimed-backend-production.up.railway.app";
// Use your LAN IP for real device, e.g. http://192.168.x.x:8080
export type ApiErrorShape = {
  error?: string;
  message?: string;
  status?: number;
};

function buildUrl(path: string) {
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function safeJson(obj: unknown) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export async function http<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const url = buildUrl(path);

  const headers = new Headers(init.headers);

  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
  }

  const method = (init.method ?? "GET").toUpperCase();

  // ---- REQUEST LOG
  console.log(`[API] ${method} ${url}`);
  if (init.json !== undefined) {
    console.log(`[API] request body:\n${safeJson(init.json)}`);
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text();

  // ---- RESPONSE LOG
  console.log(`[API] ${method} ${url} -> ${res.status}`);
  console.log(`[API] response:\n${safeJson(payload)}`);

  if (!res.ok) {
    const apiErr: ApiErrorShape | null =
      typeof payload === "object" && payload ? (payload as any) : null;

    const msg =
      apiErr?.message ||
      apiErr?.error ||
      (typeof payload === "string" && payload) ||
      `Request failed (${res.status})`;

    console.log(`[API] error message: ${msg}`);
    throw new Error(msg);
  }

  return payload as T;
}
