-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
VALUES ('legacy-local', 'Local workspace', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRefreshAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastRefreshError" TEXT,
    "lastItemCount" INTEGER NOT NULL DEFAULT 0,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Source_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Source" ("id", "workspaceId", "type", "url", "title", "enabled", "lastRefreshAt", "lastSuccessAt", "lastRefreshError", "lastItemCount", "healthStatus", "createdAt", "updatedAt")
SELECT "id", 'legacy-local', "type", "url", "title", "enabled", "lastRefreshAt", "lastSuccessAt", "lastRefreshError", "lastItemCount", "healthStatus", "createdAt", "updatedAt" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";

CREATE TABLE "new_IntelligenceDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'daily',
    "title" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "digestMd" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceDigest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IntelligenceDigest" ("id", "workspaceId", "kind", "title", "model", "digestMd", "stats", "createdAt")
SELECT "id", 'legacy-local', "kind", "title", "model", "digestMd", "stats", "createdAt" FROM "IntelligenceDigest";
DROP TABLE "IntelligenceDigest";
ALTER TABLE "new_IntelligenceDigest" RENAME TO "IntelligenceDigest";

CREATE TABLE "new_BackgroundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "filterQs" TEXT,
    "payload" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BackgroundJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BackgroundJob" ("id", "workspaceId", "kind", "status", "progress", "total", "message", "filterQs", "payload", "createdAt", "updatedAt")
SELECT "id", 'legacy-local', "kind", "status", "progress", "total", "message", "filterQs", "payload", "createdAt", "updatedAt" FROM "BackgroundJob";
DROP TABLE "BackgroundJob";
ALTER TABLE "new_BackgroundJob" RENAME TO "BackgroundJob";

CREATE TABLE "new_WorkspaceSettings" (
    "workspaceId" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkspaceSettings" ("workspaceId", "plan", "aiProvider", "aiBaseUrl", "aiModel", "aiApiKeyCiphertext", "aiApiKeyUpdatedAt", "autoIngestEnabled", "autoIngestIntervalMinutes", "lastScheduledIngestAt", "digestWebhookUrl", "digestWebhookEnabled", "createdAt", "updatedAt")
SELECT 'legacy-local', "plan", "aiProvider", "aiBaseUrl", "aiModel", "aiApiKeyCiphertext", "aiApiKeyUpdatedAt", COALESCE("autoIngestEnabled", 1), COALESCE("autoIngestIntervalMinutes", 360), "lastScheduledIngestAt", "digestWebhookUrl", COALESCE("digestWebhookEnabled", 0), "createdAt", "updatedAt" FROM "WorkspaceSettings";
DROP TABLE "WorkspaceSettings";
ALTER TABLE "new_WorkspaceSettings" RENAME TO "WorkspaceSettings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_workspaceId_key" ON "User"("workspaceId");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Source_workspaceId_enabled_createdAt_idx" ON "Source"("workspaceId", "enabled", "createdAt");
CREATE UNIQUE INDEX "Source_workspaceId_type_url_key" ON "Source"("workspaceId", "type", "url");
CREATE INDEX "IntelligenceDigest_workspaceId_kind_createdAt_idx" ON "IntelligenceDigest"("workspaceId", "kind", "createdAt");
CREATE INDEX "BackgroundJob_workspaceId_kind_status_createdAt_idx" ON "BackgroundJob"("workspaceId", "kind", "status", "createdAt");
