-- AlterTable
-- The case-folded lookup key for usernames (see usernameKey()), backfilled from the display names
ALTER TABLE `Users` ADD COLUMN `username_lower` VARCHAR(191) NOT NULL DEFAULT '';
UPDATE `Users` SET `username_lower` = LOWER(`username`);
ALTER TABLE `Users` ALTER COLUMN `username_lower` DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX `Users_username_lower_key` ON `Users`(`username_lower`);
