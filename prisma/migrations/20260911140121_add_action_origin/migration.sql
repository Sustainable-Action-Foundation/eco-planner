-- AlterTable
ALTER TABLE `Actions` ADD COLUMN `origin_action_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Actions_origin_action_id_idx` ON `Actions`(`origin_action_id`);

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_origin_action_id_fkey` FOREIGN KEY (`origin_action_id`) REFERENCES `Actions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
