-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,
    CONSTRAINT "Item_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemContent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "summaryMd" TEXT NOT NULL,
    "citations" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemSummary_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Source_enabled_createdAt_idx" ON "Source"("enabled", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Source_type_url_key" ON "Source"("type", "url");

-- CreateIndex
CREATE INDEX "Item_sourceId_fetchedAt_idx" ON "Item"("sourceId", "fetchedAt");

-- CreateIndex
CREATE INDEX "Item_publishedAt_idx" ON "Item"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Item_sourceId_externalId_key" ON "Item"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemContent_itemId_key" ON "ItemContent"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemSummary_itemId_key" ON "ItemSummary"("itemId");
