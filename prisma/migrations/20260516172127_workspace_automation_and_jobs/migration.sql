-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "filterQs" TEXT,
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkspaceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "aiProvider" TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "aiBaseUrl" TEXT,
    "aiModel" TEXT,
    "aiApiKeyCiphertext" TEXT,
    "aiApiKeyUpdatedAt" DATETIME,
    "autoIngestEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoIngestIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "lastScheduledIngestAt" DATETIME,
    "digestWebhookUrl" TEXT,
    "digestWebhookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WorkspaceSettings" ("aiApiKeyCiphertext", "aiApiKeyUpdatedAt", "aiBaseUrl", "aiModel", "aiProvider", "createdAt", "id", "plan", "updatedAt") SELECT "aiApiKeyCiphertext", "aiApiKeyUpdatedAt", "aiBaseUrl", "aiModel", "aiProvider", "createdAt", "id", "plan", "updatedAt" FROM "WorkspaceSettings";
DROP TABLE "WorkspaceSettings";
ALTER TABLE "new_WorkspaceSettings" RENAME TO "WorkspaceSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BackgroundJob_kind_status_createdAt_idx" ON "BackgroundJob"("kind", "status", "createdAt");
