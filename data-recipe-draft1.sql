-- Data series migration

CREATE TABLE `date_record` (
    `timestamp` DATE NOT NULL,
    `value` DOUBLE NOT NULL,
    `data_series_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`data_series_id`, `timestamp`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- A fuckton (31) of instances of copying data from data_series fields into date_record rows
-- 2020 - 2029
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2020-01-01' AS `timestamp`,
    `val_2020` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2021-01-01' AS `timestamp`,
    `val_2021` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2022-01-01' AS `timestamp`,
    `val_2022` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2023-01-01' AS `timestamp`,
    `val_2023` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2024-01-01' AS `timestamp`,
    `val_2024` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2025-01-01' AS `timestamp`,
    `val_2025` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2026-01-01' AS `timestamp`,
    `val_2026` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2027-01-01' AS `timestamp`,
    `val_2027` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2028-01-01' AS `timestamp`,
    `val_2028` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2029-01-01' AS `timestamp`,
    `val_2029` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

-- 2030 - 2039
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2030-01-01' AS `timestamp`,
    `val_2030` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2031-01-01' AS `timestamp`,
    `val_2031` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2032-01-01' AS `timestamp`,
    `val_2032` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2033-01-01' AS `timestamp`,
    `val_2033` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2034-01-01' AS `timestamp`,
    `val_2034` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2035-01-01' AS `timestamp`,
    `val_2035` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2036-01-01' AS `timestamp`,
    `val_2036` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2037-01-01' AS `timestamp`,
    `val_2037` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2038-01-01' AS `timestamp`,
    `val_2038` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2039-01-01' AS `timestamp`,
    `val_2039` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

-- 2040 - 2050
INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2040-01-01' AS `timestamp`,
    `val_2040` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2041-01-01' AS `timestamp`,
    `val_2041` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2042-01-01' AS `timestamp`,
    `val_2042` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2043-01-01' AS `timestamp`,
    `val_2043` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2044-01-01' AS `timestamp`,
    `val_2044` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2045-01-01' AS `timestamp`,
    `val_2045` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2046-01-01' AS `timestamp`,
    `val_2046` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2047-01-01' AS `timestamp`,
    `val_2047` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2048-01-01' AS `timestamp`,
    `val_2048` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2049-01-01' AS `timestamp`,
    `val_2049` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`

INSERT INTO `date_record` (`timestamp`, `value`, `data_series_id`)
SELECT
    DATE'2050-01-01' AS `timestamp`,
    `val_2050` AS `value`,
    `data_series_id` AS `data_series_id`
FROM `data_series`
-- End of data series copying

