-- CreateTable
CREATE TABLE "node" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "daemonVersion" TEXT,
    "dockerAvailable" BOOLEAN NOT NULL DEFAULT false,
    "cpuCores" INTEGER,
    "memoryMiB" INTEGER,
    "diskMiB" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "node_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "node_tokenHash_key" ON "node"("tokenHash");

-- CreateIndex
CREATE INDEX "node_organizationId_idx" ON "node"("organizationId");
