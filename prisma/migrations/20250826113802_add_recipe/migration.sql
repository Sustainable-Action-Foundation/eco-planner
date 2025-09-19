/*
  Warnings:

  - You are about to drop the column `combination_scale` on the `goal` table. All the data in the column will be lost.
  - You are about to drop the `combined_goal` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `combined_goal` DROP FOREIGN KEY `combined_goal_parent_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `combined_goal` DROP FOREIGN KEY `combined_goal_resulting_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_baseline_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_goal_id_fkey`;

-- AlterTable
ALTER TABLE `goal` DROP COLUMN `combination_scale`,
    ADD COLUMN `recipe_used_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `combined_goal`;

-- CreateTable
CREATE TABLE `Recipe` (
    `hash` VARCHAR(191) NOT NULL,
    `recipe` JSON NOT NULL,

    PRIMARY KEY (`hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_inheritance_suggestions` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_inheritance_suggestions_AB_unique`(`A`, `B`),
    INDEX `_inheritance_suggestions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_recipe_data_series` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_recipe_data_series_AB_unique`(`A`, `B`),
    INDEX `_recipe_data_series_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_recipe_used_id_fkey` FOREIGN KEY (`recipe_used_id`) REFERENCES `Recipe`(`hash`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_baseline_goal_id_fkey` FOREIGN KEY (`baseline_goal_id`) REFERENCES `goal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_B_fkey` FOREIGN KEY (`B`) REFERENCES `Recipe`(`hash`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_recipe_data_series` ADD CONSTRAINT `_recipe_data_series_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_recipe_data_series` ADD CONSTRAINT `_recipe_data_series_B_fkey` FOREIGN KEY (`B`) REFERENCES `Recipe`(`hash`) ON DELETE CASCADE ON UPDATE CASCADE;
