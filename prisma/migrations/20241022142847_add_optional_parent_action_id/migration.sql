-- AlterTable
ALTER TABLE `action` ADD COLUMN `parent_action_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `action` ADD CONSTRAINT `action_parent_action_id_fkey` FOREIGN KEY (`parent_action_id`) REFERENCES `action`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
