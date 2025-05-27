-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Layout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Layout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Layout" ("createdAt", "data", "id", "updatedAt", "userId") SELECT "createdAt", "data", "id", "updatedAt", "userId" FROM "Layout";
DROP TABLE "Layout";
ALTER TABLE "new_Layout" RENAME TO "Layout";
CREATE UNIQUE INDEX "Layout_userId_key" ON "Layout"("userId");
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("createdAt", "data", "id", "updatedAt", "userId") SELECT "createdAt", "data", "id", "updatedAt", "userId" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE UNIQUE INDEX "Setting_userId_key" ON "Setting"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
