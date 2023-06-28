-- CreateTable
CREATE TABLE `action` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `cost_efficiency` TEXT NOT NULL,
    `expected_outcome` TEXT NOT NULL,
    `project_manager` VARCHAR(191) NOT NULL,
    `relevant_actors` TEXT NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `author_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goal` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `goal_object` VARCHAR(191) NOT NULL,
    `national_roadmap_id` VARCHAR(191) NULL,
    `indicator_parameter` TEXT NOT NULL,
    `is_national_goal` BOOLEAN NOT NULL,
    `data_series_id` VARCHAR(191) NULL,
    `author_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Roadmap` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `user_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_group` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_series` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `val_2020` DECIMAL(65, 30) NULL,
    `val_2021` DECIMAL(65, 30) NULL,
    `val_2022` DECIMAL(65, 30) NULL,
    `val_2023` DECIMAL(65, 30) NULL,
    `val_2024` DECIMAL(65, 30) NULL,
    `val_2025` DECIMAL(65, 30) NULL,
    `val_2026` DECIMAL(65, 30) NULL,
    `val_2027` DECIMAL(65, 30) NULL,
    `val_2028` DECIMAL(65, 30) NULL,
    `val_2029` DECIMAL(65, 30) NULL,
    `val_2030` DECIMAL(65, 30) NULL,
    `val_2031` DECIMAL(65, 30) NULL,
    `val_2032` DECIMAL(65, 30) NULL,
    `val_2033` DECIMAL(65, 30) NULL,
    `val_2034` DECIMAL(65, 30) NULL,
    `val_2035` DECIMAL(65, 30) NULL,
    `val_2036` DECIMAL(65, 30) NULL,
    `val_2037` DECIMAL(65, 30) NULL,
    `val_2038` DECIMAL(65, 30) NULL,
    `val_2039` DECIMAL(65, 30) NULL,
    `val_2040` DECIMAL(65, 30) NULL,
    `val_2041` DECIMAL(65, 30) NULL,
    `val_2042` DECIMAL(65, 30) NULL,
    `val_2043` DECIMAL(65, 30) NULL,
    `val_2044` DECIMAL(65, 30) NULL,
    `val_2045` DECIMAL(65, 30) NULL,
    `val_2046` DECIMAL(65, 30) NULL,
    `val_2047` DECIMAL(65, 30) NULL,
    `val_2048` DECIMAL(65, 30) NULL,
    `val_2049` DECIMAL(65, 30) NULL,
    `val_2050` DECIMAL(65, 30) NULL,
    `author_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_action_goal` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_action_goal_AB_unique`(`A`, `B`),
    INDEX `_action_goal_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_action_editors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_action_editors_AB_unique`(`A`, `B`),
    INDEX `_action_editors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_action_edit_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_action_edit_groups_AB_unique`(`A`, `B`),
    INDEX `_action_edit_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_action_viewers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_action_viewers_AB_unique`(`A`, `B`),
    INDEX `_action_viewers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_action_view_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_action_view_groups_AB_unique`(`A`, `B`),
    INDEX `_action_view_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_editors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_editors_AB_unique`(`A`, `B`),
    INDEX `_goal_editors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_edit_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_edit_groups_AB_unique`(`A`, `B`),
    INDEX `_goal_edit_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_viewers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_viewers_AB_unique`(`A`, `B`),
    INDEX `_goal_viewers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_view_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_view_groups_AB_unique`(`A`, `B`),
    INDEX `_goal_view_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_roadmap_goal` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_roadmap_goal_AB_unique`(`A`, `B`),
    INDEX `_roadmap_goal_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_roadmap_editors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_roadmap_editors_AB_unique`(`A`, `B`),
    INDEX `_roadmap_editors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_roadmap_edit_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_roadmap_edit_groups_AB_unique`(`A`, `B`),
    INDEX `_roadmap_edit_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_roadmap_viewers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_roadmap_viewers_AB_unique`(`A`, `B`),
    INDEX `_roadmap_viewers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_roadmap_view_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_roadmap_view_groups_AB_unique`(`A`, `B`),
    INDEX `_roadmap_view_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_user_group` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_user_group_AB_unique`(`A`, `B`),
    INDEX `_user_group_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_data_series_editors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_data_series_editors_AB_unique`(`A`, `B`),
    INDEX `_data_series_editors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_data_series_viewers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_data_series_viewers_AB_unique`(`A`, `B`),
    INDEX `_data_series_viewers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_data_series_edit_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_data_series_edit_groups_AB_unique`(`A`, `B`),
    INDEX `_data_series_edit_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_data_series_view_groups` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_data_series_view_groups_AB_unique`(`A`, `B`),
    INDEX `_data_series_view_groups_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `action` ADD CONSTRAINT `action_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `action`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `action` ADD CONSTRAINT `action_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `data_series`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goal` ADD CONSTRAINT `goal_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Roadmap` ADD CONSTRAINT `Roadmap_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_series` ADD CONSTRAINT `data_series_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_goal` ADD CONSTRAINT `_action_goal_A_fkey` FOREIGN KEY (`A`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_goal` ADD CONSTRAINT `_action_goal_B_fkey` FOREIGN KEY (`B`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_editors` ADD CONSTRAINT `_action_editors_A_fkey` FOREIGN KEY (`A`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_editors` ADD CONSTRAINT `_action_editors_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_edit_groups` ADD CONSTRAINT `_action_edit_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_edit_groups` ADD CONSTRAINT `_action_edit_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_viewers` ADD CONSTRAINT `_action_viewers_A_fkey` FOREIGN KEY (`A`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_viewers` ADD CONSTRAINT `_action_viewers_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_view_groups` ADD CONSTRAINT `_action_view_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `action`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_action_view_groups` ADD CONSTRAINT `_action_view_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_editors` ADD CONSTRAINT `_goal_editors_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_editors` ADD CONSTRAINT `_goal_editors_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_edit_groups` ADD CONSTRAINT `_goal_edit_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_edit_groups` ADD CONSTRAINT `_goal_edit_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_viewers` ADD CONSTRAINT `_goal_viewers_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_viewers` ADD CONSTRAINT `_goal_viewers_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_view_groups` ADD CONSTRAINT `_goal_view_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_view_groups` ADD CONSTRAINT `_goal_view_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_goal` ADD CONSTRAINT `_roadmap_goal_A_fkey` FOREIGN KEY (`A`) REFERENCES `goal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_goal` ADD CONSTRAINT `_roadmap_goal_B_fkey` FOREIGN KEY (`B`) REFERENCES `Roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_editors` ADD CONSTRAINT `_roadmap_editors_A_fkey` FOREIGN KEY (`A`) REFERENCES `Roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_editors` ADD CONSTRAINT `_roadmap_editors_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_edit_groups` ADD CONSTRAINT `_roadmap_edit_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `Roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_edit_groups` ADD CONSTRAINT `_roadmap_edit_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_viewers` ADD CONSTRAINT `_roadmap_viewers_A_fkey` FOREIGN KEY (`A`) REFERENCES `Roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_viewers` ADD CONSTRAINT `_roadmap_viewers_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_view_groups` ADD CONSTRAINT `_roadmap_view_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `Roadmap`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_roadmap_view_groups` ADD CONSTRAINT `_roadmap_view_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_user_group` ADD CONSTRAINT `_user_group_A_fkey` FOREIGN KEY (`A`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_user_group` ADD CONSTRAINT `_user_group_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_editors` ADD CONSTRAINT `_data_series_editors_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_editors` ADD CONSTRAINT `_data_series_editors_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_viewers` ADD CONSTRAINT `_data_series_viewers_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_viewers` ADD CONSTRAINT `_data_series_viewers_B_fkey` FOREIGN KEY (`B`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_edit_groups` ADD CONSTRAINT `_data_series_edit_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_edit_groups` ADD CONSTRAINT `_data_series_edit_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_view_groups` ADD CONSTRAINT `_data_series_view_groups_A_fkey` FOREIGN KEY (`A`) REFERENCES `data_series`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_data_series_view_groups` ADD CONSTRAINT `_data_series_view_groups_B_fkey` FOREIGN KEY (`B`) REFERENCES `user_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
