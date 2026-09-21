-- CreateTable
CREATE TABLE "device_pairings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codePrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByDeviceId" TEXT,
    "apiBaseHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pairings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairings_codeHash_key" ON "device_pairings"("codeHash");

-- CreateIndex
CREATE INDEX "device_pairings_projectId_expiresAt_idx" ON "device_pairings"("projectId", "expiresAt");

-- AddForeignKey
ALTER TABLE "device_pairings" ADD CONSTRAINT "device_pairings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
