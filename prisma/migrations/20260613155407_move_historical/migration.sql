/*
  Warnings:

  - You are about to drop the column `external_dataset` on the `goal` table. All the data in the column will be lost.
  - You are about to drop the column `external_id` on the `goal` table. All the data in the column will be lost.
  - You are about to drop the column `external_selection` on the `goal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `goal` DROP COLUMN `external_dataset`,
    DROP COLUMN `external_id`,
    DROP COLUMN `external_selection`,
    ADD COLUMN `historical_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_historical_id_fkey` FOREIGN KEY (`historical_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
