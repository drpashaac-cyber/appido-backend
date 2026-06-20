// Drop-in API client for the APPIDO frontends (owner console + dashboard).
// Cookie-based auth (httpOnly session) → credentials:"include". Point it at
// VITE_API_BASE_URL (e.g. https://api.appido.io). See INTEGRATION.md.
export class HttpApi {
  constructor(private readonly baseUrl: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      credentials: "include",
      headers: { "content-type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        /* non-JSON error */
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  // auth
  loginStart(email: string) {
    return this.req("/auth/login/start", { method: "POST", body: JSON.stringify({ email }) });
  }
  loginPassword(email: string, password: string) {
    return this.req("/auth/login/password", { method: "POST", body: JSON.stringify({ email, password }) });
  }
  loginCode(email: string, code: string) {
    return this.req("/auth/login/code", { method: "POST", body: JSON.stringify({ email, code }) });
  }
  logout() {
    return this.req("/auth/logout", { method: "POST" });
  }
  me<T = unknown>() {
    return this.req<T>("/me");
  }
  session<T = unknown>() {
    return this.req<T>("/session");
  }

  // owner console
  ownerOverview<T = unknown>() {
    return this.req<T>("/v1/owner/overview");
  }

  // tenant dashboard
  customers<T = unknown>(limit?: number, cursor?: string) {
    return this.req<T>(`/v1/customers${qs({ limit, cursor })}`);
  }
  customer<T = unknown>(id: string) {
    return this.req<T>(`/v1/customers/${id}`);
  }
  products<T = unknown>() {
    return this.req<T>("/v1/products");
  }
  transactions<T = unknown>(limit?: number, cursor?: string) {
    return this.req<T>(`/v1/transactions${qs({ limit, cursor })}`);
  }
  inbox<T = unknown>(limit?: number) {
    return this.req<T>(`/v1/inbox${qs({ limit })}`);
  }
  usage<T = unknown>() {
    return this.req<T>("/v1/usage");
  }
  dashboardSummary<T = unknown>() {
    return this.req<T>("/v1/dashboard/summary");
  }

  // landing
  track(name: string, props?: Record<string, unknown>, anonId?: string) {
    return this.req("/api/track", { method: "POST", body: JSON.stringify({ name, props, anonId }) });
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
