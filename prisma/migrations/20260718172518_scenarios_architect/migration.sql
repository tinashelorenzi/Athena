-- CreateEnum
CREATE TYPE "ScenarioType" AS ENUM ('DOJO', 'ASSESSMENT');

-- CreateEnum
CREATE TYPE "Exposure" AS ENUM ('ROLLOUT', 'PUBLIC');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isArchitect" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "type" "ScenarioType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "exposure" "Exposure" NOT NULL DEFAULT 'ROLLOUT',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "brief" TEXT NOT NULL DEFAULT '',
    "objectives" JSONB,
    "flags" JSONB,
    "reportRequired" BOOLEAN NOT NULL DEFAULT false,
    "reportPrompt" TEXT,
    "logs" JSONB,
    "alerts" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_endpoints" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "edr" JSONB,
    "osquery" JSONB,
    "artifactKey" TEXT,
    "artifactName" TEXT,
    "artifactSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenarios_type_idx" ON "scenarios"("type");

-- CreateIndex
CREATE INDEX "scenario_endpoints_scenarioId_idx" ON "scenario_endpoints"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_endpoints_scenarioId_hostname_key" ON "scenario_endpoints"("scenarioId", "hostname");

-- AddForeignKey
ALTER TABLE "scenario_endpoints" ADD CONSTRAINT "scenario_endpoints_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
