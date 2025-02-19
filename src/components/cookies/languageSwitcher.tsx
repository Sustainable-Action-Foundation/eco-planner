"use client";

import { setCookie } from "cookies-next";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export default function LanguageSwitcher({ locale }: LanguageSwitcherI) {
  const [language, setLanguage] = useState<Locale>(locale as Locale);
  const router = useRouter();

  setCookie("language", language, { expires: new Date(Date.now() + 31536000000) }); // 1 year expiry

  const changeLanguage = async (lang: Locale) => {
    setLanguage(lang);
    await setCookie("language", lang);
    router.refresh();
  };

  return (
    <select
      className="font-weight-500 margin-top-25 block"
      style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
      onChange={(e) => { changeLanguage(e.target.value as Locale) }}>
      {/* Make sure the selected language is displayed on top */}
      <option key={languages.filter((item) => item.label === languages.filter((item) => item.value === language)[0].label)[0].value} value={language}>
        {languages.filter((item) => item.value === language)[0].label}
      </option>
      {/* Create options for the rest of the languages */}
      {languages.filter((item) => item.value !== language).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}

    </select>
  );
}