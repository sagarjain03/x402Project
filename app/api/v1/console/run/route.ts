/**
 * OWNER: DEMO
 * ROUTE: POST /api/v1/console/run — streams one Agent Console run as NDJSON.
 * Node runtime: the run signs payments and talks to Postgres.
 * force-dynamic: the response is a stream and must never be cached or statically analysed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/demo/handlers/agent-run";
