/*
  Warnings:

  - You are about to drop the column `cost_efficiency` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `expected_outcome` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `is_efficiency` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `is_renewables` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `is_sufficiency` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `project_manager` on the `action` table. All the data in the column will be lost.
  - You are about to drop the column `relevant_actors` on the `action` table. All the data in the column will be lost.
  - You are about to drop the `link` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `indicator_parameter` to the `action` table without a default value. This is not possible if the table is not empty.
*/

-- DropForeignKey
ALTER TABLE `link` DROP FOREIGN KEY `link_action_id_fkey`;

-- DropForeignKey
ALTER TABLE `link` DROP FOREIGN KEY `link_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `link` DROP FOREIGN KEY `link_meta_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `link` DROP FOREIGN KEY `link_roadmap_id_fkey`;

-- CreateTable
CREATE TABLE `action_field` (
    `id` VARCHAR(191) NOT NULL,
    `action_id` VARCHAR(191) NOT NULL,
    `header` TINYTEXT NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate data from `action` to `action_field`
INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'cost_efficiency' AS `header`,
    `cost_efficiency` AS `value`
FROM `action`
    WHERE `cost_efficiency` IS NOT NULL;

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'description' AS `header`,
    `description` AS `value`
FROM `action`
    WHERE `description` IS NOT NULL;

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'expected_outcome' AS `header`,
    `expected_outcome` AS `value`
FROM `action`
    WHERE `expected_outcome` IS NOT NULL;

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'tag' AS `header`,
    'efficiency' AS `value`
FROM `action`
    WHERE `is_efficiency` IS NOT FALSE;

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'tag' AS `header`,
    'renewable' AS `value`
FROM `action`
    WHERE `is_renewables` IS NOT FALSE;

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'tag' AS `header`,
    'sufficiency' AS `value`
FROM `action`
    WHERE `is_sufficiency` IS NOT FALSE;

-- `project_manager` is not migrated, and rather just dropped

INSERT INTO `action_field` (`id`, `action_id`, `header`, `value`)
SELECT
    UUID_v4() AS `id`,
    `id` AS `action_id`,
    'relevant_actors' AS `header`,
    `relevant_actors` AS `value`
FROM `action`
    WHERE `relevant_actors` IS NOT NULL;

-- Add the new required column `indicator_parameter` to the `action` table
ALTER TABLE `action` ADD COLUMN `indicator_parameter` VARCHAR(1024) NULL;

-- Fill the new column with a default value (action name) for existing rows
UPDATE `action` SET `indicator_parameter` = `name` WHERE `indicator_parameter` IS NULL;

-- Make the new column `indicator_parameter` NOT NULL
ALTER TABLE `action` MODIFY COLUMN `indicator_parameter` VARCHAR(1024) NOT NULL;

-- AlterTable
ALTER TABLE `action` DROP COLUMN `cost_efficiency`,
    DROP COLUMN `description`,
    DROP COLUMN `expected_outcome`,
    DROP COLUMN `is_efficiency`,
    DROP COLUMN `is_renewables`,
    DROP COLUMN `is_sufficiency`,
    DROP COLUMN `project_manager`,
    DROP COLUMN `relevant_actors`,
    MODIFY `roadmap_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `link`;

-- AddForeignKey
ALTER TABLE `action_field` ADD CONSTRAINT `action_field_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
