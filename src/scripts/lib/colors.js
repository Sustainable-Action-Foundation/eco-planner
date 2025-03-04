"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.colors = void 0;
exports.colors = {
    /* Text modifiers */
    reset: function (text) { return "\u001B[0m".concat(text, "\u001B[0m"); },
    bold: function (text) { return "\u001B[1m".concat(text, "\u001B[0m"); },
    dim: function (text) { return "\u001B[2m".concat(text, "\u001B[0m"); },
    italic: function (text) { return "\u001B[3m".concat(text, "\u001B[0m"); },
    underline: function (text) { return "\u001B[4m".concat(text, "\u001B[0m"); },
    overline: function (text) { return "\u001B[53m".concat(text, "\u001B[0m"); },
    strikethrough: function (text) { return "\u001B[9m".concat(text, "\u001B[0m"); },
    /* Text colors */
    black: function (text) { return "\u001B[30m".concat(text, "\u001B[0m"); },
    red: function (text) { return "\u001B[31m".concat(text, "\u001B[0m"); },
    green: function (text) { return "\u001B[32m".concat(text, "\u001B[0m"); },
    yellow: function (text) { return "\u001B[33m".concat(text, "\u001B[0m"); },
    blue: function (text) { return "\u001B[34m".concat(text, "\u001B[0m"); },
    magenta: function (text) { return "\u001B[35m".concat(text, "\u001B[0m"); },
    cyan: function (text) { return "\u001B[36m".concat(text, "\u001B[0m"); },
    white: function (text) { return "\u001B[37m".concat(text, "\u001B[0m"); },
    gray: function (text) { return exports.colors.blackBright(text); },
    defaultFG: function (text) { return "\u001B[39m".concat(text, "\u001B[0m"); },
    /* Bright text colors */
    blackBright: function (text) { return "\u001B[90m".concat(text, "\u001B[0m"); },
    redBright: function (text) { return "\u001B[91m".concat(text, "\u001B[0m"); },
    greenBright: function (text) { return "\u001B[92m".concat(text, "\u001B[0m"); },
    yellowBright: function (text) { return "\u001B[93m".concat(text, "\u001B[0m"); },
    blueBright: function (text) { return "\u001B[94m".concat(text, "\u001B[0m"); },
    magentaBright: function (text) { return "\u001B[95m".concat(text, "\u001B[0m"); },
    cyanBright: function (text) { return "\u001B[96m".concat(text, "\u001B[0m"); },
    whiteBright: function (text) { return "\u001B[97m".concat(text, "\u001B[0m"); },
    /* Background Colors */
    blackBG: function (text) { return "\u001B[40m".concat(text, "\u001B[0m"); },
    redBG: function (text) { return "\u001B[41m".concat(text, "\u001B[0m"); },
    greenBG: function (text) { return "\u001B[42m".concat(text, "\u001B[0m"); },
    yellowBG: function (text) { return "\u001B[43m".concat(text, "\u001B[0m"); },
    blueBG: function (text) { return "\u001B[44m".concat(text, "\u001B[0m"); },
    magentaBG: function (text) { return "\u001B[45m".concat(text, "\u001B[0m"); },
    cyanBG: function (text) { return "\u001B[46m".concat(text, "\u001B[0m"); },
    whiteBG: function (text) { return "\u001B[47m".concat(text, "\u001B[0m"); },
    grayBG: function (text) { return "\u001B[100m".concat(text, "\u001B[0m"); },
    defaultBG: function (text) { return "\u001B[49m".concat(text, "\u001B[0m"); },
    /* Bright background colors */
    blackBrightBG: function (text) { return "\u001B[100m".concat(text, "\u001B[0m"); },
    redBrightBG: function (text) { return "\u001B[101m".concat(text, "\u001B[0m"); },
    greenBrightBG: function (text) { return "\u001B[102m".concat(text, "\u001B[0m"); },
    yellowBrightBG: function (text) { return "\u001B[103m".concat(text, "\u001B[0m"); },
    blueBrightBG: function (text) { return "\u001B[104m".concat(text, "\u001B[0m"); },
    magentaBrightBG: function (text) { return "\u001B[105m".concat(text, "\u001B[0m"); },
    cyanBrightBG: function (text) { return "\u001B[106m".concat(text, "\u001B[0m"); },
    whiteBrightBG: function (text) { return "\u001B[107m".concat(text, "\u001B[0m"); },
    /* Custom code */
    /** @param code ANSI escape code. https://en.wikipedia.org/wiki/ANSI_escape_code */
    custom: function (code, text) { return "\u001B[".concat(code, "m").concat(text, "\u001B[0m"); },
    rgb: function (r, g, b, text) { return "\u001B[38;2;".concat(r, ";").concat(g, ";").concat(b, "m").concat(text, "\u001B[0m"); },
    rgbBG: function (r, g, b, text) { return "\u001B[48;2;".concat(r, ";").concat(g, ";").concat(b, "m").concat(text, "\u001B[0m"); },
};
