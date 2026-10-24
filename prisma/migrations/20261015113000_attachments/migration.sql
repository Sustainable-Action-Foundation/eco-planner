-- CreateTable
CREATE TABLE `Attachments` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `content_type` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `action_id` VARCHAR(191) NULL,
    `goal_id` VARCHAR(191) NULL,
    `roadmap_iteration_id` VARCHAR(191) NULL,

    UNIQUE INDEX `Attachments_storage_key_key`(`storage_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Attachments` ADD CONSTRAINT `Attachments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachments` ADD CONSTRAINT `Attachments_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachments` ADD CONSTRAINT `Attachments_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachments` ADD CONSTRAINT `Attachments_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
