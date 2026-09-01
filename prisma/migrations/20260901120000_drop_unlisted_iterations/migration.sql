-- Versions are either drafts (editors only) or published; the unlisted tier goes.
-- Unlisted versions were readable, so they become published rather than hidden.
UPDATE `RoadmapIterations` SET `status` = 'PUBLISHED' WHERE `status` = 'UNLISTED';
ALTER TABLE `RoadmapIterations` MODIFY `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT';
