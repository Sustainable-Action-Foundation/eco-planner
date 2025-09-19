-- AlterTable
ALTER TABLE `link` ADD COLUMN `roadmap_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `link` ADD CONSTRAINT `link_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
