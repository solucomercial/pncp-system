-- CreateTable
CREATE TABLE "public"."SyncLog" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);
