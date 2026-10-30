-- CreateEnum
CREATE TYPE "ApiKeyKind" AS ENUM ('INTEGRATION', 'MCP');

-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN     "kind" "ApiKeyKind" NOT NULL DEFAULT 'INTEGRATION',
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "api_keys_userId_idx" ON "api_keys"("userId");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

