-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Source" ("createdAt", "enabled", "id", "title", "type", "updatedAt", "url") SELECT "createdAt", "enabled", "id", "title", "type", "updatedAt", "url" FROM "Source";
DROP TABLE "Source";
ALTER TABLE "new_Source" RENAME TO "Source";
CREATE INDEX "Source_enabled_createdAt_idx" ON "Source"("enabled", "createdAt");
CREATE UNIQUE INDEX "Source_type_url_key" ON "Source"("type", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
