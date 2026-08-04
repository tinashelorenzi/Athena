-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunEventKind" AS ENUM ('ALERT', 'LOG');

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "refToken" TEXT;

-- CreateTable
CREATE TABLE "scenario_runs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runningSince" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "feedCursor" INTEGER NOT NULL DEFAULT 0,
    "lastTickAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" "RunEventKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "atSeconds" INTEGER NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "run_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenario_runs_status_idx" ON "scenario_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_runs_scenarioId_studentId_key" ON "scenario_runs"("scenarioId", "studentId");

-- CreateIndex
CREATE INDEX "run_events_runId_idx" ON "run_events"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "run_events_runId_kind_refId_key" ON "run_events"("runId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_refToken_key" ON "scenarios"("refToken");

-- AddForeignKey
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_runs" ADD CONSTRAINT "scenario_runs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "scenario_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

