CREATE TABLE "email_send_rate_limit" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_send_rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_send_rate_limit_email_key" ON "email_send_rate_limit"("email");
