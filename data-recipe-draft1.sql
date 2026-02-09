-- Very manual migration :)
-- Original prisma-generated migration is at the bottom of this file, included for reference

-- Misc. foreign key and index cleanup
-- DropForeignKey
ALTER TABLE `_inheritance_suggestions` DROP FOREIGN KEY `_inheritance_suggestions_B_fkey`;

-- DropForeignKey
ALTER TABLE `_recipe_data_series` DROP FOREIGN KEY `_recipe_data_series_A_fkey`,
    DROP FOREIGN KEY `_recipe_data_series_B_fkey`;

-- Data series migration
CREATE TABLE `date_record` (
    `timestamp` DATE NOT NULL,
    `value` DOUBLE NOT NULL,
    `data_series_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`data_series_id`, `timestamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- A fuckton of instances (31) of copying data from data_series val_ fields into new date_record rows
-- 2020 - 2029
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2020-01-01' AS `timestamp`,
    `val_2020` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2021-01-01' AS `timestamp`,
    `val_2021` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2022-01-01' AS `timestamp`,
    `val_2022` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2023-01-01' AS `timestamp`,
    `val_2023` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2024-01-01' AS `timestamp`,
    `val_2024` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2025-01-01' AS `timestamp`,
    `val_2025` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2026-01-01' AS `timestamp`,
    `val_2026` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2027-01-01' AS `timestamp`,
    `val_2027` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2028-01-01' AS `timestamp`,
    `val_2028` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2029-01-01' AS `timestamp`,
    `val_2029` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

-- 2030 - 2039
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2030-01-01' AS `timestamp`,
    `val_2030` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2031-01-01' AS `timestamp`,
    `val_2031` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2032-01-01' AS `timestamp`,
    `val_2032` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2033-01-01' AS `timestamp`,
    `val_2033` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2034-01-01' AS `timestamp`,
    `val_2034` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2035-01-01' AS `timestamp`,
    `val_2035` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2036-01-01' AS `timestamp`,
    `val_2036` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2037-01-01' AS `timestamp`,
    `val_2037` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2038-01-01' AS `timestamp`,
    `val_2038` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2039-01-01' AS `timestamp`,
    `val_2039` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

-- 2040 - 2050
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2040-01-01' AS `timestamp`,
    `val_2040` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2041-01-01' AS `timestamp`,
    `val_2041` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2042-01-01' AS `timestamp`,
    `val_2042` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2043-01-01' AS `timestamp`,
    `val_2043` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2044-01-01' AS `timestamp`,
    `val_2044` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2045-01-01' AS `timestamp`,
    `val_2045` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2046-01-01' AS `timestamp`,
    `val_2046` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2047-01-01' AS `timestamp`,
    `val_2047` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2048-01-01' AS `timestamp`,
    `val_2048` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2049-01-01' AS `timestamp`,
    `val_2049` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2050-01-01' AS `timestamp`,
    `val_2050` AS `value`,
    `id` AS `data_series_id`
FROM `data_series`;
-- End of data series copying

-- Change direction of relationship between data_series and goals/effects;
-- instead of data_series having foreign keys to goals and effects, goals and effects will have foreign keys to data_series.
ALTER TABLE `effect` ADD COLUMN `data_series_id` VARCHAR(191) NULL;

ALTER TABLE `goal` ADD COLUMN `data_series_id` VARCHAR(191) NULL,
    ADD COLUMN `baseline_id` VARCHAR(191) NULL;

UPDATE `effect`
    SET `data_series_id` = (
        SELECT `id`
        FROM `data_series`
        WHERE `data_series`.`effect_action_id` = `effect`.`action_id`
            AND `data_series`.`effect_goal_id` = `effect`.`goal_id`
    );

UPDATE `goal`
    SET `data_series_id` = (
        SELECT `id`
        FROM `data_series`
        WHERE `data_series`.`goal_id` = `goal`.`id`
    ),
    `baseline_id` = (
        SELECT `id`
        FROM `data_series`
        WHERE `data_series`.`baseline_goal_id` = `goal`.`id`
    );

-- Remove old foreign keys from data_series
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_baseline_goal_id_fkey`,
    DROP FOREIGN KEY `data_series_effect_action_id_effect_goal_id_fkey`,
    DROP FOREIGN KEY `data_series_goal_id_fkey`;

-- Remove indexes on dropped foreign keys
DROP INDEX `data_series_baseline_goal_id_key` ON `data_series`;
DROP INDEX `data_series_goal_id_key` ON `data_series`;
DROP INDEX `effect_id` ON `data_series`;

-- DROP val_ columns, baseline_goal_id, effect_action_id, effect_goal_id and goal_id;
-- ADD recipe_used_id to data_series
ALTER TABLE `data_series` DROP COLUMN `val_2020`,
    DROP COLUMN `val_2021`,
    DROP COLUMN `val_2022`,
    DROP COLUMN `val_2023`,
    DROP COLUMN `val_2024`,
    DROP COLUMN `val_2025`,
    DROP COLUMN `val_2026`,
    DROP COLUMN `val_2027`,
    DROP COLUMN `val_2028`,
    DROP COLUMN `val_2029`,
    DROP COLUMN `val_2030`,
    DROP COLUMN `val_2031`,
    DROP COLUMN `val_2032`,
    DROP COLUMN `val_2033`,
    DROP COLUMN `val_2034`,
    DROP COLUMN `val_2035`,
    DROP COLUMN `val_2036`,
    DROP COLUMN `val_2037`,
    DROP COLUMN `val_2038`,
    DROP COLUMN `val_2039`,
    DROP COLUMN `val_2040`,
    DROP COLUMN `val_2041`,
    DROP COLUMN `val_2042`,
    DROP COLUMN `val_2043`,
    DROP COLUMN `val_2044`,
    DROP COLUMN `val_2045`,
    DROP COLUMN `val_2046`,
    DROP COLUMN `val_2047`,
    DROP COLUMN `val_2048`,
    DROP COLUMN `val_2049`,
    DROP COLUMN `val_2050`,
    DROP COLUMN `goal_id`,
    DROP COLUMN `baseline_goal_id`,
    DROP COLUMN `effect_action_id`,
    DROP COLUMN `effect_goal_id`,
    ADD COLUMN `recipe_used_id` VARCHAR(191) NULL;

-- Move recipe_used_id from goals to data_series
UPDATE `data_series`
    SET `recipe_used_id` = (
        SELECT `goal`.`recipe_used_id`
        FROM `goal`
        WHERE `goal`.`data_series_id` = `data_series`.`id`
    );

-- Remove recipe_used_id from goals
ALTER TABLE `goal` DROP FOREIGN KEY `goal_recipe_used_id_fkey`;
DROP INDEX `goal_recipe_used_id_fkey` ON `goal`;
ALTER TABLE `goal` DROP COLUMN `recipe_used_id`;

-- Rename `Recipe` to `recipe` to follow naming convention
ALTER TABLE `Recipe` RENAME TO `recipe`;

-- CreateTable
CREATE TABLE `_source_data_series` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_source_data_series_AB_unique`(`A`, `B`),
    INDEX `_source_data_series_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_recipe_used_id_fkey` FOREIGN KEY (`recipe_used_id`) REFERENCES `recipe`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `date_record` ADD CONSTRAINT `date_record_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `effect` ADD CONSTRAINT `effect_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_B_fkey` FOREIGN KEY (`B`) REFERENCES `recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_B_fkey` FOREIGN KEY (`B`) REFERENCES `recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Original prisma migration below
/*
  Warnings:

  - You are about to drop the column `baseline_goal_id` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `effect_action_id` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `effect_goal_id` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `goal_id` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2020` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2021` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2022` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2023` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2024` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2025` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2026` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2027` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2028` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2029` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2030` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2031` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2032` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2033` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2034` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2035` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2036` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2037` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2038` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2039` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2040` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2041` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2042` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2043` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2044` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2045` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2046` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2047` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2048` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2049` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `val_2050` on the `data_series` table. All the data in the column will be lost.
  - You are about to drop the column `recipe_used_id` on the `goal` table. All the data in the column will be lost.
  - You are about to drop the `Recipe` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_recipe_data_series` table. If the table is not empty, all the data it contains will be lost.

*/
/*
-- DropForeignKey
ALTER TABLE `_inheritance_suggestions` DROP FOREIGN KEY `_inheritance_suggestions_B_fkey`;

-- DropForeignKey
ALTER TABLE `_recipe_data_series` DROP FOREIGN KEY `_recipe_data_series_A_fkey`;

-- DropForeignKey
ALTER TABLE `_recipe_data_series` DROP FOREIGN KEY `_recipe_data_series_B_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_baseline_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_effect_action_id_effect_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `goal` DROP FOREIGN KEY `goal_recipe_used_id_fkey`;

-- DropIndex
DROP INDEX `data_series_baseline_goal_id_key` ON `data_series`;

-- DropIndex
DROP INDEX `data_series_goal_id_key` ON `data_series`;

-- DropIndex
DROP INDEX `effect_id` ON `data_series`;

-- DropIndex
DROP INDEX `goal_recipe_used_id_fkey` ON `goal`;

-- AlterTable
ALTER TABLE `data_series` DROP COLUMN `baseline_goal_id`,
    DROP COLUMN `effect_action_id`,
    DROP COLUMN `effect_goal_id`,
    DROP COLUMN `goal_id`,
    DROP COLUMN `val_2020`,
    DROP COLUMN `val_2021`,
    DROP COLUMN `val_2022`,
    DROP COLUMN `val_2023`,
    DROP COLUMN `val_2024`,
    DROP COLUMN `val_2025`,
    DROP COLUMN `val_2026`,
    DROP COLUMN `val_2027`,
    DROP COLUMN `val_2028`,
    DROP COLUMN `val_2029`,
    DROP COLUMN `val_2030`,
    DROP COLUMN `val_2031`,
    DROP COLUMN `val_2032`,
    DROP COLUMN `val_2033`,
    DROP COLUMN `val_2034`,
    DROP COLUMN `val_2035`,
    DROP COLUMN `val_2036`,
    DROP COLUMN `val_2037`,
    DROP COLUMN `val_2038`,
    DROP COLUMN `val_2039`,
    DROP COLUMN `val_2040`,
    DROP COLUMN `val_2041`,
    DROP COLUMN `val_2042`,
    DROP COLUMN `val_2043`,
    DROP COLUMN `val_2044`,
    DROP COLUMN `val_2045`,
    DROP COLUMN `val_2046`,
    DROP COLUMN `val_2047`,
    DROP COLUMN `val_2048`,
    DROP COLUMN `val_2049`,
    DROP COLUMN `val_2050`,
    ADD COLUMN `recipe_used_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `effect` ADD COLUMN `data_series_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `goal` DROP COLUMN `recipe_used_id`,
    ADD COLUMN `baseline_id` VARCHAR(191) NULL,
    ADD COLUMN `data_series_id` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `Recipe`;

-- DropTable
DROP TABLE `_recipe_data_series`;

-- CreateTable
CREATE TABLE `date_record` (
    `timestamp` DATE NOT NULL,
    `value` DOUBLE NOT NULL,
    `data_series_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`data_series_id`, `timestamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recipe` (
    `id` VARCHAR(191) NOT NULL,
    `recipe` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_source_data_series` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_source_data_series_AB_unique`(`A`, `B`),
    INDEX `_source_data_series_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_recipe_used_id_fkey` FOREIGN KEY (`recipe_used_id`) REFERENCES `recipe`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `date_record` ADD CONSTRAINT `date_record_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `effect` ADD CONSTRAINT `effect_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_B_fkey` FOREIGN KEY (`B`) REFERENCES `recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_B_fkey` FOREIGN KEY (`B`) REFERENCES `recipe`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
*/
