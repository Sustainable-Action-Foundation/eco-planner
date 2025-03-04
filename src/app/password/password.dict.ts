import { Locale } from "@/types.ts";
export const createDict = (locale: Locale) => ({
  "page": {
    "breadcrumbResetPassword": {
      "en": "Reset password",
      "sv": "Återställ lösenord"
    }[locale],
    "forgotPassword": {
      "en": "Forgot password? Enter your email here and we will send you an email with instructions to reset your password.",
      "sv": "Har du glömt ditt lösenord? Fyll i din e-postadress här så skickar vi ett e-post med instruktioner för att återställa lösenordet."
    }[locale],
    "emailPlaceholder": {
      "en": "email",
      "sv": "e-post"
    }[locale],
    "sendEmail": {
      "en": "Send email",
      "sv": "Skicka e-post"
    }[locale]
  },
  "reset": {
    "page": {
      "breadcrumbUpdatePassword": {
        "en": "Update password",
        "sv": "Uppdatera lösenord"
      }[locale],
      "enterPassword": {
        "en": "Enter your new password below and click the button to update your password.",
        "sv": "Fyll i ditt nya lösenord nedan och klicka på knappen för att uppdatera ditt lösenord."
      }[locale],
      "password": {
        "en": "Password",
        "sv": "Lösenord"
      }[locale],
      "passwordPlaceholder": {
        "en": "password",
        "sv": "lösenord"
      }[locale],
      "changePassword": {
        "en": "Change Password",
        "sv": "Byt lösenord"
      }[locale]
    }
  }
});