/*
  Warnings:

  - You are about to drop the column `goal_id` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `impact_type` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `action_id` on the `data_series` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[effect_action_id,effect_goal_id]` on the table `data_series` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roadmap_id` to the `action` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `action` DROP FOREIGN KEY `action_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_action_id_fkey`;

-- AlterTable
-- EDIT: Get roadmap id from the action's goal before dropping the column `goal_id` and making `roadmap_id` NOT NULL
ALTER TABLE `action` DROP COLUMN `impact_type`,
    ADD COLUMN `roadmap_id` VARCHAR(191) NULL;

UPDATE `action`
    SET `roadmap_id` = (
        SELECT `goal`.`roadmap_id`
        FROM `goal`
        WHERE `goal`.`id` = `action`.`goal_id`
    );

ALTER TABLE `action` DROP COLUMN `goal_id`,
    MODIFY COLUMN `roadmap_id` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `data_series` DROP COLUMN `action_id`,
    ADD COLUMN `effect_action_id` VARCHAR(191) NULL,
    ADD COLUMN `effect_goal_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `effect` (
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `impact_type` ENUM('PERCENT', 'ABSOLUTE', 'DELTA') NOT NULL DEFAULT 'ABSOLUTE',
    `action_id` VARCHAR(191) NOT NULL,
    `goal_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`action_id`, `goal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `effect_id` ON `data_series`(`effect_action_id`, `effect_goal_id`);

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_effect_action_id_effect_goal_id_fkey` FOREIGN KEY (`effect_action_id`, `effect_goal_id`) REFERENCES `effect`(`action_id`, `goal_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `action` ADD CONSTRAINT `action_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `effect` ADD CONSTRAINT `effect_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `effect` ADD CONSTRAINT `effect_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
