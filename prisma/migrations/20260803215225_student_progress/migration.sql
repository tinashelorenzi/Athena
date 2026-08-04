-- CreateTable
CREATE TABLE "scenario_progress" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenario_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenario_progress_studentId_idx" ON "scenario_progress"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_progress_scenarioId_studentId_key" ON "scenario_progress"("scenarioId", "studentId");

-- AddForeignKey
ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_progress" ADD CONSTRAINT "scenario_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
