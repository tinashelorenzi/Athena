-- Link Athena cohorts to Zaio bootcamp records for LMS provisioning.
ALTER TABLE "cohorts" ADD COLUMN "zaioBootcampId" TEXT;

CREATE UNIQUE INDEX "cohorts_zaioBootcampId_key" ON "cohorts"("zaioBootcampId");
