-- CreateTable
CREATE TABLE "egg" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dockerImage" TEXT NOT NULL,
    "startup" TEXT NOT NULL DEFAULT '',
    "stopCommand" TEXT,
    "variables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "egg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "server" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "eggId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dockerImage" TEXT NOT NULL,
    "startup" TEXT NOT NULL DEFAULT '',
    "stopCommand" TEXT,
    "environment" JSONB NOT NULL,
    "memoryMiB" INTEGER NOT NULL DEFAULT 1024,
    "cpuPercent" INTEGER NOT NULL DEFAULT 100,
    "diskMiB" INTEGER NOT NULL DEFAULT 5120,
    "primaryPort" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "server_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "egg_organizationId_idx" ON "egg"("organizationId");

-- CreateIndex
CREATE INDEX "server_organizationId_idx" ON "server"("organizationId");

-- CreateIndex
CREATE INDEX "server_nodeId_idx" ON "server"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "server_nodeId_primaryPort_key" ON "server"("nodeId", "primaryPort");
