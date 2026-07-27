import { UnitFlags } from "@/types/enums";
import type { Unit } from "@/types";

/**
 * Parses a unit from the database/legacy convention (`string | null`, where
 * blank means "missing" and `null` means "unitless") into the {@link Unit} type:
 *
 * - `null` / `undefined` → {@link UnitFlags.Unitless}
 * - blank / whitespace-only → {@link UnitFlags.Missing}
 * - anything else → the unit string itself
 *
 * The flags exist so unit handling is explicit instead of broad falsy checks
 * (which collapse `""`, `null` and `undefined` into one case). Use this at the
 * boundary between the database (or legacy-serialized data) and typed code; the
 * database itself keeps the old convention (see {@link serializeUnit}).
 */
export function parseUnit(raw: string | null | undefined): Unit {
  if (raw === null || raw === undefined) return UnitFlags.Unitless;
  if (raw.trim() === "") return UnitFlags.Missing;
  return raw as Unit;
}

/**
 * Serializes a {@link Unit} back into the database convention:
 * {@link UnitFlags.Unitless} → `null`, {@link UnitFlags.Missing} → `""`,
 * anything else is stored verbatim.
 */
export function serializeUnit(unit: Unit): string | null {
  if (unit === UnitFlags.Unitless) return null;
  if (unit === UnitFlags.Missing) return "";
  return unit;
}

/** True when the unit is one of the sentinel flags rather than an actual unit string. */
export function isUnitFlag(unit: Unit): unit is (typeof UnitFlags)[keyof typeof UnitFlags] {
  return unit === UnitFlags.Unitless || unit === UnitFlags.Missing;
}
