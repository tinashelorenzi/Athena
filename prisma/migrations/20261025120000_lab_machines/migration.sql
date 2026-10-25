-- Labs M1: student machines enrolled with the zaio agent, one-time enrolment codes,
-- the signed-request replay cache and the labs audit log (docs/labs/spec.md).
-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "machines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "productUuid" TEXT,
    "os" TEXT NOT NULL,
    "osVersion" TEXT NOT NULL,
    "osPretty" TEXT NOT NULL DEFAULT '',
    "arch" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastSeenIp" TEXT,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_enroll_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_enroll_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_request_nonces" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_request_nonces_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "lab_audit_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "machineId" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "machines_userId_idx" ON "machines"("userId");

-- CreateIndex
CREATE INDEX "machines_machineId_idx" ON "machines"("machineId");

-- CreateIndex
CREATE UNIQUE INDEX "machine_enroll_codes_codeHash_key" ON "machine_enroll_codes"("codeHash");

-- CreateIndex
CREATE INDEX "machine_enroll_codes_userId_idx" ON "machine_enroll_codes"("userId");

-- CreateIndex
CREATE INDEX "agent_request_nonces_createdAt_idx" ON "agent_request_nonces"("createdAt");

-- CreateIndex
CREATE INDEX "lab_audit_events_type_createdAt_idx" ON "lab_audit_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "lab_audit_events_userId_createdAt_idx" ON "lab_audit_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "lab_audit_events_ip_createdAt_idx" ON "lab_audit_events"("ip", "createdAt");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_enroll_codes" ADD CONSTRAINT "machine_enroll_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

