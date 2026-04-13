CREATE TABLE "oidcUserGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oidcUserGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oidcUserGrant_userId_clientId_key" ON "oidcUserGrant"("userId", "clientId");
CREATE INDEX "oidcUserGrant_clientId_idx" ON "oidcUserGrant"("clientId");
CREATE INDEX "oidcUserGrant_userId_idx" ON "oidcUserGrant"("userId");

ALTER TABLE "oidcUserGrant"
ADD CONSTRAINT "oidcUserGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
