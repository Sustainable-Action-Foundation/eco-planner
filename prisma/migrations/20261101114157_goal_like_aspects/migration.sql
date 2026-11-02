-- CreateTable
CREATE TABLE `GoalLikeAspects` (
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `goal_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `aspect` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`goal_id`, `user_id`, `aspect`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GoalLikeAspects` ADD CONSTRAINT `GoalLikeAspects_goal_id_user_id_fkey` FOREIGN KEY (`goal_id`, `user_id`) REFERENCES `GoalLikes`(`goal_id`, `user_id`) ON DELETE CASCADE ON UPDATE CASCADE;
