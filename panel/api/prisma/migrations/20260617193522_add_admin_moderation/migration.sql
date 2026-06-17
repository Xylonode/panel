-- AlterTable
ALTER TABLE "addon" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "org_moderation" (
    "organizationId" TEXT NOT NULL,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_moderation_pkey" PRIMARY KEY ("organizationId")
);
