/** 
 * ANSI code based string coloring functions
 */
export const colors = {
  /* Text modifiers */
  /**
   * Reset all styling and colors
   * @returns {string} ANSI reset code
   */
  reset: (): string => `\x1b[0m`,

  /**
   * Apply bold styling to text
   * @param {string} text - Text to make bold
   * @returns {string} Bold-styled text
   */
  bold: (text: string): string => `\x1b[1m${text}\x1b[22m`,

  /**
   * Apply dim styling to text
   * @param {string} text - Text to make dim
   * @returns {string} Dim-styled text
   */
  dim: (text: string): string => `\x1b[2m${text}\x1b[22m`,

  /**
   * Apply normal styling to text
   * @param {string} text - Text to make normal
   * @returns {string} Normal-styled
   */
  normal: (text: string): string => `\x1b[22m${text}\x1b[22m`,

  /**
   * Apply italic styling to text
   * @param {string} text - Text to make italic
   * @returns {string} Italic-styled text
   */
  italic: (text: string): string => `\x1b[3m${text}\x1b[23m`,

  /**
   * Apply underline styling to text
   * @param {string} text - Text to underline
   * @returns {string} Underlined text
   */
  underline: (text: string): string => `\x1b[4m${text}\x1b[24m`,

  /**
   * Apply overline styling to text
   * @param {string} text - Text to overline
   * @returns {string} Overlined text
   */
  overline: (text: string): string => `\x1b[53m${text}\x1b[55m`,

  /**
   * Apply strikethrough styling to text
   * @param {string} text - Text to strikethrough
   * @returns {string} Text with strikethrough
   */
  strikethrough: (text: string): string => `\x1b[9m${text}\x1b[29m`,

  /* Text colors */
  /**
   * Apply black color to text
   * @param {string} text - Text to color black
   * @returns {string} Black colored text
   */
  black: (text: string): string => `\x1b[30m${text}\x1b[39m`,

  /**
   * Apply red color to text
   * @param {string} text - Text to color red
   * @returns {string} Red colored text
   */
  red: (text: string): string => `\x1b[31m${text}\x1b[39m`,

  /**
   * Apply green color to text
   * @param {string} text - Text to color green
   * @returns {string} Green colored text
   */
  green: (text: string): string => `\x1b[32m${text}\x1b[39m`,

  /**
   * Apply yellow color to text
   * @param {string} text - Text to color yellow
   * @returns {string} Yellow colored text
   */
  yellow: (text: string): string => `\x1b[33m${text}\x1b[39m`,

  /**
   * Apply blue color to text
   * @param {string} text - Text to color blue
   * @returns {string} Blue colored text
   */
  blue: (text: string): string => `\x1b[34m${text}\x1b[39m`,

  /**
   * Apply magenta color to text
   * @param {string} text - Text to color magenta
   * @returns {string} Magenta colored text
   */
  magenta: (text: string): string => `\x1b[35m${text}\x1b[39m`,

  /**
   * Apply cyan color to text
   * @param {string} text - Text to color cyan
   * @returns {string} Cyan colored text
   */
  cyan: (text: string): string => `\x1b[36m${text}\x1b[39m`,

  /**
   * Apply white color to text
   * @param {string} text - Text to color white
   * @returns {string} White colored text
   */
  white: (text: string): string => `\x1b[37m${text}\x1b[39m`,

  /**
   * Apply gray color to text (alias for blackBright)
   * @param {string} text - Text to color gray
   * @returns {string} Gray colored text
   */
  gray: (text: string): string => colors.blackBright(text),

  /**
   * Reset text color to default
   * @returns {string} ANSI code to reset foreground color
   */
  defaultFG: (): string => `\x1b[39m`,

  /* Bright text colors */
  /**
   * Apply bright black (gray) color to text
   * @param {string} text - Text to color bright black
   * @returns {string} Bright black colored text
   */
  blackBright: (text: string): string => `\x1b[90m${text}\x1b[39m`,

  /**
   * Apply bright red color to text
   * @param {string} text - Text to color bright red
   * @returns {string} Bright red colored text
   */
  redBright: (text: string): string => `\x1b[91m${text}\x1b[39m`,

  /**
   * Apply bright green color to text
   * @param {string} text - Text to color bright green
   * @returns {string} Bright green colored text
   */
  greenBright: (text: string): string => `\x1b[92m${text}\x1b[39m`,

  /**
   * Apply bright yellow color to text
   * @param {string} text - Text to color bright yellow
   * @returns {string} Bright yellow colored text
   */
  yellowBright: (text: string): string => `\x1b[93m${text}\x1b[39m`,

  /**
   * Apply bright blue color to text
   * @param {string} text - Text to color bright blue
   * @returns {string} Bright blue colored text
   */
  blueBright: (text: string): string => `\x1b[94m${text}\x1b[39m`,

  /**
   * Apply bright magenta color to text
   * @param {string} text - Text to color bright magenta
   * @returns {string} Bright magenta colored text
   */
  magentaBright: (text: string): string => `\x1b[95m${text}\x1b[39m`,

  /**
   * Apply bright cyan color to text
   * @param {string} text - Text to color bright cyan
   * @returns {string} Bright cyan colored text
   */
  cyanBright: (text: string): string => `\x1b[96m${text}\x1b[39m`,

  /**
   * Apply bright white color to text
   * @param {string} text - Text to color bright white
   * @returns {string} Bright white colored text
   */
  whiteBright: (text: string): string => `\x1b[97m${text}\x1b[39m`,

  /* Background Colors */
  /**
   * Apply black background to text
   * @param {string} text - Text to apply black background to
   * @returns {string} Text with black background
   */
  blackBG: (text: string): string => `\x1b[40m${text}\x1b[49m`,

  /**
   * Apply red background to text
   * @param {string} text - Text to apply red background to
   * @returns {string} Text with red background
   */
  redBG: (text: string): string => `\x1b[41m${text}\x1b[49m`,

  /**
   * Apply green background to text
   * @param {string} text - Text to apply green background to
   * @returns {string} Text with green background
   */
  greenBG: (text: string): string => `\x1b[42m${text}\x1b[49m`,

  /**
   * Apply yellow background to text
   * @param {string} text - Text to apply yellow background to
   * @returns {string} Text with yellow background
   */
  yellowBG: (text: string): string => `\x1b[43m${text}\x1b[49m`,

  /**
   * Apply blue background to text
   * @param {string} text - Text to apply blue background to
   * @returns {string} Text with blue background
   */
  blueBG: (text: string): string => `\x1b[44m${text}\x1b[49m`,

  /**
   * Apply magenta background to text
   * @param {string} text - Text to apply magenta background to
   * @returns {string} Text with magenta background
   */
  magentaBG: (text: string): string => `\x1b[45m${text}\x1b[49m`,

  /**
   * Apply cyan background to text
   * @param {string} text - Text to apply cyan background to
   * @returns {string} Text with cyan background
   */
  cyanBG: (text: string): string => `\x1b[46m${text}\x1b[49m`,

  /**
   * Apply white background to text
   * @param {string} text - Text to apply white background to
   * @returns {string} Text with white background
   */
  whiteBG: (text: string): string => `\x1b[47m${text}\x1b[49m`,

  /**
   * Apply gray background to text
   * @param {string} text - Text to apply gray background to
   * @returns {string} Text with gray background
   */
  grayBG: (text: string): string => `\x1b[100m${text}\x1b[49m`,

  /**
   * Reset background color to default
   * @returns {string} ANSI code to reset background color
   */
  defaultBG: (): string => `\x1b[49m`,

  /* Bright background colors */
  /**
   * Apply bright black background to text
   * @param {string} text - Text to apply bright black background to
   * @returns {string} Text with bright black background
   */
  blackBrightBG: (text: string): string => `\x1b[100m${text}\x1b[49m`,

  /**
   * Apply bright red background to text
   * @param {string} text - Text to apply bright red background to
   * @returns {string} Text with bright red background
   */
  redBrightBG: (text: string): string => `\x1b[101m${text}\x1b[49m`,

  /**
   * Apply bright green background to text
   * @param {string} text - Text to apply bright green background to
   * @returns {string} Text with bright green background
   */
  greenBrightBG: (text: string): string => `\x1b[102m${text}\x1b[49m`,

  /**
   * Apply bright yellow background to text
   * @param {string} text - Text to apply bright yellow background to
   * @returns {string} Text with bright yellow background
   */
  yellowBrightBG: (text: string): string => `\x1b[103m${text}\x1b[49m`,

  /**
   * Apply bright blue background to text
   * @param {string} text - Text to apply bright blue background to
   * @returns {string} Text with bright blue background
   */
  blueBrightBG: (text: string): string => `\x1b[104m${text}\x1b[49m`,

  /**
   * Apply bright magenta background to text
   * @param {string} text - Text to apply bright magenta background to
   * @returns {string} Text with bright magenta background
   */
  magentaBrightBG: (text: string): string => `\x1b[105m${text}\x1b[49m`,

  /**
   * Apply bright cyan background to text
   * @param {string} text - Text to apply bright cyan background to
   * @returns {string} Text with bright cyan background
   */
  cyanBrightBG: (text: string): string => `\x1b[106m${text}\x1b[49m`,

  /**
   * Apply bright white background to text
   * @param {string} text - Text to apply bright white background to
   * @returns {string} Text with bright white background
   */
  whiteBrightBG: (text: string): string => `\x1b[107m${text}\x1b[49m`,

  /* Custom code */
  /**
   * Insert any ANSI escape code. Note: does not emit a trailing reset code.
   * @param {string} code - ANSI escape code. https://en.wikipedia.org/wiki/ANSI_escape_code 
   * @param {string} [text=""] - Optional text to color
   * @returns {string} Text with custom ANSI code applied
   */
  custom: (code: string, text: string = ""): string => `\x1b[${code}m${text || ""}`,

  /**
   * Apply RGB color to text
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @param {string} text - Text to apply RGB color to
   * @returns {string} Text with RGB color applied
   */
  rgb: (r: number, g: number, b: number, text: string): string => `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`,

  /**
   * Apply RGB color to text background
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @param {string} text - Text to apply RGB background to
   * @returns {string} Text with RGB background applied
   */
  rgbBG: (r: number, g: number, b: number, text: string): string => `\x1b[48;2;${r};${g};${b}m${text}\x1b[49m`,
}