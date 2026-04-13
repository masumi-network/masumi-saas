# Dashboard earnings (`GET /api/earnings`)

## Behavior

The dashboard **Earnings** card shows withdrawn seller income for the selected payment network and period.

The payment-node `POST /payment/income` endpoint accepts `agentIdentifier: null` to return **aggregate income for the entire payment source** (all agents using that wallet / API key scope). That made the dashboard show earnings that did not belong to the current user’s Masumi agents when others shared the same deployment or source.

## Current implementation (temporary)

For each request we:

1. Load the authenticated user’s **agents** scoped to the requested network (agent row `networkIdentifier`, or `AgentReference.networkIdentifier` when the agent row is still unset — not “any `null` on every network”).
2. Keep only agents that are **on-chain and eligible for income** (same rules as `GET /api/agents/[agentId]/earnings`: `agentIdentifier` set and registration state in the confirmed/deregistration set).
3. Call `getPaymentIncome` **once per eligible agent** with that agent’s `agentIdentifier`, then **merge** `TotalIncome.Units` and `DailyIncome` in process memory.

So the card reflects **sum of income for the user’s agents only**, not the whole payment source.

## Tradeoffs

- **Pros:** Correct attribution; no payment-node API change required.
- **Cons:** **O(n)** upstream calls per dashboard load (`n` = eligible agents). This may warrant a batched or aggregated endpoint on the payment service later, or caching, if `n` grows large.

## Related code

- Route: `apps/web/src/app/api/earnings/route.ts`
- Eligibility: `apps/web/src/lib/agents/agent-earnings-eligibility.ts`
- Merge helpers: `apps/web/src/lib/earnings/aggregate-dashboard-payment-income.ts`
