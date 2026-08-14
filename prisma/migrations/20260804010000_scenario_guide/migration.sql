-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "guide" TEXT,
ADD COLUMN     "guideAssets" JSONB,
ADD COLUMN     "guidePrompts" JSONB;

-- CreateTable
CREATE TABLE "guide_prompt_solves" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_prompt_solves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_prompt_solves_studentId_idx" ON "guide_prompt_solves"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "guide_prompt_solves_scenarioId_studentId_promptId_key" ON "guide_prompt_solves"("scenarioId", "studentId", "promptId");

-- AddForeignKey
ALTER TABLE "guide_prompt_solves" ADD CONSTRAINT "guide_prompt_solves_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_prompt_solves" ADD CONSTRAINT "guide_prompt_solves_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
