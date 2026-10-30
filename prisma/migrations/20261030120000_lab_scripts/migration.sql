-- CreateTable
CREATE TABLE "lab_scripts" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_script_links" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastFetchedAt" TIMESTAMP(3),
    "fetchCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lab_script_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lab_scripts_labId_name_key" ON "lab_scripts"("labId", "name");

-- CreateIndex
CREATE INDEX "lab_script_links_userId_idx" ON "lab_script_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_script_links_scriptId_userId_key" ON "lab_script_links"("scriptId", "userId");

-- AddForeignKey
ALTER TABLE "lab_scripts" ADD CONSTRAINT "lab_scripts_labId_fkey" FOREIGN KEY ("labId") REFERENCES "labs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_script_links" ADD CONSTRAINT "lab_script_links_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "lab_scripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_script_links" ADD CONSTRAINT "lab_script_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

