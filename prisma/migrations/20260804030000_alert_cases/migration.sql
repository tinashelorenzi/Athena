-- DropTable (feed is now computed on-demand; no per-student materialization)
DROP TABLE IF EXISTS "run_events";

-- DropEnum
DROP TYPE IF EXISTS "RunEventKind";

-- AlterTable
ALTER TABLE "scenario_runs" DROP COLUMN IF EXISTS "feedCursor";

-- CreateEnum
CREATE TYPE "AlertVerdict" AS ENUM ('TRUE_POSITIVE', 'FALSE_POSITIVE', 'BENIGN', 'ESCALATED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "alert_cases" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "verdict" "AlertVerdict",
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "iocs" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_cases_studentId_idx" ON "alert_cases"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "alert_cases_scenarioId_studentId_alertId_key" ON "alert_cases"("scenarioId", "studentId", "alertId");

-- AddForeignKey
ALTER TABLE "alert_cases" ADD CONSTRAINT "alert_cases_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_cases" ADD CONSTRAINT "alert_cases_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
