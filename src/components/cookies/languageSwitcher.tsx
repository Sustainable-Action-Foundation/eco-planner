"use client";
import { setCookie } from "cookies-next";
import { useState } from "react";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
import { useRouter } from "next/navigation";

interface LanguageSwitcherI {
  locale: string;
}

const languages = [
  {
    label: "English",
    value: "en",
  },
  {
    label: "Swedish",
    value: "sv",
  },
];

export default function LanguageSwitcher({ locale }: LanguageSwitcherI) {
  const [language, setLanguage] = useState(locale);
  const router = useRouter();

  const changeLanguage = async (lang: string) => {
    setLanguage(lang);
    await setCookie("language", lang);
    router.refresh();
  };

  return (
    <select
      className="font-weight-500 margin-top-25 block"
      style={{ fontSize: '1rem', minHeight: 'calc(24px + 1rem)' }}
      onChange={(e) => { changeLanguage(e.target.value) }}>
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