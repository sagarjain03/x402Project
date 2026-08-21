/**
 * OWNER: UI
 * WHAT: Every server path this division is allowed to call, in one place.
 *       If a path is not here, the UI does not call it.
 */
export const API = {
  metrics: "/api/v1/metrics/summary",
  agents: "/api/v1/agents",
  agent: (id: string) => `/api/v1/agents/${id}`,
  freeze: (id: string) => `/api/v1/agents/${id}/freeze`,
  policies: "/api/v1/policies",
  policy: (agentId: string) => `/api/v1/policies/${agentId}`,
  policyVersions: (agentId: string) => `/api/v1/policies/${agentId}/versions`,
  policySimulate: (agentId: string) => `/api/v1/policies/${agentId}/simulate`,
  merchants: "/api/v1/merchants",
  transactions: "/api/v1/transactions",
  transaction: (id: string) => `/api/v1/transactions/${id}`,
  budgets: (agentId: string) => `/api/v1/budgets/${agentId}`,
  walletBalances: "/api/v1/wallets/balances",
  approvals: "/api/v1/approvals",
  approve: (id: string) => `/api/v1/approvals/${id}/approve`,
  reject: (id: string) => `/api/v1/approvals/${id}/reject`,
  audit: "/api/v1/audit",
  auditVerify: "/api/v1/audit/verify",
  events: "/api/v1/events/stream",
  simulatorRun: "/api/v1/simulator/run",
  consoleRun: "/api/v1/console/run",
} as const;
