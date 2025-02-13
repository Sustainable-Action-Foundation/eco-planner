## Adding a Language

To add a language to the website you need to add it to the following locations:

- Add an object containing the name of the language and the language code to the `languages` list in [languageSwitcher.tsx](/src/components/cookies/languageSwitcher.tsx).
- Add the language code to the `LOCALES` list in [constants.ts](/src/constants.ts).
- Add a reference to the json file in [dictionaries.ts](/src/app/dictionaries.ts).
- Add the language code to the `Locale` type in [types.ts](/src/types.ts).
- Add a json file named by the language code containing all the translations for the language to [dictionaries/](/src/dictionaries/).