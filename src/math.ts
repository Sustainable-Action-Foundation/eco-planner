import { create, all } from 'mathjs';

const mathjs = create(all);

mathjs.createUnit({
  Atemp: {
    prefixes: 'none',
    baseName: 'area',
  },
  capita: {
    prefixes: 'none',
  },
  CO2e: {
    prefixes: 'none',
    aliases: ['co2e', 'Co2e', 'CO2', 'co2', 'Co2'],
  },
});

export default mathjs;