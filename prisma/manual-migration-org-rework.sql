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
    (UUID_v4(), 'Trosa',      'trosa.se'),
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
    -- Latest role change (who/when), written by the org-membership API; starts empty
    `role_changed_at`    DATETIME(3) NULL,
    `role_changed_by_id` VARCHAR(191) NULL,

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

-- Pending guest invitations (new feature; starts empty, no data to migrate)
CREATE TABLE `GuestInvites` (
    `token`         VARCHAR(191) NOT NULL,
    `email`         VARCHAR(191) NOT NULL,
    `created_at`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `org_id`        VARCHAR(191) NOT NULL,
    `invited_by_id` VARCHAR(191) NULL,

    UNIQUE INDEX `GuestInvites_org_id_email_key`(`org_id`, `email`),
    PRIMARY KEY (`token`)
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

-- Canonicalize ActionFields headers to the app's enum-ish UPPER_SNAKE keys
-- (migration 20260720131447 wrote them lowercase; the collation is case-insensitive
-- so the IN matches regardless of case, but the app compares headers in JS where
-- case matters — see src/functions/actionFields.ts). Idempotent.
UPDATE `ActionFields` SET `header` = UPPER(`header`)
WHERE `header` IN ('description', 'cost_efficiency', 'expected_outcome', 'project_manager', 'relevant_actors', 'tag');

-- Semantic field types (rendering hint; the value stays a string). Old data was
-- all textareas, so everything defaults to PARAGRAPH except the canonical headers
-- known to hold short values (names, tags). List-ness is structural (repeated
-- headers), not typed — see src/functions/actionFields.ts.
ALTER TABLE `ActionFields` ADD COLUMN `type` ENUM('PARAGRAPH', 'DATE', 'SHORT') NOT NULL DEFAULT 'PARAGRAPH';
UPDATE `ActionFields` SET `type` = 'SHORT'
WHERE `header` IN ('RELEVANT_ACTORS', 'PROJECT_MANAGER', 'TAG');

-- Display order within each action. Old data has no meaningful order, so assign
-- a stable one: grouped by header (canonical prose first is not attempted; plain
-- alphabetical), ties broken by id. New writes set order explicitly.
ALTER TABLE `ActionFields` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;
UPDATE `ActionFields` af
JOIN (
    SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `action_id` ORDER BY `header`, `id`) - 1 AS `new_order`
    FROM `ActionFields`
) numbered ON numbered.`id` = af.`id`
SET af.`order` = numbered.`new_order`;

-- ============================================================================
-- 11b. GEO AREAS: static SCB region lookup + geo markers on Roadmaps and Orgs
-- ============================================================================
-- Seeded from src/lib/areaCodes.json (name -> SCB code); "00" = Riket,
-- 2-digit = county (parent "00"), 4-digit = municipality (parent = first two digits).
CREATE TABLE `GeoAreas` (
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('NATION', 'COUNTY', 'MUNICIPALITY') NOT NULL,
    `parent_code` VARCHAR(191) NULL,

    PRIMARY KEY (`code`),
    INDEX `GeoAreas_name_idx`(`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `GeoAreas` (`code`, `name`, `type`, `parent_code`) VALUES
    ('00', 'Riket', 'NATION', NULL),
    ('01', 'Stockholms län', 'COUNTY', '00'),
    ('03', 'Uppsala län', 'COUNTY', '00'),
    ('04', 'Södermanlands län', 'COUNTY', '00'),
    ('05', 'Östergötlands län', 'COUNTY', '00'),
    ('06', 'Jönköpings län', 'COUNTY', '00'),
    ('07', 'Kronobergs län', 'COUNTY', '00'),
    ('08', 'Kalmar län', 'COUNTY', '00'),
    ('09', 'Gotlands län', 'COUNTY', '00'),
    ('10', 'Blekinge län', 'COUNTY', '00'),
    ('12', 'Skåne län', 'COUNTY', '00'),
    ('13', 'Hallands län', 'COUNTY', '00'),
    ('14', 'Västra Götalands län', 'COUNTY', '00'),
    ('17', 'Värmlands län', 'COUNTY', '00'),
    ('18', 'Örebro län', 'COUNTY', '00'),
    ('19', 'Västmanlands län', 'COUNTY', '00'),
    ('20', 'Dalarnas län', 'COUNTY', '00'),
    ('21', 'Gävleborgs län', 'COUNTY', '00'),
    ('22', 'Västernorrlands län', 'COUNTY', '00'),
    ('23', 'Jämtlands län', 'COUNTY', '00'),
    ('24', 'Västerbottens län', 'COUNTY', '00'),
    ('25', 'Norrbottens län', 'COUNTY', '00'),
    ('0114', 'Upplands Väsby', 'MUNICIPALITY', '01'),
    ('0115', 'Vallentuna', 'MUNICIPALITY', '01'),
    ('0117', 'Österåker', 'MUNICIPALITY', '01'),
    ('0120', 'Värmdö', 'MUNICIPALITY', '01'),
    ('0123', 'Järfälla', 'MUNICIPALITY', '01'),
    ('0125', 'Ekerö', 'MUNICIPALITY', '01'),
    ('0126', 'Huddinge', 'MUNICIPALITY', '01'),
    ('0127', 'Botkyrka', 'MUNICIPALITY', '01'),
    ('0128', 'Salem', 'MUNICIPALITY', '01'),
    ('0136', 'Haninge', 'MUNICIPALITY', '01'),
    ('0138', 'Tyresö', 'MUNICIPALITY', '01'),
    ('0139', 'Upplands-Bro', 'MUNICIPALITY', '01'),
    ('0140', 'Nykvarn', 'MUNICIPALITY', '01'),
    ('0160', 'Täby', 'MUNICIPALITY', '01'),
    ('0162', 'Danderyd', 'MUNICIPALITY', '01'),
    ('0163', 'Sollentuna', 'MUNICIPALITY', '01'),
    ('0180', 'Stockholm', 'MUNICIPALITY', '01'),
    ('0181', 'Södertälje', 'MUNICIPALITY', '01'),
    ('0182', 'Nacka', 'MUNICIPALITY', '01'),
    ('0183', 'Sundbyberg', 'MUNICIPALITY', '01'),
    ('0184', 'Solna', 'MUNICIPALITY', '01'),
    ('0186', 'Lidingö', 'MUNICIPALITY', '01'),
    ('0187', 'Vaxholm', 'MUNICIPALITY', '01'),
    ('0188', 'Norrtälje', 'MUNICIPALITY', '01'),
    ('0191', 'Sigtuna', 'MUNICIPALITY', '01'),
    ('0192', 'Nynäshamn', 'MUNICIPALITY', '01'),
    ('0305', 'Håbo', 'MUNICIPALITY', '03'),
    ('0319', 'Älvkarleby', 'MUNICIPALITY', '03'),
    ('0330', 'Knivsta', 'MUNICIPALITY', '03'),
    ('0331', 'Heby', 'MUNICIPALITY', '03'),
    ('0360', 'Tierp', 'MUNICIPALITY', '03'),
    ('0380', 'Uppsala', 'MUNICIPALITY', '03'),
    ('0381', 'Enköping', 'MUNICIPALITY', '03'),
    ('0382', 'Östhammar', 'MUNICIPALITY', '03'),
    ('0428', 'Vingåker', 'MUNICIPALITY', '04'),
    ('0461', 'Gnesta', 'MUNICIPALITY', '04'),
    ('0480', 'Nyköping', 'MUNICIPALITY', '04'),
    ('0481', 'Oxelösund', 'MUNICIPALITY', '04'),
    ('0482', 'Flen', 'MUNICIPALITY', '04'),
    ('0483', 'Katrineholm', 'MUNICIPALITY', '04'),
    ('0484', 'Eskilstuna', 'MUNICIPALITY', '04'),
    ('0486', 'Strängnäs', 'MUNICIPALITY', '04'),
    ('0488', 'Trosa', 'MUNICIPALITY', '04'),
    ('0509', 'Ödeshög', 'MUNICIPALITY', '05'),
    ('0512', 'Ydre', 'MUNICIPALITY', '05'),
    ('0513', 'Kinda', 'MUNICIPALITY', '05'),
    ('0560', 'Boxholm', 'MUNICIPALITY', '05'),
    ('0561', 'Åtvidaberg', 'MUNICIPALITY', '05'),
    ('0562', 'Finspång', 'MUNICIPALITY', '05'),
    ('0563', 'Valdemarsvik', 'MUNICIPALITY', '05'),
    ('0580', 'Linköping', 'MUNICIPALITY', '05'),
    ('0581', 'Norrköping', 'MUNICIPALITY', '05'),
    ('0582', 'Söderköping', 'MUNICIPALITY', '05'),
    ('0583', 'Motala', 'MUNICIPALITY', '05'),
    ('0584', 'Vadstena', 'MUNICIPALITY', '05'),
    ('0586', 'Mjölby', 'MUNICIPALITY', '05'),
    ('0604', 'Aneby', 'MUNICIPALITY', '06'),
    ('0617', 'Gnosjö', 'MUNICIPALITY', '06'),
    ('0642', 'Mullsjö', 'MUNICIPALITY', '06'),
    ('0643', 'Habo', 'MUNICIPALITY', '06'),
    ('0662', 'Gislaved', 'MUNICIPALITY', '06'),
    ('0665', 'Vaggeryd', 'MUNICIPALITY', '06'),
    ('0680', 'Jönköping', 'MUNICIPALITY', '06'),
    ('0682', 'Nässjö', 'MUNICIPALITY', '06'),
    ('0683', 'Värnamo', 'MUNICIPALITY', '06'),
    ('0684', 'Sävsjö', 'MUNICIPALITY', '06'),
    ('0685', 'Vetlanda', 'MUNICIPALITY', '06'),
    ('0686', 'Eksjö', 'MUNICIPALITY', '06'),
    ('0687', 'Tranås', 'MUNICIPALITY', '06'),
    ('0760', 'Uppvidinge', 'MUNICIPALITY', '07'),
    ('0761', 'Lessebo', 'MUNICIPALITY', '07'),
    ('0763', 'Tingsryd', 'MUNICIPALITY', '07'),
    ('0764', 'Alvesta', 'MUNICIPALITY', '07'),
    ('0765', 'Älmhult', 'MUNICIPALITY', '07'),
    ('0767', 'Markaryd', 'MUNICIPALITY', '07'),
    ('0780', 'Växjö', 'MUNICIPALITY', '07'),
    ('0781', 'Ljungby', 'MUNICIPALITY', '07'),
    ('0821', 'Högsby', 'MUNICIPALITY', '08'),
    ('0834', 'Torsås', 'MUNICIPALITY', '08'),
    ('0840', 'Mörbylånga', 'MUNICIPALITY', '08'),
    ('0860', 'Hultsfred', 'MUNICIPALITY', '08'),
    ('0861', 'Mönsterås', 'MUNICIPALITY', '08'),
    ('0862', 'Emmaboda', 'MUNICIPALITY', '08'),
    ('0880', 'Kalmar', 'MUNICIPALITY', '08'),
    ('0881', 'Nybro', 'MUNICIPALITY', '08'),
    ('0882', 'Oskarshamn', 'MUNICIPALITY', '08'),
    ('0883', 'Västervik', 'MUNICIPALITY', '08'),
    ('0884', 'Vimmerby', 'MUNICIPALITY', '08'),
    ('0885', 'Borgholm', 'MUNICIPALITY', '08'),
    ('0980', 'Gotland', 'MUNICIPALITY', '09'),
    ('1060', 'Olofström', 'MUNICIPALITY', '10'),
    ('1080', 'Karlskrona', 'MUNICIPALITY', '10'),
    ('1081', 'Ronneby', 'MUNICIPALITY', '10'),
    ('1082', 'Karlshamn', 'MUNICIPALITY', '10'),
    ('1083', 'Sölvesborg', 'MUNICIPALITY', '10'),
    ('1214', 'Svalöv', 'MUNICIPALITY', '12'),
    ('1230', 'Staffanstorp', 'MUNICIPALITY', '12'),
    ('1231', 'Burlöv', 'MUNICIPALITY', '12'),
    ('1233', 'Vellinge', 'MUNICIPALITY', '12'),
    ('1256', 'Östra Göinge', 'MUNICIPALITY', '12'),
    ('1257', 'Örkelljunga', 'MUNICIPALITY', '12'),
    ('1260', 'Bjuv', 'MUNICIPALITY', '12'),
    ('1261', 'Kävlinge', 'MUNICIPALITY', '12'),
    ('1262', 'Lomma', 'MUNICIPALITY', '12'),
    ('1263', 'Svedala', 'MUNICIPALITY', '12'),
    ('1264', 'Skurup', 'MUNICIPALITY', '12'),
    ('1265', 'Sjöbo', 'MUNICIPALITY', '12'),
    ('1266', 'Hörby', 'MUNICIPALITY', '12'),
    ('1267', 'Höör', 'MUNICIPALITY', '12'),
    ('1270', 'Tomelilla', 'MUNICIPALITY', '12'),
    ('1272', 'Bromölla', 'MUNICIPALITY', '12'),
    ('1273', 'Osby', 'MUNICIPALITY', '12'),
    ('1275', 'Perstorp', 'MUNICIPALITY', '12'),
    ('1276', 'Klippan', 'MUNICIPALITY', '12'),
    ('1277', 'Åstorp', 'MUNICIPALITY', '12'),
    ('1278', 'Båstad', 'MUNICIPALITY', '12'),
    ('1280', 'Malmö', 'MUNICIPALITY', '12'),
    ('1281', 'Lund', 'MUNICIPALITY', '12'),
    ('1282', 'Landskrona', 'MUNICIPALITY', '12'),
    ('1283', 'Helsingborg', 'MUNICIPALITY', '12'),
    ('1284', 'Höganäs', 'MUNICIPALITY', '12'),
    ('1285', 'Eslöv', 'MUNICIPALITY', '12'),
    ('1286', 'Ystad', 'MUNICIPALITY', '12'),
    ('1287', 'Trelleborg', 'MUNICIPALITY', '12'),
    ('1290', 'Kristianstad', 'MUNICIPALITY', '12'),
    ('1291', 'Simrishamn', 'MUNICIPALITY', '12'),
    ('1292', 'Ängelholm', 'MUNICIPALITY', '12'),
    ('1293', 'Hässleholm', 'MUNICIPALITY', '12'),
    ('1315', 'Hylte', 'MUNICIPALITY', '13'),
    ('1380', 'Halmstad', 'MUNICIPALITY', '13'),
    ('1381', 'Laholm', 'MUNICIPALITY', '13'),
    ('1382', 'Falkenberg', 'MUNICIPALITY', '13'),
    ('1383', 'Varberg', 'MUNICIPALITY', '13'),
    ('1384', 'Kungsbacka', 'MUNICIPALITY', '13'),
    ('1401', 'Härryda', 'MUNICIPALITY', '14'),
    ('1402', 'Partille', 'MUNICIPALITY', '14'),
    ('1407', 'Öckerö', 'MUNICIPALITY', '14'),
    ('1415', 'Stenungsund', 'MUNICIPALITY', '14'),
    ('1419', 'Tjörn', 'MUNICIPALITY', '14'),
    ('1421', 'Orust', 'MUNICIPALITY', '14'),
    ('1427', 'Sotenäs', 'MUNICIPALITY', '14'),
    ('1430', 'Munkedal', 'MUNICIPALITY', '14'),
    ('1435', 'Tanum', 'MUNICIPALITY', '14'),
    ('1438', 'Dals-Ed', 'MUNICIPALITY', '14'),
    ('1439', 'Färgelanda', 'MUNICIPALITY', '14'),
    ('1440', 'Ale', 'MUNICIPALITY', '14'),
    ('1441', 'Lerum', 'MUNICIPALITY', '14'),
    ('1442', 'Vårgårda', 'MUNICIPALITY', '14'),
    ('1443', 'Bollebygd', 'MUNICIPALITY', '14'),
    ('1444', 'Grästorp', 'MUNICIPALITY', '14'),
    ('1445', 'Essunga', 'MUNICIPALITY', '14'),
    ('1446', 'Karlsborg', 'MUNICIPALITY', '14'),
    ('1447', 'Gullspång', 'MUNICIPALITY', '14'),
    ('1452', 'Tranemo', 'MUNICIPALITY', '14'),
    ('1460', 'Bengtsfors', 'MUNICIPALITY', '14'),
    ('1461', 'Mellerud', 'MUNICIPALITY', '14'),
    ('1462', 'Lilla Edet', 'MUNICIPALITY', '14'),
    ('1463', 'Mark', 'MUNICIPALITY', '14'),
    ('1465', 'Svenljunga', 'MUNICIPALITY', '14'),
    ('1466', 'Herrljunga', 'MUNICIPALITY', '14'),
    ('1470', 'Vara', 'MUNICIPALITY', '14'),
    ('1471', 'Götene', 'MUNICIPALITY', '14'),
    ('1472', 'Tibro', 'MUNICIPALITY', '14'),
    ('1473', 'Töreboda', 'MUNICIPALITY', '14'),
    ('1480', 'Göteborg', 'MUNICIPALITY', '14'),
    ('1481', 'Mölndal', 'MUNICIPALITY', '14'),
    ('1482', 'Kungälv', 'MUNICIPALITY', '14'),
    ('1484', 'Lysekil', 'MUNICIPALITY', '14'),
    ('1485', 'Uddevalla', 'MUNICIPALITY', '14'),
    ('1486', 'Strömstad', 'MUNICIPALITY', '14'),
    ('1487', 'Vänersborg', 'MUNICIPALITY', '14'),
    ('1488', 'Trollhättan', 'MUNICIPALITY', '14'),
    ('1489', 'Alingsås', 'MUNICIPALITY', '14'),
    ('1490', 'Borås', 'MUNICIPALITY', '14'),
    ('1491', 'Ulricehamn', 'MUNICIPALITY', '14'),
    ('1492', 'Åmål', 'MUNICIPALITY', '14'),
    ('1493', 'Mariestad', 'MUNICIPALITY', '14'),
    ('1494', 'Lidköping', 'MUNICIPALITY', '14'),
    ('1495', 'Skara', 'MUNICIPALITY', '14'),
    ('1496', 'Skövde', 'MUNICIPALITY', '14'),
    ('1497', 'Hjo', 'MUNICIPALITY', '14'),
    ('1498', 'Tidaholm', 'MUNICIPALITY', '14'),
    ('1499', 'Falköping', 'MUNICIPALITY', '14'),
    ('1715', 'Kil', 'MUNICIPALITY', '17'),
    ('1730', 'Eda', 'MUNICIPALITY', '17'),
    ('1737', 'Torsby', 'MUNICIPALITY', '17'),
    ('1760', 'Storfors', 'MUNICIPALITY', '17'),
    ('1761', 'Hammarö', 'MUNICIPALITY', '17'),
    ('1762', 'Munkfors', 'MUNICIPALITY', '17'),
    ('1763', 'Forshaga', 'MUNICIPALITY', '17'),
    ('1764', 'Grums', 'MUNICIPALITY', '17'),
    ('1765', 'Årjäng', 'MUNICIPALITY', '17'),
    ('1766', 'Sunne', 'MUNICIPALITY', '17'),
    ('1780', 'Karlstad', 'MUNICIPALITY', '17'),
    ('1781', 'Kristinehamn', 'MUNICIPALITY', '17'),
    ('1782', 'Filipstad', 'MUNICIPALITY', '17'),
    ('1783', 'Hagfors', 'MUNICIPALITY', '17'),
    ('1784', 'Arvika', 'MUNICIPALITY', '17'),
    ('1785', 'Säffle', 'MUNICIPALITY', '17'),
    ('1814', 'Lekeberg', 'MUNICIPALITY', '18'),
    ('1860', 'Laxå', 'MUNICIPALITY', '18'),
    ('1861', 'Hallsberg', 'MUNICIPALITY', '18'),
    ('1862', 'Degerfors', 'MUNICIPALITY', '18'),
    ('1863', 'Hällefors', 'MUNICIPALITY', '18'),
    ('1864', 'Ljusnarsberg', 'MUNICIPALITY', '18'),
    ('1880', 'Örebro', 'MUNICIPALITY', '18'),
    ('1881', 'Kumla', 'MUNICIPALITY', '18'),
    ('1882', 'Askersund', 'MUNICIPALITY', '18'),
    ('1883', 'Karlskoga', 'MUNICIPALITY', '18'),
    ('1884', 'Nora', 'MUNICIPALITY', '18'),
    ('1885', 'Lindesberg', 'MUNICIPALITY', '18'),
    ('1904', 'Skinnskatteberg', 'MUNICIPALITY', '19'),
    ('1907', 'Surahammar', 'MUNICIPALITY', '19'),
    ('1960', 'Kungsör', 'MUNICIPALITY', '19'),
    ('1961', 'Hallstahammar', 'MUNICIPALITY', '19'),
    ('1962', 'Norberg', 'MUNICIPALITY', '19'),
    ('1980', 'Västerås', 'MUNICIPALITY', '19'),
    ('1981', 'Sala', 'MUNICIPALITY', '19'),
    ('1982', 'Fagersta', 'MUNICIPALITY', '19'),
    ('1983', 'Köping', 'MUNICIPALITY', '19'),
    ('1984', 'Arboga', 'MUNICIPALITY', '19'),
    ('2021', 'Vansbro', 'MUNICIPALITY', '20'),
    ('2023', 'Malung-Sälen', 'MUNICIPALITY', '20'),
    ('2026', 'Gagnef', 'MUNICIPALITY', '20'),
    ('2029', 'Leksand', 'MUNICIPALITY', '20'),
    ('2031', 'Rättvik', 'MUNICIPALITY', '20'),
    ('2034', 'Orsa', 'MUNICIPALITY', '20'),
    ('2039', 'Älvdalen', 'MUNICIPALITY', '20'),
    ('2061', 'Smedjebacken', 'MUNICIPALITY', '20'),
    ('2062', 'Mora', 'MUNICIPALITY', '20'),
    ('2080', 'Falun', 'MUNICIPALITY', '20'),
    ('2081', 'Borlänge', 'MUNICIPALITY', '20'),
    ('2082', 'Säter', 'MUNICIPALITY', '20'),
    ('2083', 'Hedemora', 'MUNICIPALITY', '20'),
    ('2084', 'Avesta', 'MUNICIPALITY', '20'),
    ('2085', 'Ludvika', 'MUNICIPALITY', '20'),
    ('2101', 'Ockelbo', 'MUNICIPALITY', '21'),
    ('2104', 'Hofors', 'MUNICIPALITY', '21'),
    ('2121', 'Ovanåker', 'MUNICIPALITY', '21'),
    ('2132', 'Nordanstig', 'MUNICIPALITY', '21'),
    ('2161', 'Ljusdal', 'MUNICIPALITY', '21'),
    ('2180', 'Gävle', 'MUNICIPALITY', '21'),
    ('2181', 'Sandviken', 'MUNICIPALITY', '21'),
    ('2182', 'Söderhamn', 'MUNICIPALITY', '21'),
    ('2183', 'Bollnäs', 'MUNICIPALITY', '21'),
    ('2184', 'Hudiksvall', 'MUNICIPALITY', '21'),
    ('2260', 'Ånge', 'MUNICIPALITY', '22'),
    ('2262', 'Timrå', 'MUNICIPALITY', '22'),
    ('2280', 'Härnösand', 'MUNICIPALITY', '22'),
    ('2281', 'Sundsvall', 'MUNICIPALITY', '22'),
    ('2282', 'Kramfors', 'MUNICIPALITY', '22'),
    ('2283', 'Sollefteå', 'MUNICIPALITY', '22'),
    ('2284', 'Örnsköldsvik', 'MUNICIPALITY', '22'),
    ('2303', 'Ragunda', 'MUNICIPALITY', '23'),
    ('2305', 'Bräcke', 'MUNICIPALITY', '23'),
    ('2309', 'Krokom', 'MUNICIPALITY', '23'),
    ('2313', 'Strömsund', 'MUNICIPALITY', '23'),
    ('2321', 'Åre', 'MUNICIPALITY', '23'),
    ('2326', 'Berg', 'MUNICIPALITY', '23'),
    ('2361', 'Härjedalen', 'MUNICIPALITY', '23'),
    ('2380', 'Östersund', 'MUNICIPALITY', '23'),
    ('2401', 'Nordmaling', 'MUNICIPALITY', '24'),
    ('2403', 'Bjurholm', 'MUNICIPALITY', '24'),
    ('2404', 'Vindeln', 'MUNICIPALITY', '24'),
    ('2409', 'Robertsfors', 'MUNICIPALITY', '24'),
    ('2417', 'Norsjö', 'MUNICIPALITY', '24'),
    ('2418', 'Malå', 'MUNICIPALITY', '24'),
    ('2421', 'Storuman', 'MUNICIPALITY', '24'),
    ('2422', 'Sorsele', 'MUNICIPALITY', '24'),
    ('2425', 'Dorotea', 'MUNICIPALITY', '24'),
    ('2460', 'Vännäs', 'MUNICIPALITY', '24'),
    ('2462', 'Vilhelmina', 'MUNICIPALITY', '24'),
    ('2463', 'Åsele', 'MUNICIPALITY', '24'),
    ('2480', 'Umeå', 'MUNICIPALITY', '24'),
    ('2481', 'Lycksele', 'MUNICIPALITY', '24'),
    ('2482', 'Skellefteå', 'MUNICIPALITY', '24'),
    ('2505', 'Arvidsjaur', 'MUNICIPALITY', '25'),
    ('2506', 'Arjeplog', 'MUNICIPALITY', '25'),
    ('2510', 'Jokkmokk', 'MUNICIPALITY', '25'),
    ('2513', 'Överkalix', 'MUNICIPALITY', '25'),
    ('2514', 'Kalix', 'MUNICIPALITY', '25'),
    ('2518', 'Övertorneå', 'MUNICIPALITY', '25'),
    ('2521', 'Pajala', 'MUNICIPALITY', '25'),
    ('2523', 'Gällivare', 'MUNICIPALITY', '25'),
    ('2560', 'Älvsbyn', 'MUNICIPALITY', '25'),
    ('2580', 'Luleå', 'MUNICIPALITY', '25'),
    ('2581', 'Piteå', 'MUNICIPALITY', '25'),
    ('2582', 'Boden', 'MUNICIPALITY', '25'),
    ('2583', 'Haparanda', 'MUNICIPALITY', '25'),
    ('2584', 'Kiruna', 'MUNICIPALITY', '25');

ALTER TABLE `Roadmaps` ADD COLUMN `geo_area_code` VARCHAR(191) NULL;
ALTER TABLE `Orgs` ADD COLUMN `geo_area_code` VARCHAR(191) NULL;

-- Backfill roadmaps from the free-text actor. Sequential passes, most exact first;
-- whatever stays unmatched (e.g. organizational actors) simply has no geo marker.
-- Exact geo name match ("Piteå kommun" does NOT hit this; "Norrbottens län" and "Riket" do)
UPDATE `Roadmaps` r
JOIN `GeoAreas` g ON BINARY g.`name` = r.`actor`
SET r.`geo_area_code` = g.`code`;
-- Alternative spelling of the nation
UPDATE `Roadmaps` SET `geo_area_code` = '00'
WHERE `geo_area_code` IS NULL AND `actor` = 'Sverige';
-- "<Municipality> kommun" and "<Municipality> kommunkoncern"
UPDATE `Roadmaps` r
JOIN `GeoAreas` g ON g.`type` = 'MUNICIPALITY'
    AND (r.`actor` = BINARY CONCAT(g.`name`, ' kommun') OR r.`actor` = BINARY CONCAT(g.`name`, ' kommunkoncern'))
SET r.`geo_area_code` = g.`code`
WHERE r.`geo_area_code` IS NULL;

-- Orgs: exact name match only (municipality-named orgs get their municipality;
-- STUNS/SAF/LLT and friends stay geo-less)
UPDATE `Orgs` o
JOIN `GeoAreas` g ON BINARY g.`name` = o.`name`
SET o.`geo_area_code` = g.`code`;

ALTER TABLE `GeoAreas` ADD CONSTRAINT `GeoAreas_parent_code_fkey`
    FOREIGN KEY (`parent_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_geo_area_code_fkey`
    FOREIGN KEY (`geo_area_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Orgs` ADD CONSTRAINT `Orgs_geo_area_code_fkey`
    FOREIGN KEY (`geo_area_code`) REFERENCES `GeoAreas`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Informational: actors that did not map to a geo area (expected for
-- organizational/free-text actors; review, don't panic)
SELECT 'unmatched_actor' AS report, `actor`, COUNT(*) AS n
FROM `Roadmaps` WHERE `geo_area_code` IS NULL GROUP BY `actor`;

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
ALTER TABLE `GuestInvites` ADD CONSTRAINT `GuestInvites_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GuestInvites` ADD CONSTRAINT `GuestInvites_invited_by_id_fkey`
    FOREIGN KEY (`invited_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_org_id_fkey`
    FOREIGN KEY (`org_id`) REFERENCES `Orgs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `OrgMemberships` ADD CONSTRAINT `OrgMemberships_role_changed_by_id_fkey`
    FOREIGN KEY (`role_changed_by_id`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
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
-- 12b. LEVEL CONSTRAINT NAMES: rename leftovers to the canonical Prisma names
-- ============================================================================
-- The renamed tables keep their pre-rework FK/index names; recreate them with the
-- names 0_init uses so the final state matches the leveled migration exactly
-- (afterwards `migrate diff --from-config-datasource --to-schema` must be EMPTY).
-- Purely renames: FKs dropped and re-added with identical definitions.
-- (The `_goal_tags` old B index/FK cover column `A` after the A/B column swap.)

-- DropForeignKey
ALTER TABLE `ActionFields` DROP FOREIGN KEY `action_field_action_id_fkey`;

-- DropForeignKey
ALTER TABLE `Actions` DROP FOREIGN KEY `action_parent_action_id_fkey`;

-- DropForeignKey
ALTER TABLE `Actions` DROP FOREIGN KEY `action_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `Comments` DROP FOREIGN KEY `comment_action_id_fkey`;

-- DropForeignKey
ALTER TABLE `Comments` DROP FOREIGN KEY `comment_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `Comments` DROP FOREIGN KEY `comment_meta_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `Comments` DROP FOREIGN KEY `comment_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `Effects` DROP FOREIGN KEY `effect_action_id_fkey`;

-- DropForeignKey
ALTER TABLE `Effects` DROP FOREIGN KEY `effect_data_series_id_fkey`;

-- DropForeignKey
ALTER TABLE `Effects` DROP FOREIGN KEY `effect_goal_id_fkey`;

-- DropForeignKey
ALTER TABLE `Goals` DROP FOREIGN KEY `goal_baseline_id_fkey`;

-- DropForeignKey
ALTER TABLE `Goals` DROP FOREIGN KEY `goal_data_series_id_fkey`;

-- DropForeignKey
ALTER TABLE `Goals` DROP FOREIGN KEY `goal_historical_id_fkey`;

-- DropForeignKey
ALTER TABLE `Goals` DROP FOREIGN KEY `goal_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `RoadmapIterations` DROP FOREIGN KEY `roadmap_meta_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `Roadmaps` DROP FOREIGN KEY `meta_roadmap_parent_roadmap_id_fkey`;

-- DropForeignKey
ALTER TABLE `_goal_tags` DROP FOREIGN KEY `_goal_tag_A_fkey`;

-- DropForeignKey
ALTER TABLE `_goal_tags` DROP FOREIGN KEY `_goal_tag_B_fkey`;

-- DropIndex
DROP INDEX `_goal_tag_AB_unique` ON `_goal_tags`;

-- DropIndex (after the A/B column swap this old index covers column `A`)
DROP INDEX `_goal_tag_B_index` ON `_goal_tags`;

-- CreateIndex
CREATE UNIQUE INDEX `_goal_tags_AB_unique` ON `_goal_tags`(`A`, `B`);

-- CreateIndex
CREATE INDEX `_goal_tags_B_index` ON `_goal_tags`(`B`);

-- AddForeignKey
ALTER TABLE `Roadmaps` ADD CONSTRAINT `Roadmaps_parent_roadmap_id_fkey` FOREIGN KEY (`parent_roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoadmapIterations` ADD CONSTRAINT `RoadmapIterations_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_baseline_id_fkey` FOREIGN KEY (`baseline_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_historical_id_fkey` FOREIGN KEY (`historical_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_parent_action_id_fkey` FOREIGN KEY (`parent_action_id`) REFERENCES `Actions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionFields` ADD CONSTRAINT `ActionFields_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_data_series_id_fkey` FOREIGN KEY (`data_series_id`) REFERENCES `DataSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Effects` ADD CONSTRAINT `Effects_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_action_id_fkey` FOREIGN KEY (`action_id`) REFERENCES `Actions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_goal_id_fkey` FOREIGN KEY (`goal_id`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_roadmap_iteration_id_fkey` FOREIGN KEY (`roadmap_iteration_id`) REFERENCES `RoadmapIterations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comments` ADD CONSTRAINT `Comments_roadmap_id_fkey` FOREIGN KEY (`roadmap_id`) REFERENCES `Roadmaps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_tags` ADD CONSTRAINT `_goal_tags_A_fkey` FOREIGN KEY (`A`) REFERENCES `GoalTags`(`name`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_goal_tags` ADD CONSTRAINT `_goal_tags_B_fkey` FOREIGN KEY (`B`) REFERENCES `Goals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- 13. CLEANUP + RESET MIGRATION HISTORY
-- ============================================================================
DROP TABLE `_migration_user_org`, `_migration_meta_org`, `_migration_group_org`,
           `_migration_rw_users`, `_migration_ro_users`,
           `_migration_rw_groups`, `_migration_ro_groups`;

TRUNCATE `_prisma_migrations`;

-- ============================================================================
-- LEVELING (after this script succeeds):
--   The repo's prisma/migrations contains only 0_init, generated from the final
--   schema. Section 12b above already leveled the constraint names, so:
--     yarn prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
--   must print an EMPTY migration. Then baseline the database ("the lie"):
--     yarn prisma migrate resolve --applied 0_init
--   and verify with `yarn prisma migrate status` (should be up to date).
-- ============================================================================
