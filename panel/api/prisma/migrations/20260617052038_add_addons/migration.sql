-- CreateTable
CREATE TABLE "addon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "wasm" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_install" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "grantedScopes" JSONB NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_install_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_kv" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_kv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addon_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addon_install_organizationId_idx" ON "addon_install"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "addon_install_organizationId_addonId_key" ON "addon_install"("organizationId", "addonId");

-- CreateIndex
CREATE UNIQUE INDEX "addon_kv_organizationId_addonId_key_key" ON "addon_kv"("organizationId", "addonId", "key");

-- CreateIndex
CREATE INDEX "addon_log_organizationId_addonId_idx" ON "addon_log"("organizationId", "addonId");
