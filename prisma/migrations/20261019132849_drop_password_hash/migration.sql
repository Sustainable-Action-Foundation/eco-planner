/*
  Warnings:

  - You are about to drop the column `password_hash` on the `Users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Users` DROP COLUMN `password_hash`;
