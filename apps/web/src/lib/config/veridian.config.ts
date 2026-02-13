export const veridianConfig = {
  credentialServerUrl: process.env.VERIDIAN_CREDENTIAL_SERVER_URL,
  agentVerificationSchemaSaid:
    process.env.VERIDIAN_AGENT_VERIFICATION_SCHEMA_SAID,
  keriaUrl: process.env.VERIDIAN_KERIA_URL,
} as const;
