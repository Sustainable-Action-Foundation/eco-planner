import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "scaleFactor": {
    "en": "By how much do you want to scale?",
    "sv": "Med vilket värde vill du skala?",
  }[locale],
  "originalLocation": {
    "en": "Original location:",
    "sv": "Ursprungligt område:",
  }[locale],
  "chooseLocation": {
    "en": "Choose location",
    "sv": "Välj område",
  }[locale],
  "numberOfResidents": {
    "en": "Number of residents:",
    "sv": "Antal invånare:",
  }[locale],
  "missingData": {
    "en": "data missing",
    "sv": "värde saknas",
  }[locale],
  "newLocation": {
    "en": "New location:",
    "sv": "Nytt område:",
  }[locale],
  "surfaceArea": {
    "en": "Surface area:",
    "sv": "Ytarea:",
  }[locale],
  "squareKilometers": {
    "en": "square kilometers",
    "sv": "kvadratkilometer",
  }[locale],
  "scaleBy": {
    "en": "Scale by:",
    "sv": "Skala utifrån:",
  }[locale],
  "noSelectionMade": {
    "en": "No selection made",
    "sv": "Inget alternativ valt",
  }[locale],
  "specificValue": {
    "en": "By scalar",
    "sv": "Specifikt värde",
  }[locale],
  "inRelationToPopulation": {
    "en": "By population",
    "sv": "Relativt antal invånare",
  }[locale],
  "inRelationToSurfaceArea": {
    "en": "By surface area",
    "sv": "Relativ yta",
  }[locale],
  "scaleFactorCalculation": {
    "en": "Scaling factor for this calculation:",
    "sv": "Skalfaktor för den här beräkningen:",
  }[locale],
  "weightFactor": {
    "en": "Weight for this factor (used to create a weighted average between the factors)",
    "sv": "Vikt för denna faktor (används för att skapa ett viktat genomsnitt mellan faktorerna)",
  }[locale],
});