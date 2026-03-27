import type { UnitDefinition } from 'mathjs';
import { create, all, Unit } from 'mathjs';

const mathjs = create(all);

const customUnits: Record<string, UnitDefinition> = {
  "Atemp": {
    prefixes: 'none',
    baseName: 'area',
  },
  "capita": {
    prefixes: 'none',
  },
  "CO2e": {
    prefixes: 'none',
    aliases: ['co2e', 'Co2e', 'CO2', 'co2', 'Co2'],
  },
};

mathjs.createUnit(customUnits);

export default mathjs;

export const allOurUnits: string[] = [
  ...Object.keys(Unit.UNITS),
  ...Object.keys(customUnits), // This adds the custom units to the list without adding all the aliases
];