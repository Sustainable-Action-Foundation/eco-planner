import { uniqueLocales } from "i18n.config";
import fs from "node:fs";

uniqueLocales.forEach((locale) => {
  const comp = JSON.parse(fs.readFileSync(`public/locales/${locale}/components.json`, "utf-8"))

  const graphKeys = Object.keys(comp).filter(key => key.includes("graph"));

  const graphs: Record<string, object> = {}

  graphKeys.forEach(key => {
    const graph = comp[key];
    if (graph) {
      graphs[key] = graph;
    }
  });

  const newComp: Record<string, object> = {}
  const newKeys = Object.keys(comp).filter(key => !key.includes("graph"));
  newKeys.forEach(key => {
    const graph = comp[key];
    if (graph) {
      newComp[key] = graph;
    }
  });

  fs.writeFileSync(`public/locales/${locale}/components.json`, JSON.stringify(newComp, null, 2), "utf-8")
  // fs.writeFileSync(`public/locales/${locale}/graphs.json`, JSON.stringify(graphs, null, 2), "utf-8")
});