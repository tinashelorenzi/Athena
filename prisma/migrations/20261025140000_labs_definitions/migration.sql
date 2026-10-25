-- Labs M2: LAB scenario kind, lab definitions (immutable versions) and stored
-- per-student parameters (docs/labs/spec.md sections 4, 5, 9.2).
-- CreateEnum
CREATE TYPE "ScenarioKind" AS ENUM ('SOC', 'LAB');

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "kind" "ScenarioKind" NOT NULL DEFAULT 'SOC';

-- CreateTable
CREATE TABLE "labs" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_versions" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "zcl" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "assets" JSONB NOT NULL,
    "gate" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_params" (
    "labId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_params_pkey" PRIMARY KEY ("labId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "labs_scenarioId_key" ON "labs"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "labs_slug_key" ON "labs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lab_versions_labId_version_key" ON "lab_versions"("labId", "version");

-- CreateIndex
CREATE INDEX "lab_params_labId_idx" ON "lab_params"("labId");

-- AddForeignKey
ALTER TABLE "labs" ADD CONSTRAINT "labs_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_versions" ADD CONSTRAINT "lab_versions_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_params" ADD CONSTRAINT "lab_params_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_params" ADD CONSTRAINT "lab_params_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

