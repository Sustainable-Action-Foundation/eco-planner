-- ============================================================================
-- FINAL MANUAL MIGRATION: prod DB -> org-branch schema (2026-07-22)
--
-- PREREQUISITES (in this order):
--   1. Take a backup:  mariadb-dump --single-transaction <db> > backup.sql
--   2. On branch `org`, run `yarn prisma migrate deploy` FIRST.
--      (Prod sits at 20260210104038_better_data_series; deploy applies the
--      3 pending 2026 migrations: move_historical, drop_notes,
--      update_action_and_drop_links.) This script starts from that state.
--   3. Run the PREFLIGHT queries below; every one must return ZERO rows.
--   4. Run this script.
--   5. Level the migration history (see instructions at the bottom).
--
-- DECISIONS BAKED IN (review before running):
--   * ELEVEN orgs are seeded (see section 1). Users join the org matching
--     their email domain (exact match on the part after '@'); old is_admin
--     users become MANAGER of their org and stay superadmins. An org whose
--     domain matches no admin simply has no manager (superadmins cover it).
--   * Ownership is derived, parent-takes-precedence:
--       roadmap AC org   = the roadmap author's org
--       action org       = its roadmap's org (author's org if roadmapless)
--       data series org  = its parent goal/effect roadmap's org
--                          (author's org if orphaned)
--       recipe org       = its data series' org
--   * Old user_group rows become Groups of the MAJORITY org of their members
--     (deterministic tiebreak); memberless groups are dropped.
--   * Anyone needing membership in a group of an org that is not their home
--     org gets a GUEST OrgMembership there (the designed cross-org path).
--   * Old group grants pointing at another org's roadmap cannot survive as
--     grants (same-org composite FK); those groups' members are expanded
--     into the synthetic per-roadmap groups below instead. Access preserved,
--     structure changed.
--   * One AccessControl per (meta) roadmap. is_public = meta OR any version
--     public. org_readable = FALSE for migrated items (preserves old privacy;
--     app defaults new items to TRUE).
--   * Version-level editors/viewers/groups fold up to the roadmap level.
--   * Individual editors/viewers (incl. authors, who previously had edit
--     rights) become synthetic groups "<name> editors (<id8>)" /
--     "<name> viewers (<id8>)" with RW / RO grants, in the roadmap's org.
--   * All existing roadmap versions get published_at = created_at.
--   * Series without a recipe get a backfilled inline manual recipe
--     (meta.isManual, values from date_record keyed YYYY-MM-DDT00:00:00.000Z
--     per isISOIshDate, unit copied; NULL unit serializes as JSON null).
--
-- KNOWN LEFTOVER: old FK/index *names* are kept where the constraint itself
-- is unchanged; the first `prisma migrate dev` after leveling emits a
-- cosmetic rename migration (verified: 37 rename ops, zero structural).
-- ============================================================================

-- ============================================================================
-- PREFLIGHT — run separately; every query must return zero rows.
-- ============================================================================
-- A. Users whose email domain matches no seeded org (HARD STOP — everything
--    below derives ownership from user->org, so fix emails or add orgs first):
-- SELECT id, username, email FROM user
--   WHERE SUBSTRING_INDEX(email, '@', -1) NOT IN
--   ('hylte.se','llt.lulea.se','lulea.se','pitea.se','stuns.se','sundsvall.se',
--    'sustainable-action.ngo','sustainable-action.org','tranas.se','trosa.se','varberg.se');
-- B. A series referenced by more than one goal slot / effect (breaks new UNIQUEs):
-- SELECT data_series_id, COUNT(*) c FROM goal WHERE data_series_id IS NOT NULL GROUP BY data_series_id HAVING c > 1;
-- SELECT baseline_id,    COUNT(*) c FROM goal WHERE baseline_id    IS NOT NULL GROUP BY baseline_id    HAVING c > 1;
-- SELECT historical_id,  COUNT(*) c FROM goal WHERE historical_id  IS NOT NULL GROUP BY historical_id  HAVING c > 1;
-- SELECT data_series_id, COUNT(*) c FROM effect WHERE data_series_id IS NOT NULL GROUP BY data_series_id HAVING c > 1;
-- C. Cross-slot sharing (same series in two different slots):
-- SELECT id, COUNT(*) c FROM (
--   SELECT data_series_id AS id FROM goal WHERE data_series_id IS NOT NULL
--   UNION ALL SELECT baseline_id FROM goal WHERE baseline_id IS NOT NULL
--   UNION ALL SELECT historical_id FROM goal WHERE historical_id IS NOT NULL
--   UNION ALL SELECT data_series_id FROM effect WHERE data_series_id IS NOT NULL
-- ) refs GROUP BY id HAVING c > 1;
-- D. A recipe already shared by several series (breaks recipe_used_id UNIQUE):
-- SELECT recipe_used_id, COUNT(*) c FROM data_series WHERE recipe_used_id IS NOT NULL GROUP BY recipe_used_id HAVING c > 1;

-- ============================================================================
-- 1. THE ORGS
-- ============================================================================
CREATE TABLE `Orgs` (
    `id`     VARCHAR(191) NOT NULL,
    `name`   VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,

    PRIMARY KEY (`id`),
    UNIQUE INDEX `Orgs_name_key`(`name`),
    UNIQUE INDEX `Orgs_domain_key`(`domain`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Orgs` (`id`, `name`, `domain`) VALUES
    (UUID_v4(), 'Hylte',      'hylte.se'),
    (UUID_v4(), 'LLT',        'llt.lulea.se'),
    (UUID_v4(), 'Luleå',      'lulea.se'),
    (UUID_v4(), 'Piteå',      'pitea.se'),
    (UUID_v4(), 'STUNS',      'stuns.se'),
    (UUID_v4(), 'Sundsvall',  'sundsvall.se'),
    (UUID_v4(), 'SAF-ngo',    'sustainable-action.ngo'),
    (UUID_v4(), 'SAF-org',    'sustainable-action.org'),
    (UUID_v4(), 'Tranås',     'tranas.se'),
    (UUID_v4(), 'Tros',       'trosa.se'),
    (UUID_v4(), 'Varberg',    'varberg.se');

-- ============================================================================
-- 2. USERS & HOME MEMBERSHIPS (by email domain)
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

-- Helper: each user's home org (dropped in section 13)
CREATE TABLE `_migration_user_org` AS
SELECT u.`id` AS user_id, o.`id` AS org_id
FROM `Users` u
JOIN `Orgs` o ON o.`domain` = SUBSTRING_INDEX(u.`email`, '@', -1);

INSERT INTO `OrgMemberships` (`id`, `user_id`, `org_id`, `role`)
SELECT UUID_v4(), u.`id`, uo.org_id, IF(u.`is_super_admin`, 'MANAGER', 'MEMBER')
FROM `Users` u
JOIN `_migration_user_org` uo ON uo.user_id = u.`id`;

-- ============================================================================
-- 3. ACCESS CONTROLS (one per meta roadmap, owned by the author's org)
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
    mr.`access_control_id`, NOW(3), NOW(3), uo.org_id,
    (mr.`is_public` OR EXISTS (SELECT 1 FROM `roadmap` r WHERE r.`meta_roadmap_id` = mr.`id` AND r.`is_public`)),
    FALSE
FROM `meta_roadmap` mr
JOIN `_migration_user_org` uo ON uo.user_id = mr.`author_id`;

-- Fails here if any author was unmatched (preflight A protects this)
ALTER TABLE `meta_roadmap` MODIFY `access_control_id` VARCHAR(191) NOT NULL;

-- Helper: meta roadmap -> owning org (dropped in section 13)
CREATE TABLE `_migration_meta_org` AS
SELECT mr.`id` AS meta_id, mr.`access_control_id` AS ac_id, ac.`org_id` AS org_id
FROM `meta_roadmap` mr
JOIN `AccessControls` ac ON ac.`id` = mr.`access_control_id`;

-- ============================================================================
-- 4. GROUPS (majority org of members; memberless groups are dropped)
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

-- Helper: old group -> majority org (dropped in section 13).
-- _user_group: A = user id, B = user_group id.
CREATE TABLE `_migration_group_org` AS
SELECT group_id, org_id FROM (
    SELECT ug.`B` AS group_id, uo.org_id,
           ROW_NUMBER() OVER (PARTITION BY ug.`B` ORDER BY COUNT(*) DESC, uo.org_id) AS rn
    FROM `_user_group` ug
    JOIN `_migration_user_org` uo ON uo.user_id = ug.`A`
    GROUP BY ug.`B`, uo.org_id
) ranked WHERE rn = 1;

INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT ug.`id`, ug.`name`, go.org_id
FROM `user_group` ug
JOIN `_migration_group_org` go ON go.group_id = ug.`id`;

-- GUEST memberships for members whose home org differs from the group's org
INSERT INTO `OrgMemberships` (`id`, `user_id`, `org_id`, `role`)
SELECT UUID_v4(), needed.user_id, needed.org_id, 'GUEST'
FROM (
    SELECT DISTINCT ug.`A` AS user_id, go.org_id
    FROM `_user_group` ug
    JOIN `_migration_group_org` go ON go.group_id = ug.`B`
    LEFT JOIN `OrgMemberships` om ON om.`user_id` = ug.`A` AND om.`org_id` = go.org_id
    WHERE om.`id` IS NULL
) needed;

INSERT IGNORE INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, go.org_id, ug.`B`
FROM `_user_group` ug
JOIN `_migration_group_org` go ON go.group_id = ug.`B`
JOIN `OrgMemberships` om ON om.`user_id` = ug.`A` AND om.`org_id` = go.org_id;

-- ============================================================================
-- 5. DIRECT GRANTS: only same-org group grants survive as grants.
--    RO first, then RW upserts so edit wins over view.
--    M2M columns: A = meta_roadmap/roadmap id, B = user_group id.
-- ============================================================================
INSERT IGNORE INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mo.ac_id, vg.`B`, mo.org_id, 'RO'
FROM `_meta_roadmap_view_groups` vg
JOIN `_migration_meta_org` mo ON mo.meta_id = vg.`A`
JOIN `_migration_group_org` go ON go.group_id = vg.`B` AND go.org_id = mo.org_id;

INSERT IGNORE INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mo.ac_id, vg.`B`, mo.org_id, 'RO'
FROM `_roadmap_view_groups` vg
JOIN `roadmap` r ON r.`id` = vg.`A`
JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
JOIN `_migration_group_org` go ON go.group_id = vg.`B` AND go.org_id = mo.org_id;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mo.ac_id, eg.`B`, mo.org_id, 'RW'
FROM `_meta_roadmap_edit_groups` eg
JOIN `_migration_meta_org` mo ON mo.meta_id = eg.`A`
JOIN `_migration_group_org` go ON go.group_id = eg.`B` AND go.org_id = mo.org_id
ON DUPLICATE KEY UPDATE `access_level` = 'RW';

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT DISTINCT mo.ac_id, eg.`B`, mo.org_id, 'RW'
FROM `_roadmap_edit_groups` eg
JOIN `roadmap` r ON r.`id` = eg.`A`
JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
JOIN `_migration_group_org` go ON go.group_id = eg.`B` AND go.org_id = mo.org_id
ON DUPLICATE KEY UPDATE `access_level` = 'RW';

-- ============================================================================
-- 6. SYNTHETIC GROUPS in the roadmap's org, for:
--      - individual editors/viewers,
--      - authors (previously implicit edit rights),
--      - members of CROSS-ORG grant groups (whose grants cannot survive).
--    M2M columns: individual lists: A = item id, B = user id.
-- ============================================================================
CREATE TABLE `_migration_rw_users` AS
SELECT DISTINCT meta_id, user_id FROM (
    SELECT e.`A` AS meta_id, e.`B` AS user_id FROM `_meta_roadmap_editors` e
    UNION
    SELECT r.`meta_roadmap_id`, e.`B` FROM `_roadmap_editors` e JOIN `roadmap` r ON r.`id` = e.`A`
    UNION
    SELECT mr.`id`, mr.`author_id` FROM `meta_roadmap` mr
    UNION
    SELECT r.`meta_roadmap_id`, r.`author_id` FROM `roadmap` r
    UNION
    SELECT mo.meta_id, ug.`A`
    FROM `_meta_roadmap_edit_groups` eg
    JOIN `_migration_meta_org` mo ON mo.meta_id = eg.`A`
    JOIN `_migration_group_org` go ON go.group_id = eg.`B` AND go.org_id <> mo.org_id
    JOIN `_user_group` ug ON ug.`B` = eg.`B`
    UNION
    SELECT r.`meta_roadmap_id`, ug.`A`
    FROM `_roadmap_edit_groups` eg
    JOIN `roadmap` r ON r.`id` = eg.`A`
    JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
    JOIN `_migration_group_org` go ON go.group_id = eg.`B` AND go.org_id <> mo.org_id
    JOIN `_user_group` ug ON ug.`B` = eg.`B`
) rw;

CREATE TABLE `_migration_ro_users` AS
SELECT DISTINCT meta_id, user_id FROM (
    SELECT v.`A` AS meta_id, v.`B` AS user_id FROM `_meta_roadmap_viewers` v
    UNION
    SELECT r.`meta_roadmap_id`, v.`B` FROM `_roadmap_viewers` v JOIN `roadmap` r ON r.`id` = v.`A`
    UNION
    SELECT mo.meta_id, ug.`A`
    FROM `_meta_roadmap_view_groups` vg
    JOIN `_migration_meta_org` mo ON mo.meta_id = vg.`A`
    JOIN `_migration_group_org` go ON go.group_id = vg.`B` AND go.org_id <> mo.org_id
    JOIN `_user_group` ug ON ug.`B` = vg.`B`
    UNION
    SELECT r.`meta_roadmap_id`, ug.`A`
    FROM `_roadmap_view_groups` vg
    JOIN `roadmap` r ON r.`id` = vg.`A`
    JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
    JOIN `_migration_group_org` go ON go.group_id = vg.`B` AND go.org_id <> mo.org_id
    JOIN `_user_group` ug ON ug.`B` = vg.`B`
) ro;

-- RW wins: drop RO rows for users who already have RW on the same roadmap
DELETE ro FROM `_migration_ro_users` ro
JOIN `_migration_rw_users` rw ON rw.meta_id = ro.meta_id AND rw.user_id = ro.user_id;

CREATE TABLE `_migration_rw_groups` AS
SELECT meta_id, UUID_v4() AS group_id FROM (SELECT DISTINCT meta_id FROM `_migration_rw_users`) t;
CREATE TABLE `_migration_ro_groups` AS
SELECT meta_id, UUID_v4() AS group_id FROM (SELECT DISTINCT meta_id FROM `_migration_ro_users`) t;

INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT g.group_id, CONCAT(LEFT(mr.`name`, 140), ' editors (', LEFT(mr.`id`, 8), ')'), mo.org_id
FROM `_migration_rw_groups` g
JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id
JOIN `_migration_meta_org` mo ON mo.meta_id = g.meta_id;

INSERT INTO `Groups` (`id`, `name`, `org_id`)
SELECT g.group_id, CONCAT(LEFT(mr.`name`, 140), ' viewers (', LEFT(mr.`id`, 8), ')'), mo.org_id
FROM `_migration_ro_groups` g
JOIN `meta_roadmap` mr ON mr.`id` = g.meta_id
JOIN `_migration_meta_org` mo ON mo.meta_id = g.meta_id;

-- GUEST memberships for synthetic-group members outside the roadmap's org
INSERT INTO `OrgMemberships` (`id`, `user_id`, `org_id`, `role`)
SELECT UUID_v4(), needed.user_id, needed.org_id, 'GUEST'
FROM (
    SELECT DISTINCT u.user_id, mo.org_id
    FROM (
        SELECT meta_id, user_id FROM `_migration_rw_users`
        UNION SELECT meta_id, user_id FROM `_migration_ro_users`
    ) u
    JOIN `_migration_meta_org` mo ON mo.meta_id = u.meta_id
    LEFT JOIN `OrgMemberships` om ON om.`user_id` = u.user_id AND om.`org_id` = mo.org_id
    WHERE om.`id` IS NULL
) needed;

INSERT IGNORE INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, mo.org_id, g.group_id
FROM `_migration_rw_users` u
JOIN `_migration_rw_groups` g ON g.meta_id = u.meta_id
JOIN `_migration_meta_org` mo ON mo.meta_id = u.meta_id
JOIN `OrgMemberships` om ON om.`user_id` = u.user_id AND om.`org_id` = mo.org_id;

INSERT IGNORE INTO `GroupMemberships` (`membership_id`, `org_id`, `group_id`)
SELECT om.`id`, mo.org_id, g.group_id
FROM `_migration_ro_users` u
JOIN `_migration_ro_groups` g ON g.meta_id = u.meta_id
JOIN `_migration_meta_org` mo ON mo.meta_id = u.meta_id
JOIN `OrgMemberships` om ON om.`user_id` = u.user_id AND om.`org_id` = mo.org_id;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT mo.ac_id, g.group_id, mo.org_id, 'RW'
FROM `_migration_rw_groups` g
JOIN `_migration_meta_org` mo ON mo.meta_id = g.meta_id;

INSERT INTO `AccessGrants` (`access_control_id`, `group_id`, `org_id`, `access_level`)
SELECT mo.ac_id, g.group_id, mo.org_id, 'RO'
FROM `_migration_ro_groups` g
JOIN `_migration_meta_org` mo ON mo.meta_id = g.meta_id;

-- ============================================================================
-- 7. PUBLISHED_AT + DERIVED ORG OWNERSHIP COLUMNS
-- ============================================================================
ALTER TABLE `roadmap` ADD COLUMN `published_at` DATETIME(3) NULL;
UPDATE `roadmap` SET `published_at` = `created_at`;

-- Actions: org of their roadmap; author's org if roadmapless
ALTER TABLE `action` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `action` a
JOIN `roadmap` r ON r.`id` = a.`roadmap_id`
JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
SET a.`org_id` = mo.org_id;
UPDATE `action` a
JOIN `_migration_user_org` uo ON uo.user_id = a.`author_id`
SET a.`org_id` = uo.org_id
WHERE a.`org_id` IS NULL;
ALTER TABLE `action` MODIFY `org_id` VARCHAR(191) NOT NULL;

-- Data series: org of the roadmap they hang under, via any slot; author's org if orphaned
ALTER TABLE `data_series` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `data_series` ds
JOIN `goal` g ON ds.`id` IN (g.`data_series_id`, g.`baseline_id`, g.`historical_id`)
JOIN `roadmap` r ON r.`id` = g.`roadmap_id`
JOIN `_migration_meta_org` mo ON mo.meta_id = r.`meta_roadmap_id`
SET ds.`org_id` = mo.org_id;
UPDATE `data_series` ds
JOIN `effect` e ON e.`data_series_id` = ds.`id`
JOIN `action` a ON a.`id` = e.`action_id`
SET ds.`org_id` = a.`org_id`
WHERE ds.`org_id` IS NULL;
UPDATE `data_series` ds
JOIN `_migration_user_org` uo ON uo.user_id = ds.`author_id`
SET ds.`org_id` = uo.org_id
WHERE ds.`org_id` IS NULL;
ALTER TABLE `data_series` MODIFY `org_id` VARCHAR(191) NOT NULL;

-- Recipes: org of their series (set after backfill for the new ones)
ALTER TABLE `recipe` ADD COLUMN `org_id` VARCHAR(191) NULL;
UPDATE `recipe` rc
JOIN `data_series` ds ON ds.`recipe_used_id` = rc.`id`
SET rc.`org_id` = ds.`org_id`
WHERE rc.`org_id` IS NULL;

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
    ds.`org_id`
FROM `data_series` ds
LEFT JOIN `recipe` r ON r.`id` = ds.`recipe_used_id`
WHERE r.`id` IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

ALTER TABLE `recipe` MODIFY `org_id` VARCHAR(191) NOT NULL;

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
-- 13. CLEANUP + RESET MIGRATION HISTORY
-- ============================================================================
DROP TABLE `_migration_user_org`, `_migration_meta_org`, `_migration_group_org`,
           `_migration_rw_users`, `_migration_ro_users`,
           `_migration_rw_groups`, `_migration_ro_groups`;

TRUNCATE `_prisma_migrations`;

-- ============================================================================
-- LEVELING (run in the repo after this script succeeds):
--   rm -rf prisma/migrations
--   mkdir -p prisma/migrations/0_init
--   printf 'provider = "mysql"' > prisma/migrations/migration_lock.toml
--   yarn prisma migrate diff --from-empty \
--     --to-schema prisma/schema.prisma --script \
--     > prisma/migrations/0_init/migration.sql
--   yarn prisma migrate resolve --applied 0_init
--   yarn prisma generate
-- Then run `yarn prisma migrate dev` once; it emits a small
-- constraint-rename migration for leftover old FK names — apply it.
-- ============================================================================
