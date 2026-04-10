/**
 * When an agent row is allowed to call payment-node income APIs.
 * Keep in sync with GET /api/agents/[agentId]/earnings.
 */
export const REGISTRATION_STATES_WITH_PAYMENT_INCOME = new Set([
  "RegistrationConfirmed",
  "DeregistrationRequested",
  "DeregistrationInitiated",
  "DeregistrationConfirmed",
  "DeregistrationFailed",
]);

export function agentHasPaymentIncomeData(agent: {
  agentIdentifier: string | null;
  registrationState: string;
}): boolean {
  return (
    !!agent.agentIdentifier &&
    REGISTRATION_STATES_WITH_PAYMENT_INCOME.has(agent.registrationState)
  );
}
