/** ANSI code based string coloring functions */
export const colors = {
  /* Text modifiers */
  reset: () => `\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[22m`,
  italic: (text: string) => `\x1b[3m${text}\x1b[23m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[24m`,
  overline: (text: string) => `\x1b[53m${text}\x1b[55m`,
  strikethrough: (text: string) => `\x1b[9m${text}\x1b[29m`,
  /* Text colors */
  black: (text: string) => `\x1b[30m${text}\x1b[39m`,
  red: (text: string) => `\x1b[31m${text}\x1b[39m`,
  green: (text: string) => `\x1b[32m${text}\x1b[39m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[39m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[39m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[39m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[39m`,
  white: (text: string) => `\x1b[37m${text}\x1b[39m`,
  gray: (text: string) => colors.blackBright(text),
  defaultFG: () => `\x1b[39m`,
  /* Bright text colors */
  blackBright: (text: string) => `\x1b[90m${text}\x1b[39m`,
  redBright: (text: string) => `\x1b[91m${text}\x1b[39m`,
  greenBright: (text: string) => `\x1b[92m${text}\x1b[39m`,
  yellowBright: (text: string) => `\x1b[93m${text}\x1b[39m`,
  blueBright: (text: string) => `\x1b[94m${text}\x1b[39m`,
  magentaBright: (text: string) => `\x1b[95m${text}\x1b[39m`,
  cyanBright: (text: string) => `\x1b[96m${text}\x1b[39m`,
  whiteBright: (text: string) => `\x1b[97m${text}\x1b[39m`,
  /* Background Colors */
  blackBG: (text: string) => `\x1b[40m${text}\x1b[49m`,
  redBG: (text: string) => `\x1b[41m${text}\x1b[49m`,
  greenBG: (text: string) => `\x1b[42m${text}\x1b[49m`,
  yellowBG: (text: string) => `\x1b[43m${text}\x1b[49m`,
  blueBG: (text: string) => `\x1b[44m${text}\x1b[49m`,
  magentaBG: (text: string) => `\x1b[45m${text}\x1b[49m`,
  cyanBG: (text: string) => `\x1b[46m${text}\x1b[49m`,
  whiteBG: (text: string) => `\x1b[47m${text}\x1b[49m`,
  grayBG: (text: string) => `\x1b[100m${text}\x1b[49m`,
  defaultBG: () => `\x1b[49m`,
  /* Bright background colors */
  blackBrightBG: (text: string) => `\x1b[100m${text}\x1b[49m`,
  redBrightBG: (text: string) => `\x1b[101m${text}\x1b[49m`,
  greenBrightBG: (text: string) => `\x1b[102m${text}\x1b[49m`,
  yellowBrightBG: (text: string) => `\x1b[103m${text}\x1b[49m`,
  blueBrightBG: (text: string) => `\x1b[104m${text}\x1b[49m`,
  magentaBrightBG: (text: string) => `\x1b[105m${text}\x1b[49m`,
  cyanBrightBG: (text: string) => `\x1b[106m${text}\x1b[49m`,
  whiteBrightBG: (text: string) => `\x1b[107m${text}\x1b[49m`,
  /* Custom code */
  /**
   * Insert any ANSI escape code. Note: does not emit a trailing reset code.
   * @param code ANSI escape code. https://en.wikipedia.org/wiki/ANSI_escape_code 
   * @param text optional text to color.
  */
  custom: (code: number, text?: string) => `\x1b[${code}m${text || ""}`,
  rgb: (r: number, g: number, b: number, text: string) => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`,
  rgbBG: (r: number, g: number, b: number, text: string) => `\x1b[48;2;${r};${g};${b}m${text}\x1b[49m`,
}