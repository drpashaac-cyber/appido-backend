# Wiring the frontends to the backend (P2)

The backend exposes the data plane; the frontends consume it via `httpApi.ts`
(cookie auth, `credentials:"include"`). Set `VITE_API_BASE_URL=https://api.appido.io`
(or `http://localhost:8080` in dev), and add that origin to the API `CORS_ORIGINS`.

## Owner console (has a clean `Api` seam)
`OwnerConsole({ api })` already accepts an injected API. Provide an adapter that
satisfies its `{ data(): Promise<AppData>; me(): Promise<Me> }` contract:

```ts
// src/httpApiAdapter.ts
import { HttpApi } from "./httpApi";
const http = new HttpApi(import.meta.env.VITE_API_BASE_URL);

export const api = {
  me: () => http.me(),               // GET /me  → { id, email, name, role, ... }
  data: async () => {
    const overview = await http.ownerOverview(); // real platform metrics
    return { ...overview };          // map fields into AppData as widgets are wired
  },
};
```
```tsx
// main.tsx
import { api } from "./httpApiAdapter";
<OwnerConsole api={api} />
```
Core platform metrics (tenants, MRR, GMV, AI tokens, recent activity) are live now;
the remaining console arrays are mapped one-to-one as each endpoint lands (P3–P6).

## Tenant dashboard
Use the client directly in a data hook (or TanStack Query):
```ts
const http = new HttpApi(import.meta.env.VITE_API_BASE_URL);
const summary = await http.dashboardSummary(); // channels, customers, GMV, MRR, AI tokens
const { items, nextCursor } = await http.customers(25);
const products = await http.products();
const txns = await http.transactions(25);
const usage = await http.usage();
```
Replace the `seed.ts` reads with these calls behind your existing view components.

## Live updates (realtime)
Subscribe to the SSE stream and refetch/patch on push:
```ts
const es = new EventSource(`${BASE}/realtime/stream?channel=${tenantId}`, { withCredentials: true });
es.addEventListener("message.created", () => refetchInbox());
es.addEventListener("payment.confirmed", () => refetchTransactions());
```
(P1 scopes by `?channel=`; once auth-scoped SSE lands the param is dropped.)

## Endpoint map
| Frontend need | Endpoint |
|---|---|
| who am I / session | `GET /me`, `GET /session` |
| owner overview | `GET /v1/owner/overview` |
| customers (paged) | `GET /v1/customers?limit&cursor` |
| customer + timeline | `GET /v1/customers/:id` |
| products | `GET /v1/products` |
| transactions (paged) | `GET /v1/transactions?limit&cursor` |
| inbox | `GET /v1/inbox?limit` |
| AI token usage | `GET /v1/usage` |
| dashboard summary | `GET /v1/dashboard/summary` |
| landing event | `POST /api/track` |

Full interactive contract: **`/docs`** (OpenAPI/Swagger).
