-- AlterTable
ALTER TABLE `Users` MODIFY `password_hash` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `LoginTokens` (
    `token_hash` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `remember` BOOLEAN NOT NULL DEFAULT false,
    `redirect` VARCHAR(191) NULL,

    INDEX `LoginTokens_email_idx`(`email`),
    PRIMARY KEY (`token_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

