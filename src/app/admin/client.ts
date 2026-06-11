/** Tiny client-side helpers for the admin UI (CSRF header + JSON fetch). */

export function getCsrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)(?:__Host-)?csrf=([^;]+)/);
  return m?.[1] ?? "";
}

export interface ApiError { status: number; message: string; retryAfter?: string | null }

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": getCsrfToken(),
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw {
      status: res.status,
      message: data?.error?.message ?? "Something went wrong. Please try again.",
      retryAfter: res.headers.get("Retry-After"),
    } satisfies ApiError;
  }
  return res.json() as Promise<T>;
}
