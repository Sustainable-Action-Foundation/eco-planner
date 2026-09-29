-- CreateTable
CREATE TABLE `GoalLikes` (
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `goal_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,

    INDEX `GoalLikes_user_id_idx`(`user_id`),
    PRIMARY KEY (`goal_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GoalLikes` ADD CONSTRAINT `GoalLikes_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoalLikes` ADD CONSTRAINT `GoalLikes_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
