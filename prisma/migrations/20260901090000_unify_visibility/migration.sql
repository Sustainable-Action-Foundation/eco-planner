-- One single-valued visibility setting per level, replacing the booleans.
-- Each block adds the enum column, converts the existing rows, then drops the old columns.

-- Roadmap sharing: who may read (was is_public / org_readable)
ALTER TABLE `AccessControls` ADD COLUMN `sharing` ENUM('GROUPS', 'ORG', 'PUBLIC') NOT NULL DEFAULT 'ORG';
UPDATE `AccessControls` SET `sharing` = CASE
    WHEN `is_public` THEN 'PUBLIC'
    WHEN `org_readable` THEN 'ORG'
    ELSE 'GROUPS'
END;
ALTER TABLE `AccessControls` DROP COLUMN `is_public`,
    DROP COLUMN `org_readable`;

-- Goal listing (was is_featured / is_unlisted; unlisted wins, as the UI always treated it)
ALTER TABLE `Goals` ADD COLUMN `listing` ENUM('LISTED', 'UNLISTED', 'FEATURED') NOT NULL DEFAULT 'LISTED';
UPDATE `Goals` SET `listing` = CASE
    WHEN `is_unlisted` THEN 'UNLISTED'
    WHEN `is_featured` THEN 'FEATURED'
    ELSE 'LISTED'
END;
ALTER TABLE `Goals` DROP COLUMN `is_featured`,
    DROP COLUMN `is_unlisted`;

-- Version status (was published_at IS NULL = draft, plus is_unlisted); published_at stays as an informational timestamp
ALTER TABLE `RoadmapIterations` ADD COLUMN `status` ENUM('DRAFT', 'UNLISTED', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';
UPDATE `RoadmapIterations` SET `status` = CASE
    WHEN `published_at` IS NULL THEN 'DRAFT'
    WHEN `is_unlisted` THEN 'UNLISTED'
    ELSE 'PUBLISHED'
END;
ALTER TABLE `RoadmapIterations` DROP COLUMN `is_unlisted`;
