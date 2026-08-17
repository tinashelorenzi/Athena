-- AlterTable
ALTER TABLE "users" ADD COLUMN "studentNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_studentNumber_key" ON "users"("studentNumber");
