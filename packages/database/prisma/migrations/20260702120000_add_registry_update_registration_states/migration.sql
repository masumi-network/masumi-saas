-- Align SaaS RegistrationState with payment-node registry update lifecycle.
ALTER TYPE "RegistrationState" ADD VALUE IF NOT EXISTS 'UpdateRequested';
ALTER TYPE "RegistrationState" ADD VALUE IF NOT EXISTS 'UpdateInitiated';
ALTER TYPE "RegistrationState" ADD VALUE IF NOT EXISTS 'UpdateConfirmed';
ALTER TYPE "RegistrationState" ADD VALUE IF NOT EXISTS 'UpdateFailed';
