## Adding a Language

To add a language to the website you need to add it to the following locations:

- Add an object containing the name of the language and the language code to the `languages` list in [languageSwitcher.tsx](/src/components/cookies/languageSwitcher.tsx).
- Add the language code to the `LOCALES` list in [constants.ts](/src/constants.ts).
- Add the language code to the `Locale` type in [types.ts](/src/types.ts).