-- CreateTable
CREATE TABLE `combined_goal` (
    `resulting_goal_id` VARCHAR(191) NOT NULL,
    `parent_goal_id` VARCHAR(191) NOT NULL,
    `is_inverted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `combined_goal_resulting_goal_id_parent_goal_id_key`(`resulting_goal_id`, `parent_goal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `combined_goal` ADD CONSTRAINT `combined_goal_resulting_goal_id_fkey` FOREIGN KEY (`resulting_goal_id`) REFERENCES `goal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `combined_goal` ADD CONSTRAINT `combined_goal_parent_goal_id_fkey` FOREIGN KEY (`parent_goal_id`) REFERENCES `goal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
