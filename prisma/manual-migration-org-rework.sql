-- ============================================================================
-- FINAL MANUAL MIGRATION: main-era DB -> org-branch schema (2026-07-22)
--
-- PREREQUISITES (in this order):
--   1. Take a backup:  mysqldump --single-transaction <db> > backup.sql
--   2. On branch `org`, run `yarn prisma migrate deploy` FIRST.
--      That applies the 10 pending, already-written migrations
--      (20250514... through 20260720131447) which handle the data-series
--      pivot, goal tags, recipes, historical move, notes/links drops and the
--      action->action_field split. This script starts from that state.
--   3. Run the PREFLIGHT queries below; every one must return ZERO rows.
--   4. Run this script.
--   5. Level the migration history (see instructions at the bottom).
--
-- DECISIONS BAKED IN (review before running):
--   * ONE org is created and everything is assigned to it. Set its name below.
--   * Old is_admin users keep superadmin AND become MANAGER of the org;
--     everyone else becomes MEMBER.
--   * Old user_group rows become Groups of the org (ids preserved).
--   * One AccessControl per meta roadmap. is_public = meta.is_public OR any
--     version public (slight loosening for public-version-under-private-meta).
--     org_readable = FALSE for all migrated items, preserving old privacy
--     semantics (new items created by the app will default to TRUE).
--   * Version-level editors/viewers/groups are folded up to the meta level
--     (AC is meta-only now) -> version-only viewers gain meta-wide view.
--   * Individual editors/viewers (incl. authors, who previously had edit
--     rights) become per-roadmap synthetic groups "<name> editors (<id8>)" /
--     "<name> viewers (<id8>)" with RW / RO grants. Rename in UI at leisure.
--   * All existing roadmap versions get published_at = created_at.
--   * Series without a recipe get a backfilled inline manual recipe
--     (meta.isManual, values inlined from date_record, unit copied; a NULL
--     unit serializes as JSON null).
--   * project_manager was already dropped (GDPR) by 20260720131447.
--
-- KNOWN LEFTOVER: old FK/index *names* (e.g. goal_author_id_fkey) are kept
-- where the constraint itself is unchanged. The first `prisma migrate dev`
-- after leveling will emit a cosmetic rename migration; apply it as-is.
-- ============================================================================

-- ============================================================================
-- PREFLIGHT — run separately; every query must return zero rows.
-- ============================================================================
-- A series referenced by more than one goal slot / effect (breaks new UNIQUEs):
-- SELECT data_series_id, COUNT(*) c FROM goal WHERE data_series_id IS NOT NULL GROUP BY data_series_id HAVING c > 1;
-- SELECT baseline_id,    COUNT(*) c FROM goal WHERE baseline_id    IS NOT NULL GROUP BY baseline_id    HAVING c > 1;
-- SELECT historical_id,  COUNT(*) c FROM goal WHERE historical_id  IS NOT NULL GROUP BY historical_id  HAVING c > 1;
-- SELECT data_series_id, COUNT(*) c FROM effect WHERE data_series_id IS NOT NULL GROUP BY data_series_id HAVING c > 1;
-- Cross-slot sharing (same series in two different slots):
-- SELECT id, COUNT(*) c FROM (
--   SELECT data_series_id AS id FROM goal WHERE data_series_id IS NOT NULL
--   UNION ALL SELECT baseline_id FROM goal WHERE baseline_id IS NOT NULL
--   UNION ALL SELECT historical_id FROM goal WHERE historical_id IS NOT NULL
--   UNION ALL SELECT data_series_id FROM effect WHERE data_series_id IS NOT NULL
-- ) refs GROUP BY id HAVING c > 1;
-- A recipe already shared by several series (breaks recipe_used_id UNIQUE):
-- SELECT recipe_used_id, COUNT(*) c FROM data_series WHERE recipe_used_id IS NOT NULL GROUP BY recipe_used_id HAVING c > 1;

-- ============================================================================
-- 1. THE ORG
-- ============================================================================
SET @org_name = 'CHANGE ME';  -- <<<<<<<<<<<<<<<<<<<<<<<<<<<< SET THE ORG NAME
SET @org_id = UUID_v4();

CREATE TABLE `Orgs` (
    `id`     VARCHAR(191) NOT NULL,
    `name`   VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `Orgs_name_key`(`name`),
    UNIQUE INDEX `Orgs_domain_key`(`domain`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Orgs` (`id`, `name`, `domain`) VALUES (@org_id, @org_name, NULL);

-- ============================================================================
-- 2. USERS & MEMBERSHIPS
-- ============================================================================
RENAME TABLE `user` TO `Users`;
ALTER TABLE `Users` RENAME COLUMN `password` TO `password_hash`;
ALTER TABLE `Users` RENAME COLUMN `is_admin` TO `is_super_admin`;
ALTER TABLE `Users` RENAME KEY `user_username_key` TO `Users_username_key`;
ALTER TABLE `Users` RENAME KEY `user_email_key` TO `Users_email_key`;

CREATE TABLE `OrgMemberships` (
    `id`      VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `org_id`  VARCHAR(191) NOT NULL,
    `role`    ENUM('GUEST', 'MEMBER', 'MANAGER') NOT NULL DEFAULT 'MEMBER',

    PRIMARY KEY (`id`),
    UNIQUE INDEX `OrgMemberships_user_id_org_id_key`(`user_id`, `org_id`),
    UNIQUE INDEX `OrgMemberships_id_org_id_key`(`id`, `org_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `OrgMemberships` (`id`, `user_id`, `org_id`, `role`)
SELECT UUID_v4(), `id`, @org_id, IF(`is_super_admin`, 'MANAGER', 'MEMBER')
FROM `Users`;

-- ============================================================================
-- 3. GROUPS & GROUP MEMBERSHIPS (from user_group / _user_group)
-- ============================================================================
CREATE TABLE `Groups` (
    `id`     VARCHAR(191) NOT NULL,
    `name`   VARCHAR(191) NOT NULL,
    `org_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `Groups_org_id_name_key`(`org_id`, `name`),
    UNIQUE INDEX `Groups_id_org_id_key`(`id`, `org_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `GroupMemberships` (
    `membership_id` VARCHAR(191) NOT NULL,
    `org_id`        VARCHAR(191) NOT NULL,
    `group_id`      VARCHAR(191) NOT NULL,

    PRIMARY KEY (`membership_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Old groups keep their ids; names were globally unique so org-scoped unique holds.
INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT `id`, `name`, @org_id FROM `user_group`;

-- _user_group: A = user id, B = user_group id
INSERT INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, @org_id, ug.`B`
FROM `_user_group` ug
JOIN `OrgMemberships` om ON om.`user_id` = ug.`A` AND om.`org_id` = @org_id;

-- ============================================================================
-- 4. ACCESS CONTROLS (one per meta roadmap)
-- ============================================================================
CREATE TABLE `AccessControls` (
    `id`           VARCHAR(191) NOT NULL,
    `created_at`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at`   DATETIME(3) NOT NULL,
    `org_id`       VARCHAR(191) NOT NULL,
    `is_public`    BOOLEAN NOT NULL DEFAULT false,
    `org_readable` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `AccessControls_id_org_id_key`(`id`, `org_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccessGrants` (
    `access_control_id` VARCHAR(191) NOT NULL,
    `group_id`          VARCHAR(191) NOT NULL,
    `org_id`            VARCHAR(191) NOT NULL,
    `access_level`      ENUM('RO', 'RW') NOT NULL DEFAULT 'RO',

    PRIMARY KEY (`access_control_id`, `group_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `meta_roadmap` ADD COLUMN `access_control_id` VARCHAR(191) NULL;
UPDATE `meta_roadmap` SET `access_control_id` = UUID_v4();

INSERT INTO `AccessControls` (`id`, `created_at`, `updated_at`, `org_id`, `is_public`, `org_readable`)
SELECT
    mr.`access_control_id`, NOW(3), NOW(3), @org_id,
    (mr.`is_public` OR EXISTS (SELECT 1 FROM `roadmap` r WHERE r.`meta_roadmap_id` = mr.`id` AND r.`is_public`)),
    FALSE
FROM `meta_roadmap` mr;

ALTER TABLE `meta_roadmap` MODIFY `access_control_id` VARCHAR(191) NOT NULL;

-- ============================================================================
-- 5. GRANTS FROM OLD GROUP LISTS (version-level folded up to the meta)
--    RO first, then RW upserts so edit wins over view.
--    M2M columns: A = meta_roadmap/roadmap id, B = user_group id.
-- ============================================================================
INSERT IGNORE INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mr.`access_control_id`, vg.`B`, @org_id, 'RO'
FROM `_meta_roadmap_view_groups` vg JOIN `meta_roadmap` mr ON mr.`id` = vg.`A`;

INSERT IGNORE INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mr.`access_control_id`, vg.`B`, @org_id, 'RO'
FROM `_roadmap_view_groups` vg
JOIN `roadmap` r ON r.`id` = vg.`A`
JOIN `meta_roadmap` mr ON mr.`id` = r.`meta_roadmap_id`;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mr.`access_control_id`, eg.`B`, @org_id, 'RW'
FROM `_meta_roadmap_edit_groups` eg JOIN `meta_roadmap` mr ON mr.`id` = eg.`A`
ON DUPLICATE KEY UPDATE `access_level` = 'RW';

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mr.`access_control_id`, eg.`B`, @org_id, 'RW'
FROM `_roadmap_edit_groups` eg
JOIN `roadmap` r ON r.`id` = eg.`A`
JOIN `meta_roadmap` mr ON mr.`id` = r.`meta_roadmap_id`
ON DUPLICATE KEY UPDATE `access_level` = 'RW';

-- ============================================================================
-- 6. SYNTHETIC GROUPS FOR INDIVIDUAL EDITORS/VIEWERS (and authors, who
--    previously had implicit edit rights). M2M columns: A = item id, B = user id.
-- ============================================================================
CREATE TEMPORARY TABLE `tmp_rw_users` AS
SELECT mr.`id` AS meta_id, e.`B` AS user_id
FROM `_meta_roadmap_editors` e JOIN `meta_roadmap` mr ON mr.`id` = e.`A`
UNION
SELECT r.`meta_roadmap_id`, e.`B`
FROM `_roadmap_editors` e JOIN `roadmap` r ON r.`id` = e.`A`
UNION
SELECT mr.`id`, mr.`author_id` FROM `meta_roadmap` mr
UNION
SELECT r.`meta_roadmap_id`, r.`author_id` FROM `roadmap` r;

CREATE TEMPORARY TABLE `tmp_ro_users` AS
SELECT candidates.meta_id, candidates.user_id FROM (
    SELECT mr.`id` AS meta_id, v.`B` AS user_id
    FROM `_meta_roadmap_viewers` v JOIN `meta_roadmap` mr ON mr.`id` = v.`A`
    UNION
    SELECT r.`meta_roadmap_id`, v.`B`
    FROM `_roadmap_viewers` v JOIN `roadmap` r ON r.`id` = v.`A`
) candidates
LEFT JOIN `tmp_rw_users` rw ON rw.meta_id = candidates.meta_id AND rw.user_id = candidates.user_id
WHERE rw.user_id IS NULL;

CREATE TEMPORARY TABLE `tmp_rw_groups` AS
SELECT meta_id, UUID_v4() AS group_id FROM (SELECT DISTINCT meta_id FROM `tmp_rw_users`) t;
CREATE TEMPORARY TABLE `tmp_ro_groups` AS
SELECT meta_id, UUID_v4() AS group_id FROM (SELECT DISTINCT meta_id FROM `tmp_ro_users`) t;

INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT g.group_id, CONCAT(LEFT(mr.`name`, 140), ' editors (', LEFT(mr.`id`, 8), ')'), @org_id
FROM `tmp_rw_groups` g JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id;

INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT g.group_id, CONCAT(LEFT(mr.`name`, 140), ' viewers (', LEFT(mr.`id`, 8), ')'), @org_id
FROM `tmp_ro_groups` g JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id;

INSERT IGNORE INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, @org_id, g.group_id
FROM `tmp_rw_users` u
JOIN `tmp_rw_groups` g ON g.meta_id = u.meta_id
JOIN `OrgMemberships` om ON om.`user_id` = u.user_id AND om.`org_id` = @org_id;

INSERT IGNORE INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, @org_id, g.group_id
FROM `tmp_ro_users` u
JOIN `tmp_ro_groups` g ON g.meta_id = u.meta_id
JOIN `OrgMemberships` om ON om.`user_id` = u.user_id AND om.`org_id` = @org_id;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT mr.`access_control_id`, g.group_id, @org_id, 'RW'
FROM `tmp_rw_groups` g JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT mr.`access_control_id`, g.group_id, @org_id, 'RO'
FROM `tmp_ro_groups` g JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id;

DROP TEMPORARY TABLE `tmp_rw_users`, `tmp_ro_users`, `tmp_rw_groups`, `tmp_ro_groups`;

-- ============================================================================
-- 7. PUBLISHED_AT + ORG OWNERSHIP COLUMNS
-- ============================================================================
ALTER TABLE `roadmap` ADD COLUMN `published_at` DATETIME(3) NULL;
UPDATE `roadmap` SET `published_at` = `created_at`;

ALTER TABLE `data_series` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `data_series` SET `org_id` = @org_id;
ALTER TABLE `data_series` MODIFY `org_id` VARCHAR(191) NOT NULL;

ALTER TABLE `recipe` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `recipe` SET `org_id` = @org_id;
ALTER TABLE `recipe` MODIFY `org_id` VARCHAR(191) NOT NULL;

ALTER TABLE `action` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `action` SET `org_id` = @org_id;
ALTER TABLE `action` MODIFY `org_id` VARCHAR(191) NOT NULL;

-- ============================================================================
-- 8. MANDATORY RECIPES: backfill inline manual recipes for bare series.
--    Variable id = the series' own id (stable & unique), equation reads it.
-- ============================================================================
SET FOREIGN_KEY_CHECKS = 0;

UPDATE `data_series` SET `recipe_used_id` = UUID_v4() WHERE `recipe_used_id` IS NULL;

INSERT INTO `recipe` (`id`, `recipe`, `org_id`)
SELECT
    ds.`recipe_used_id`,
    JSON_OBJECT(
        'name', 'Manual data series',
        'equation', CONCAT('${', ds.`id`, '}'),
        'variables', JSON_ARRAY(JSON_OBJECT(
            'id', ds.`id`,
            'name', 'Manual data series',
            'type', 'dataSeries',
            'pick', 'whole',
            'unit', ds.`unit`,
            'dataSeriesId', NULL,
            'value', COALESCE(
                -- Key format must satisfy isISOIshDate (src/types/typeguards.ts): YYYY-MM-DDT00:00:00.000Z
                (SELECT JSON_OBJECTAGG(DATE_FORMAT(dr.`timestamp`, '%Y-%m-%dT00:00:00.000Z'), dr.`value`)
                 FROM `date_record` dr WHERE dr.`data_series_id` = ds.`id`),
                JSON_OBJECT()
            )
        )),
        'unit', ds.`unit`,
        'meta', JSON_OBJECT('v', 1, 'isManual', TRUE)
    ),
    @org_id
FROM `data_series` ds
LEFT JOIN `recipe` r ON r.`id` = ds.`recipe_used_id`
WHERE r.`id` IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- recipe_used becomes required (Restrict) and 1:1
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_recipe_used_id_fkey`;
ALTER TABLE `data_series` MODIFY `recipe_used_id` VARCHAR(191) NOT NULL;

-- ============================================================================
-- 9. AUTHORS BECOME NULLABLE (SetNull) — cosmetic only, users stay deletable
-- ============================================================================
ALTER TABLE `meta_roadmap` DROP FOREIGN KEY `meta_roadmap_author_id_fkey`;
ALTER TABLE `meta_roadmap` MODIFY `author_id` VARCHAR(191) NULL;
ALTER TABLE `roadmap` DROP FOREIGN KEY `roadmap_author_id_fkey`;
ALTER TABLE `roadmap` MODIFY `author_id` VARCHAR(191) NULL;
ALTER TABLE `goal` DROP FOREIGN KEY `goal_author_id_fkey`;
ALTER TABLE `goal` MODIFY `author_id` VARCHAR(191) NULL;
ALTER TABLE `data_series` DROP FOREIGN KEY `data_series_author_id_fkey`;
ALTER TABLE `data_series` MODIFY `author_id` VARCHAR(191) NULL;
ALTER TABLE `action` DROP FOREIGN KEY `action_author_id_fkey`;
ALTER TABLE `action` MODIFY `author_id` VARCHAR(191) NULL;
ALTER TABLE `comment` DROP FOREIGN KEY `comment_author_id_fkey`;
ALTER TABLE `comment` MODIFY `author_id` VARCHAR(191) NULL;

-- date_record now dies with its series
ALTER TABLE `date_record` DROP FOREIGN KEY `date_record_data_series_id_fkey`;

-- ============================================================================
-- 10. DROP THE OLD ACCESS-CONTROL WORLD
-- ============================================================================
DROP TABLE `_meta_roadmap_editors`, `_meta_roadmap_viewers`,
           `_meta_roadmap_edit_groups`, `_meta_roadmap_view_groups`,
           `_roadmap_editors`, `_roadmap_viewers`,
           `_roadmap_edit_groups`, `_roadmap_view_groups`,
           `_user_group`;
DROP TABLE `user_group`;
ALTER TABLE `meta_roadmap` DROP COLUMN `is_public`;
ALTER TABLE `roadmap` DROP COLUMN `is_public`;

-- ============================================================================
-- 11. RENAMES: tables to plural Pascal, roadmap terminology shift
-- ============================================================================
RENAME TABLE
    `meta_roadmap` TO `Roadmaps`,
    `roadmap`      TO `RoadmapIterations`,
    `goal`         TO `Goals`,
    `data_series`  TO `DataSeries`,
    `date_record`  TO `DateRecords`,
    `recipe`       TO `Recipes`,
    `goal_tag`     TO `GoalTags`,
    `_goal_tag`    TO `_goal_tags`,
    `action`       TO `Actions`,
    `action_field` TO `ActionFields`,
    `effect`       TO `Effects`,
    `comment`      TO `Comments`;

ALTER TABLE `RoadmapIterations` RENAME COLUMN `meta_roadmap_id` TO `roadmap_id`;
ALTER TABLE `RoadmapIterations` RENAME KEY `roadmap_meta_roadmap_id_version_key` TO `RoadmapIterations_roadmap_id_version_key`;
ALTER TABLE `Goals` RENAME COLUMN `roadmap_id` TO `roadmap_iteration_id`;
ALTER TABLE `Actions` RENAME COLUMN `roadmap_id` TO `roadmap_iteration_id`;
-- Comments: order matters — free up roadmap_id before meta_roadmap_id claims it
ALTER TABLE `Comments` RENAME COLUMN `roadmap_id` TO `roadmap_iteration_id`;
ALTER TABLE `Comments` RENAME COLUMN `meta_roadmap_id` TO `roadmap_id`;

-- _goal_tags column swap: "GoalTags" now sorts before "Goals", so Prisma
-- expects A = GoalTags.name, B = Goals.id (was A = goal id, B = tag name).
-- FKs follow the renamed columns, so data and references stay correct.
ALTER TABLE `_goal_tags` RENAME COLUMN `A` TO `tmp_swap`;
ALTER TABLE `_goal_tags` RENAME COLUMN `B` TO `A`;
ALTER TABLE `_goal_tags` RENAME COLUMN `tmp_swap` TO `B`;

-- ============================================================================
-- 12. NEW CONSTRAINTS (Prisma-default names)
-- ============================================================================
-- Unshared series: one dependent per slot
ALTER TABLE `Goals` ADD UNIQUE INDEX `Goals_data_series_id_key`(`data_series_id`);
ALTER TABLE `Goals` ADD UNIQUE INDEX `Goals_baseline_id_key`(`baseline_id`);
ALTER TABLE `Goals` ADD UNIQUE INDEX `Goals_historical_id_key`(`historical_id`);
ALTER TABLE `Effects` ADD UNIQUE INDEX `Effects_data_series_id_key`(`data_series_id`);
-- 1:1 recipe
ALTER TABLE `DataSeries` ADD UNIQUE INDEX `DataSeries_recipe_used_id_key`(`recipe_used_id`);

-- Re-added / new foreign keys
ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_recipe_used_id_fkey`
    FOREIGN KEY (`recipe_used_id`) REFERENCES `Recipes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `DateRecords` ADD CONSTRAINT `DateRecords_data_series_id_fkey`
    FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RoadmapIterations` ADD CONSTRAINT `RoadmapIterations_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_author_id_fkey`
    FOREIGN KEY (`author_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_access_control_id_fkey`
    FOREIGN KEY (`access_control_id`) REFERENCES `AccessControls`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DataSeries` ADD CONSTRAINT `DataSeries_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Recipes` ADD CONSTRAINT `Recipes_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Groups` ADD CONSTRAINT `Groups_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GroupMemberships` ADD CONSTRAINT `GroupMemberships_membership_id_org_id_fkey`
    FOREIGN KEY (`membership_id`, `org_id`) REFERENCES `OrgMemberships`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GroupMemberships` ADD CONSTRAINT `GroupMemberships_group_id_org_id_fkey`
    FOREIGN KEY (`group_id`, `org_id`) REFERENCES `Groups`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessControls` ADD CONSTRAINT `AccessControls_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessGrants` ADD CONSTRAINT `AccessGrants_access_control_id_org_id_fkey`
    FOREIGN KEY (`access_control_id`, `org_id`) REFERENCES `AccessControls`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `AccessGrants` ADD CONSTRAINT `AccessGrants_group_id_org_id_fkey`
    FOREIGN KEY (`group_id`, `org_id`) REFERENCES `Groups`(`id`, `org_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 13. RESET MIGRATION HISTORY (leveling happens after this — see below)
-- ============================================================================
TRUNCATE `_prisma_migrations`;

-- ============================================================================
-- LEVELING (run in the repo after this script succeeds):
--   rm -rf prisma/migrations
--   mkdir -p prisma/migrations/0_init
--   printf 'provider = "mysql"' > prisma/migrations/migration_lock.toml
--   yarn prisma migrate diff --from-empty \
--     --to-schema-datamodel prisma/schema.prisma --script \
--     > prisma/migrations/0_init/migration.sql
--   yarn prisma migrate resolve --applied 0_init
--   yarn prisma generate
-- Then run `yarn prisma migrate dev` once; it may emit a small
-- constraint-rename migration for leftover old FK names — apply it.
-- ============================================================================
