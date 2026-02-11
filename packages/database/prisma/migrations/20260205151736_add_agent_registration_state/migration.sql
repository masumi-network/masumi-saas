-- CreateEnum
CREATE TYPE "RegistrationState" AS ENUM ('RegistrationRequested', 'RegistrationInitiated', 'RegistrationConfirmed', 'RegistrationFailed', 'DeregistrationRequested', 'DeregistrationInitiated', 'DeregistrationConfirmed', 'DeregistrationFailed');

-- AlterTable
ALTER TABLE "agent" ADD COLUMN     "registrationState" "RegistrationState" NOT NULL DEFAULT 'RegistrationConfirmed';

-- CreateIndex
CREATE INDEX "agent_registrationState_idx" ON "agent"("registrationState");
