import { colors } from "./colors.js";
import { isNativeError } from "node:util/types";

/** Unmodified console */
export const __console = { ...console };

const consoleColors: { [key: string]: (text: string) => string; } = {
  log: (text: string) => colors.gray(text),
  info: (text: string) => colors.blue(text),
  error: (text: string) => colors.red(colors.bold(text)),
  warn: (text: string) => colors.yellow(colors.bold(text)),
  debug: (text: string) => colors.cyanBright(colors.italic(text)),
};

/* Apply modification */
for (const [key, colorFunc] of Object.entries(consoleColors)) {
  // @ts-expect-error - This is a valid method access
  console[key] = (...args: unknown[]) => {
    let color = colorFunc;

    /* Override color if first arg provides a color function */
    // @ts-expect-error - It's fine
    if (args?.[0]?._color) {
      // @ts-expect-error - It's fine
      color = args[0]._color;
      args = args.slice(1);
    }

    if (args.length === 1) {
      // @ts-expect-error - This is a valid method access
      __console[key](color(styleByType(args[0], { index: 0, argCount: 1, breakLine: true })));

    } else {
      // @ts-expect-error - This is a valid method access
      __console[key](...args.map((arg, index) => color(styleByType(arg, { index: index, argCount: args.length, breakLine: true }))));
    }
  }
}

function styleByType(value: unknown, options: Options): unknown {
  let type: Types = typeof value;
  // Error
  if (value instanceof Error) type = "error";
  // Error
  else if (type === "object" && isNativeError(value)) type = "error";


  if (type === "string") return styleString(value as string, options);
  if (type === "error") return styleError(value as Error, options);
  if (type === "object") return styleObject(value as object, options);
  return value;
}

function styleString(str: string, options: Options): string {
  if (options?.parentType === "object" || options?.parentType === "array") {
    return `'${str}'`;
  }
  else {
    return str;
  }
}

function styleError(error: Error, options: Options): string {
  const message = colors.underline(error.message);
  let stack = error.stack?.replace(error.message, message) || message;

  if (options?.breakLine) stack = `\n${stack}\n`;

  return colors.red(stack);
}

function styleObject(obj: object, options: Options): string {
  return JSON.stringify(obj, null, 2);
}

type Types = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "error" | "array";
type Options = {
  index?: number;
  argCount?: number;
  breakLine?: boolean;
  parentType?: Types;
}