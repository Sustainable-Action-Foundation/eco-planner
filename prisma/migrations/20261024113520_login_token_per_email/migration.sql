/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `LoginTokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `LoginTokens_email_idx` ON `LoginTokens`;

-- CreateIndex
CREATE UNIQUE INDEX `LoginTokens_email_key` ON `LoginTokens`(`email`);
