import { uniqueLocales } from "i18n.config";

export function LanguageSwitcher() {

  return (
    <select className={`height-100 width-100`}>
      {uniqueLocales.map((locale) => (
        <option key={locale} value={locale}>
          {locale}
        </option>
      ))}
    </select>
  );
}