-- CreateTable
CREATE TABLE `GeoAreas` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('NATION', 'COUNTY', 'MUNICIPALITY') NOT NULL,
    `parent_code` VARCHAR(191) NULL,

    INDEX `GeoAreas_name_idx`(`name`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Roadmaps` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `actor` VARCHAR(191) NULL,
    `geo_area_code` VARCHAR(191) NULL,
    `type` ENUM('NATIONAL', 'REGIONAL', 'MUNICIPAL', 'LOCAL', 'ORGANIZATIONAL', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `parent_roadmap_id` VARCHAR(191) NULL,
    `author_id` VARCHAR(191) NULL,
    `access_control_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoadmapIterations` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `description` TEXT NULL,
    `roadmap_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `target_version` INTEGER NULL,
    `published_at` DATETIME(3) NULL,
    `author_id` VARCHAR(191) NULL,

    UNIQUE INDEX `RoadmapIterations_roadmap_id_version_key`(`roadmap_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Goals` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `indicator_parameter` TEXT NOT NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `data_series_id` VARCHAR(191) NULL,
    `baseline_id` VARCHAR(191) NULL,
    `historical_id` VARCHAR(191) NULL,
    `author_id` VARCHAR(191) NULL,
    `roadmap_iteration_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Goals_data_series_id_key`(`data_series_id`),
    UNIQUE INDEX `Goals_baseline_id_key`(`baseline_id`),
    UNIQUE INDEX `Goals_historical_id_key`(`historical_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataSeries` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL DEFAULT '',
    `recipe_used_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `DataSeries_recipe_used_id_key`(`recipe_used_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DateRecords` (
    `timestamp` DATE NOT NULL,
    `value` DOUBLE NOT NULL,
    `data_series_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`data_series_id`, `timestamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recipes` (
    `id` VARCHAR(191) NOT NULL,
    `recipe` JSON NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoalTags` (
    `name` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Actions` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `indicator_parameter` VARCHAR(1024) NOT NULL,
    `start_year` INTEGER NULL,
    `end_year` INTEGER NULL,
    `roadmap_iteration_id` VARCHAR(191) NULL,
    `parent_action_id` VARCHAR(191) NULL,
    `author_id` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActionFields` (
    `id` VARCHAR(191) NOT NULL,
    `action_id` VARCHAR(191) NOT NULL,
    `header` TINYTEXT NOT NULL,
    `value` TEXT NOT NULL,
    `type` ENUM('PARAGRAPH', 'DATE', 'SHORT') NOT NULL DEFAULT 'PARAGRAPH',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Effects` (
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `data_series_id` VARCHAR(191) NULL,
    `impact_type` ENUM('PERCENT', 'ABSOLUTE', 'DELTA') NOT NULL DEFAULT 'ABSOLUTE',
    `action_id` VARCHAR(191) NOT NULL,
    `goal_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Effects_data_series_id_key`(`data_series_id`),
    PRIMARY KEY (`action_id`, `goal_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comments` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `comment_text` TEXT NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `action_id` VARCHAR(191) NULL,
    `goal_id` VARCHAR(191) NULL,
    `roadmap_iteration_id` VARCHAR(191) NULL,
    `roadmap_id` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Orgs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `geo_area_code` VARCHAR(191) NULL,

    UNIQUE INDEX `Orgs_name_key`(`name`),
    UNIQUE INDEX `Orgs_domain_key`(`domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestInvites` (
    `token` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `org_id` VARCHAR(191) NOT NULL,
    `invited_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `GuestInvites_org_id_email_key`(`org_id`, `email`),
    PRIMARY KEY (`token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Groups_org_id_name_key`(`org_id`, `name`),
    UNIQUE INDEX `Groups_id_org_id_key`(`id`, `org_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrgMemberships` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `role` ENUM('GUEST', 'MEMBER', 'MANAGER') NOT NULL DEFAULT 'MEMBER',
    `role_changed_at` DATETIME(3) NULL,
    `role_changed_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `OrgMemberships_user_id_org_id_key`(`user_id`, `org_id`),
    UNIQUE INDEX `OrgMemberships_id_org_id_key`(`id`, `org_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupMemberships` (
    `membership_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`membership_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessControls` (
    `id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `org_readable` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `AccessControls_id_org_id_key`(`id`, `org_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccessGrants` (
    `access_control_id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,
    `access_level` ENUM('RO', 'RW') NOT NULL DEFAULT 'RO',

    PRIMARY KEY (`access_control_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `is_super_admin` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Users_username_key`(`username`),
    UNIQUE INDEX `Users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_inheritance_suggestions` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_inheritance_suggestions_AB_unique`(`A`, `B`),
    INDEX `_inheritance_suggestions_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_source_data_series` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_source_data_series_AB_unique`(`A`, `B`),
    INDEX `_source_data_series_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_goal_tags` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_goal_tags_AB_unique`(`A`, `B`),
    INDEX `_goal_tags_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GeoAreas` ADD CONSTRAINT `GeoAreas_parent_code_fkey` FOREIGN KEY (`parent_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_geo_area_code_fkey` FOREIGN KEY (`geo_area_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_parent_roadmap_id_fkey` FOREIGN KEY (`parent_roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_access_control_id_fkey` FOREIGN KEY (`access_control_id`) REFERENCES `AccessControls`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoadmapIterations` ADD CONSTRAINT `RoadmapIterations_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoadmapIterations` ADD CONSTRAINT `RoadmapIterations_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_historical_id_fkey` FOREIGN KEY (`historical_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_recipe_used_id_fkey` FOREIGN KEY (`recipe_used_id`) REFERENCES `Recipes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DateRecords` ADD CONSTRAINT `DateRecords_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recipes` ADD CONSTRAINT `Recipes_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_parent_action_id_fkey` FOREIGN KEY (`parent_action_id`) REFERENCES `Actions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionFields` ADD CONSTRAINT `ActionFields_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_author_id_fkey` FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Orgs` ADD CONSTRAINT `Orgs_geo_area_code_fkey` FOREIGN KEY (`geo_area_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Groups` ADD CONSTRAINT `Groups_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMemberships` ADD CONSTRAINT `GroupMemberships_membership_id_org_id_fkey` FOREIGN KEY (`membership_id`, `org_id`) REFERENCES `OrgMemberships`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GroupMemberships` ADD CONSTRAINT `GroupMemberships_group_id_org_id_fkey` FOREIGN KEY (`group_id`, `org_id`) REFERENCES `Groups`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessControls` ADD CONSTRAINT `AccessControls_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrants` ADD CONSTRAINT `AccessGrants_access_control_id_org_id_fkey` FOREIGN KEY (`access_control_id`, `org_id`) REFERENCES `AccessControls`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccessGrants` ADD CONSTRAINT `AccessGrants_group_id_org_id_fkey` FOREIGN KEY (`group_id`, `org_id`) REFERENCES `Groups`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_A_fkey` FOREIGN KEY (`A`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_inheritance_suggestions` ADD CONSTRAINT `_inheritance_suggestions_B_fkey` FOREIGN KEY (`B`) REFERENCES `Recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_A_fkey` FOREIGN KEY (`A`) REFERENCES `DataSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_source_data_series` ADD CONSTRAINT `_source_data_series_B_fkey` FOREIGN KEY (`B`) REFERENCES `Recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_tags` ADD CONSTRAINT `_goal_tags_A_fkey` FOREIGN KEY (`A`) REFERENCES `GoalTags`(`name`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_tags` ADD CONSTRAINT `_goal_tags_B_fkey` FOREIGN KEY (`B`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestInvites` ADD CONSTRAINT `GuestInvites_org_id_fkey` FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestInvites` ADD CONSTRAINT `GuestInvites_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_role_changed_by_id_fkey` FOREIGN KEY (`role_changed_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

