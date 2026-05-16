-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "plan" TEXT NOT NULL DEFAULT 'STARTER',
    "aiProvider" TEXT NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "aiBaseUrl" TEXT,
    "aiModel" TEXT,
    "aiApiKeyCiphertext" TEXT,
    "aiApiKeyUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
