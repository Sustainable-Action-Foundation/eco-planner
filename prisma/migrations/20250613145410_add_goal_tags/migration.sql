-- CreateTable
CREATE TABLE `goal_tag` (
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_tag` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_tag_AB_unique`(`A`, `B`),
    INDEX `_goal_tag_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_goal_tag` ADD CONSTRAINT `_goal_tag_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_tag` ADD CONSTRAINT `_goal_tag_B_fkey` FOREIGN KEY (`B`) REFERENCES `goal_tag`(`name`) ON DELETE CASCADE ON UPDATE CASCADE;
