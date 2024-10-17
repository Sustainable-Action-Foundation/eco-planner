/*
  Warnings:

  - A unique constraint covering the columns `[baseline_goal_id]` on the table `data_series` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[action_id]` on the table `data_series` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `action` ADD COLUMN `impact_type` ENUM('PERCENT', 'ABSOLUTE', 'DELTA') NOT NULL DEFAULT 'ABSOLUTE';

-- AlterTable
ALTER TABLE `data_series` ADD COLUMN `action_id` VARCHAR(191) NULL,
    ADD COLUMN `baseline_goal_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `data_series_baseline_goal_id_key` ON `data_series`(`baseline_goal_id`);

-- CreateIndex
CREATE UNIQUE INDEX `data_series_action_id_key` ON `data_series`(`action_id`);

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_baseline_goal_id_fkey` FOREIGN KEY (`baseline_goal_id`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
