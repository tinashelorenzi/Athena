-- CreateTable
CREATE TABLE "mcp_uploads" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "result" JSONB,
    "scenarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_uploads_tokenHash_key" ON "mcp_uploads"("tokenHash");

-- CreateIndex
CREATE INDEX "mcp_uploads_userId_idx" ON "mcp_uploads"("userId");

-- AddForeignKey
ALTER TABLE "mcp_uploads" ADD CONSTRAINT "mcp_uploads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

