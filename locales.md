# Locales

This file should likely move, but it's here for the PR to `dev`.

## Locale files
They are located in [`/public/locales/{lang}/{namespace}.json`](/public/locales/{lang}/{namespace}.json).

## Locale structure
In the json locale files, the root keys all represent a file. It will have child strings or sometimes objects. Keys are written in `snake_case`.

## Usage
The following is specifically how is done in this project. For at wider grasp of how to use i18next, please refer to the [i18next documentation](https://www.i18next.com/). It will be far better at describing itself than I could.

### Declaration
In the server side files it's as simple as importing the function `t()` from [`@/lib/i18nServer`](/src/lib/i18nServer.ts). On client side files, you declare the function `t()` using the `useTranslation` hook imported from `react-i18next`. Like such:
```tsx
"use client";

import { useTranslation } from "react-i18next";

// ... Code ....

export default function ComponentName() {
  // Make sure it's declared withing a client component scope
  const { t } = useTranslation();

  // ... Code ....
}
```
### Basic usage
Using the `t()` after that is the same between the two. You can use it like this:
```tsx
t("namespace:key_1");
// and
t("namespace:key_1.key_2");

// or within a jsx element
<p>{t("namespace:key_1")}</p>
// and
<p>{t("namespace:key_1.key_2")}</p>

// An actual example would be:
<span>{t("pages:info.title")}</span>
```
### More complex usage
Keys can have a pluralization suffix. For example, if you have a key `namespace:key_1` but depending on the context you want to use `namespace:key_1_one` or `namespace:key_1_other` instead, you can do it like this:
```tsx
/* Pluralization */
t("namespace:key_1", { count: 1 }); // Returns values of namespace:key_1_one
t("namespace:key_1", { count: 2 }); // Returns values of namespace:key_1_other
// Note: namespace:key_1 is not defined in the locale files, but the pluralization suffixes are.

/* Formatters */
t("{{namespace:lowercase_key, titleCase}}") // Returns the value of namespace:lowercase_key but with a capitalized first letter.
{t("{{namespace:time_ago, relativeTime}}", {date: new Date("2023-01-01")})} // Returns the value of namespace:time_ago but with a relative time formatter.
```
[Further reading pluralization](https://www.i18next.com/translation-function/plurals).<br />
[Further reading formatters](https://www.i18next.com/translation-function/formatting).


## Code structure
Since this is a Nextjs app things need to be translated on both the server and client. In [`/src/lib/i18nClient.tsx`](/src/lib/i18nClient.tsx) and [`/src/lib/i18nServer.ts`](/src/lib/i18nServer.ts), you will find the `i18next instance` for the client and server respectively. The main differences between the two are:
- Client uses `react-i18next` for the hooks it provides.
- Client gets its translations from the server using `https` requests ([`route.ts`](src/app/api/locales/route.ts)).
- Server gets its translations from the the `file system` directly.
- Client declares `t()` for a single scope.
- Server imports `t()` for an entire file.
- Server queries what language is active every time it translates something.
- Client always uses the language of the client `i18next` instance.

## Config
The config file for the translations is located at [`/i18n.config.ts`](/i18n.config.ts). That's where you define all supported languages and namespaces as well as the language aliases shown in the [`languageSwitcher`](/src/components/languageSwitcher.tsx).

The `initTemplate()` function is also located in the [`/i18n.config.ts`](/i18n.config.ts) file. It is the shared config between the client and server instances. Specific configs can be made in their respective files, [`/src/lib/i18nClient.tsx`](/src/lib/i18nClient.tsx) and [`/src/lib/i18nServer.ts`](/src/lib/i18nServer.ts).

## Tests
As of writing this, in [`package.json`](/package.json) there are some locale related scripts:
 - `"locales:validate": "tsx ./src/scripts/localesValidate.ts"`
   - *Deprecated*. It is fully working and tests the translation files and the tsx files for missing keys, syntax errors etc. but it is being phased out in favor of `test:local` using `playwright`.
 - `"locales:format": "tsx ./src/scripts/localesFormat.ts"`
   - Sorts the root level keys of every namespace except for `common` in alphabetical order.
 - `"pretest:local": "yarn run build"`
 - `"test:local": "tsx node_modules/playwright/cli.js test"`
   - Runs the tests in [`/tests/locale-files.ts`](/tests/locale-files.ts) using `playwright`. All tests from `locales:validate` are being ported to this system. Additional tests will also be added soon, including browser tests.