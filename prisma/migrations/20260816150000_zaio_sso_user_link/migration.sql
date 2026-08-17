-- AlterTable
ALTER TABLE "users" ADD COLUMN "zaioUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_zaioUserId_key" ON "users"("zaioUserId");
