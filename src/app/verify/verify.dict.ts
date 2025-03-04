import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "page": {
    "verifyEmail": {
      "en": "Verify your email address",
      "sv": "Verifiera din e-postadress"
    }[locale],
    "emailVerification": {
      "en": "An email has been sent to your email address. Please click the link in the email to verify your email address.",
      "sv": "En verifieringslänk har skickats till din e-postadress."
    }[locale],
    "noEmailReceived": {
      "en": "Did you not receive an email?",
      "sv": "Har du inte fått något e-postmeddelande?"
    }[locale],
    "retryInfo": {
      "en": "Please check your spam folder or enter your email address below and click the button to send a new email.",
      "sv": "Vänligen kontrollera din skräppostmapp eller skriv din e-postadress nedan och klicka på knappen för att skicka ett nytt e-postmeddelande."
    }[locale],
    "emailPlaceholder": {
      "en": "email",
      "sv": "e-post"
    }[locale],
    "sendNewEmail": {
      "en": "Send new email",
      "sv": "Skicka nytt e-postmeddelande"
    }[locale]
  },
  "verify": {
    "page": {
      "verifyYourEmail": {
        "en": "Verify your email address",
        "sv": "Verifiera din e-postadress"
      }[locale],
      "verifyEmailByClicking": {
        "en": "Verify your email address by clicking the button below.",
        "sv": "Verifiera din e-postadress genom att klicka på knappen nedan."
      }[locale],
      "verifyMyEmail": {
        "en": "Verify my email address",
        "sv": "Verifiera min e-postadress"
      }[locale]
    }
  }
});