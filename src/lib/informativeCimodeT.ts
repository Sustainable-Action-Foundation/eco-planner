import { Locales } from "@/../i18n.config";
import type { TOptions } from "@/../i18n.config";
import type { TFunction, i18n } from "i18next";

/**
 * Whether the extra information should be shown, or just the translation result.
 */
function shouldExpand(instance: i18n, options?: TOptions): boolean {
  return (
    instance.language === Locales.test ||
    instance.resolvedLanguage === Locales.test ||
    options?.lng === Locales.test
  );
}

/**
 * A wrapper around the i18n `t` function that provides extra information about the translation parameters used when in cimode.
 */
export function informativeCimodeT(instance: i18n): TFunction {
  const baseT = instance.t.bind(instance) as TFunction;

  return ((key: string | string[], options?: TOptions): string => {
    // Default case, just return the translation result
    if (!shouldExpand(instance, options)) {
      return baseT(key, options);
    }

    const details = baseT(key, {
      ...(options ?? {}),
      returnDetails: true,
    });

    // If there are used parameters, return them appended after the result, otherwise just return the result
    if (details.usedParams && Object.values(details.usedParams).filter(val => val !== undefined).length > 0) {
      return `${details.res} :: ${JSON.stringify(details.usedParams)}`;
    } else {
      return details.res;
    }

  }) as TFunction;
}

/**
 * Replaces the `t` function of the given i18n instance with the informativeCimodeT wrapper
 */
export function patchI18nT(instance: i18n): void {
  instance.t = informativeCimodeT(instance) as typeof instance.t;
}