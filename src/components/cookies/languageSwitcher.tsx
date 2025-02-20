"use client";

import { setCookie } from "cookies-next";
import type { Locale } from "@/types";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

const languageOptions: { label: string, value: Locale }[] = [
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
  const [_isPending, startTransition] = useTransition();
  const router = useRouter();
  
  async function setLanguage(lang: Locale) {
    await setCookie("language", lang);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <select
      className="font-weight-500 block padding-left-100"
      style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
      onChange={(e) => { setLanguage(e.target.value as Locale) }}
      autoComplete="off"
    >
      {/* Make sure the selected language is displayed on top */}
      <option key={languageOptions.filter((item) => item.label === languageOptions.filter((item) => item.value === locale)[0].label)[0].value} value={locale}>
        {languageOptions.filter((item) => item.value === locale)[0].label}
      </option>
      {/* Create options for the rest of the languages */}
      {languageOptions.filter((item) => item.value !== locale).map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}