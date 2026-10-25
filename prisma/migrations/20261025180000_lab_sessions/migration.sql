-- Labs M3: lab sessions, their machines and baselines, check runs, the agent task
-- queue, and the submission → lab session link (docs/labs/spec.md section 8).
-- CreateEnum
CREATE TYPE "LabSessionStatus" AS ENUM ('PREPARING', 'ACTIVE', 'ENDING', 'ENDED', 'EXPIRED', 'ABORTED');

-- CreateEnum
CREATE TYPE "CheckRunStatus" AS ENUM ('COLLECTING', 'GRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentTaskKind" AS ENUM ('BASELINE', 'COLLECT', 'UNDO');

-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'DELIVERED', 'DONE', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "labSessionId" TEXT;

-- CreateTable
CREATE TABLE "lab_sessions" (
    "id" TEXT NOT NULL,
    "labVersionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "LabSessionStatus" NOT NULL DEFAULT 'PREPARING',
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,

    CONSTRAINT "lab_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_session_machines" (
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "baseline" JSONB,

    CONSTRAINT "lab_session_machines_pkey" PRIMARY KEY ("sessionId","role")
);

-- CreateTable
CREATE TABLE "lab_check_runs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "final" BOOLEAN NOT NULL DEFAULT false,
    "status" "CheckRunStatus" NOT NULL DEFAULT 'COLLECTING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "result" JSONB,
    "score" INTEGER,
    "maxScore" INTEGER,
    "graderRev" TEXT,

    CONSTRAINT "lab_check_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "sessionId" TEXT,
    "checkRunId" TEXT,
    "role" TEXT,
    "kind" "AgentTaskKind" NOT NULL,
    "bundle" BYTEA NOT NULL,
    "signature" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_sessions_userId_status_idx" ON "lab_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "lab_sessions_labVersionId_idx" ON "lab_sessions"("labVersionId");

-- CreateIndex
CREATE INDEX "lab_session_machines_machineId_idx" ON "lab_session_machines"("machineId");

-- CreateIndex
CREATE INDEX "lab_check_runs_sessionId_requestedAt_idx" ON "lab_check_runs"("sessionId", "requestedAt");

-- CreateIndex
CREATE INDEX "agent_tasks_machineId_status_idx" ON "agent_tasks"("machineId", "status");

-- CreateIndex
CREATE INDEX "agent_tasks_sessionId_idx" ON "agent_tasks"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_labSessionId_key" ON "submissions"("labSessionId");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_labSessionId_fkey" FOREIGN KEY ("labSessionId") REFERENCES "lab_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_sessions" ADD CONSTRAINT "lab_sessions_labVersionId_fkey" FOREIGN KEY ("labVersionId") REFERENCES "lab_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_sessions" ADD CONSTRAINT "lab_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_session_machines" ADD CONSTRAINT "lab_session_machines_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "lab_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_session_machines" ADD CONSTRAINT "lab_session_machines_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_check_runs" ADD CONSTRAINT "lab_check_runs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "lab_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "lab_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_checkRunId_fkey" FOREIGN KEY ("checkRunId") REFERENCES "lab_check_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

