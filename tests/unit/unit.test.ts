import { expect, test } from "playwright/test";

import { isUnitFlag, parseUnit, serializeUnit } from "../../src/functions/unit";
import type { Unit } from "../../src/types";
import { UnitFlags } from "../../src/types/enums";

/*
 * The db-boundary convention for units: the database stores `string | null`
 * (blank = missing, null = unitless); typed code sees a branded `Unit` where
 * the two edge cases are explicit flags. parse/serialize are the only way across.
 */

test.describe("parseUnit", () => {
  test("blank and whitespace-only strings are a missing unit", () => {
    expect(parseUnit("")).toBe(UnitFlags.Missing);
    expect(parseUnit("   ")).toBe(UnitFlags.Missing);
    expect(parseUnit("\t\n")).toBe(UnitFlags.Missing);
  });

  test("null and undefined are unitless", () => {
    expect(parseUnit(null)).toBe(UnitFlags.Unitless);
    expect(parseUnit(undefined)).toBe(UnitFlags.Unitless);
  });

  test("plain ASCII units pass through untouched", () => {
    expect(parseUnit("kg")).toBe("kg");
    expect(parseUnit("kWh")).toBe("kWh");
    expect(parseUnit("ton CO2e")).toBe("ton CO2e");
  });

  test("Swedish diacritics are stripped so mathjs can tokenize the unit", () => {
    expect(parseUnit("invånare")).toBe("invanare");
    expect(parseUnit("invånare")).not.toBe("invånare");
    expect(parseUnit("ängar")).toBe("angar");
    expect(parseUnit("öre")).toBe("ore");
    expect(parseUnit("Ångström")).toBe("Angstrom");
    expect(parseUnit("é")).toBe("e");
  });

  test("the micro sign and Greek mu both become the mathjs 'u' prefix", () => {
    expect(parseUnit("µg")).toBe("ug"); // U+00B5 MICRO SIGN
    expect(parseUnit("μg")).toBe("ug"); // U+03BC GREEK SMALL LETTER MU
    expect(parseUnit("µg/m³")).toBe("ug/m³");
  });

  test("the stored flag strings are read back as the flags themselves", () => {
    expect(parseUnit("UNITLESS")).toBe(UnitFlags.Unitless);
    expect(parseUnit("MISSING_UNIT")).toBe(UnitFlags.Missing);
    expect(isUnitFlag(parseUnit("UNITLESS"))).toBe(true);
    expect(isUnitFlag(parseUnit("MISSING_UNIT"))).toBe(true);
  });
});

test.describe("serializeUnit", () => {
  test("flags map back to the database convention", () => {
    expect(serializeUnit(UnitFlags.Unitless)).toBeNull();
    expect(serializeUnit(UnitFlags.Missing)).toBe("");
  });

  test("real units are stored verbatim", () => {
    expect(serializeUnit("kg" as Unit)).toBe("kg");
    expect(serializeUnit("ug" as Unit)).toBe("ug");
  });

  test("round trip through serialize and parse is the identity", () => {
    for (const raw of [null, "", "   ", "kg", "kWh", "ton CO2e", "ug"]) {
      const unit = parseUnit(raw);
      expect(parseUnit(serializeUnit(unit)), `round trip of ${JSON.stringify(raw)}`).toBe(unit);
    }
  });

  test("round trip of a diacritic unit stores the normalized spelling", () => {
    // Not an identity on the raw string: the db ends up with the ASCII form
    expect(serializeUnit(parseUnit("invånare"))).toBe("invanare");
    expect(serializeUnit(parseUnit("µg"))).toBe("ug");
    // ... which is stable from then on
    expect(parseUnit(serializeUnit(parseUnit("invånare")))).toBe("invanare");
  });

  test("flags survive a round trip as flags", () => {
    for (const flag of Object.values(UnitFlags)) {
      const stored = serializeUnit(flag);
      expect(parseUnit(stored), `flag ${flag}`).toBe(flag);
      expect(isUnitFlag(parseUnit(stored))).toBe(true);
    }
  });
});

test.describe("isUnitFlag", () => {
  test("true for the sentinels only", () => {
    expect(isUnitFlag(UnitFlags.Unitless)).toBe(true);
    expect(isUnitFlag(UnitFlags.Missing)).toBe(true);
    expect(isUnitFlag("kg" as Unit)).toBe(false);
    expect(isUnitFlag("" as Unit)).toBe(false);
    expect(isUnitFlag("unitless" as Unit)).toBe(false); // case matters
  });
});
