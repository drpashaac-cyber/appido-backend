import { HealthController } from "./health.controller";

const fakeDb = { pool: { query: async () => ({}) } } as never;
const c = new HealthController(fakeDb);
void c;
