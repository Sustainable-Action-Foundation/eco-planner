"use client";

import { setCookie } from "cookies-next";
import type { Locale } from "@/types";

interface LanguageSwitcherI {
  locale: Locale;
}

const languages: { label: string, value: Locale }[] = [
  {
    label: "English",
    value: "en",
  },
  {
    label: "Svenska",
    value: "sv",
  },
];

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  setCookie("language", locale);

  async function setLanguage(lang: Locale) {
    await setCookie("language", lang);
    window?.location.reload();
  }

  return (
    <select
      className="font-weight-500 margin-top-25 block"
      style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
      onChange={(e) => { setLanguage(e.target.value as Locale) }}
      autoComplete="off"
    >
      {/* Make sure the selected language is displayed on top */}
      <option key={languages.filter((item) => item.label === languages.filter((item) => item.value === locale)[0].label)[0].value} value={locale}>
        {languages.filter((item) => item.value === locale)[0].label}
      </option>
      {/* Create options for the rest of the languages */}
      {languages.filter((item) => item.value !== locale).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}

    </select>
  );
}