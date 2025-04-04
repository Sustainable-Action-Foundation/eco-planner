import "./lib/console";
import { Locales, ns, uniqueLocales } from "i18n.config";
import fs from "node:fs";


/** 
 * Adds a common object to all namespaces with all duplicate values in that namespace.
 */
function ExtractLocalCommon() {
  uniqueLocales.forEach((locale) => {
    const allValues: string[] = [];

    ns.forEach((namespace) => {
      const flattened = getFlattenedLocaleFile(locale, namespace);
      const values = Object.values(flattened);
      allValues.push(...values);
    });

    const perNSDupes = Object.fromEntries(ns.map(namespace => {
      const flattened = getFlattenedLocaleFile(locale, namespace);
      const values = Object.values(flattened);
      const dupes = values.filter(item => values.filter(i => i === item).length > 1).sort();
      return [namespace, dupes];
    }));

    ns.forEach(namespace => {
      if (namespace === "common") return; // Skip common namespace

      const dupes = perNSDupes[namespace];
      if (!dupes.length) return;

      const keysUsedForDupes = dupes.map(dupe => {
        const flattened = getFlattenedLocaleFile(locale, namespace);
        const keys = Object.keys(flattened).filter(key => flattened[key] === dupe);
        return [dupe, keys];
      });

      const localCommon: Record<string, string> = {};

      // If a dupe is only known by one name (ns:base.keyN.name) use that name, else concat all alternatives for manual review
      keysUsedForDupes.forEach(([dupe, keys]) => {
        dupe = dupe as string;

        const names = [... new Set((keys as string[]).map(key => key.split(".").at(-1) as string))];

        if (names.length === 1) {
          localCommon[names[0]] = dupe;
        } else {
          localCommon[`{{${names.join(",")}}}`] = dupe;
        }
      });

      const file = fs.readFileSync(`public/locales/${locale}/${namespace}.json`, "utf-8");
      const parsed = JSON.parse(file);
      const newParsed = { common: { ...localCommon }, ...parsed };
      fs.writeFileSync(`public/locales/${locale}/${namespace}.json`, JSON.stringify(newParsed, null, 2), "utf-8");
    });
  });
}


/** 
 * Finds a group of values via their keys and parents and moves them to a new namespace file.
 */
function MigrateNamespaceValues(originNS: string, destNS: string, valueMatcher: string | RegExp) {
  uniqueLocales.forEach((locale) => {
    const old = JSON.parse(fs.readFileSync(`public/locales/${locale}/${originNS}.json`, "utf-8"))

    const migrationKeys = Object.keys(old)
      .filter(key => {
        if (typeof valueMatcher === "string") {
          return key.includes(valueMatcher);
        }
        if (valueMatcher instanceof RegExp) {
          return valueMatcher.test(key);
        }
        return false;
      });

    const newDest: Record<string, object> = {}

    migrationKeys.forEach(key => {
      const graph = old[key];
      if (graph) {
        newDest[key] = graph;
      }
    });

    const newOrigin: Record<string, object> = {}
    const newKeys = Object.keys(old).filter(key => !key.includes("graph"));
    newKeys.forEach(key => {
      const graph = old[key];
      if (graph) {
        newOrigin[key] = graph;
      }
    });

    fs.writeFileSync(`public/locales/${locale}/${originNS}.json`, JSON.stringify(newOrigin, null, 2), "utf-8")
    fs.writeFileSync(`public/locales/${locale}/${destNS}.json`, JSON.stringify(newDest, null, 2), "utf-8")
  });
}

/*
 * Helpers
 */
function getFlattenedLocaleFile(locale: Locales, namespace: string) {
  const file = `public/locales/${locale}/${namespace}.json`;
  try { JSON.parse(fs.readFileSync(file, "utf-8")); }
  catch (e) {
    console.error("Error parsing JSON file:", file, e);
    throw e;
  }

  const flattened = getFlattenedObject(JSON.parse(fs.readFileSync(file, "utf-8")));

  const keys = Object.keys(flattened)
    .map(key => `${namespace}:${key}`); // Add namespace to keys

  const values = Object.values(flattened);

  const flattenedKeysAndValues = Object.fromEntries(keys.map((key, i) => [key, values[i]]));

  return flattenedKeysAndValues;
}
function getFlattenedObject(obj: object) {
  const result: Record<string, string> = {};

  const recurse = (obj: object, prefix = "") => {
    for (const [key, value] of Object.entries(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object") {
        recurse(value, newPrefix);
      }
      else {
        result[newPrefix] = value;
      }
    }
  };

  recurse(obj);

  return result;
}