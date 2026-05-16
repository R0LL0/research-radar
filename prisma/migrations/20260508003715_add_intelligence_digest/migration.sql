-- CreateTable
CREATE TABLE "IntelligenceDigest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'daily',
    "title" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "digestMd" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "IntelligenceDigest_kind_createdAt_idx" ON "IntelligenceDigest"("kind", "createdAt");
