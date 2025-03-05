/* eslint @typescript-eslint/no-explicit-any: 0 */
import { colors } from "./colors";
import { isNativeError } from "node:util/types";

/** Unmodified console */
export const __console = { ...console };

const consoleColors = {
  log: (text: string) => colors.gray(text),
  info: (text: string) => colors.blue(text),
  error: (text: string) => colors.red(colors.bold(text)),
  warn: (text: string) => colors.yellow(colors.bold(text)),
  debug: (text: string) => colors.cyanBright(colors.italic(text))
};

/* Apply modification */
for (const [key, colorFunc] of Object.entries(consoleColors)) {
  (console as any)[key] = (...args: any) => {
    if (args.length === 1) {
      (__console as any)[key](colorFunc(styleByType(args[0], { index: 0, argCount: 1, breakLine: true })));

    } else {
      (__console as any)[key](...args.map((arg: any, index: number) => colorFunc(styleByType(arg, { index: index, argCount: args.length, breakLine: true }))));
    }
  }
}

function styleByType(value: any, options?: Options): string {
  let type: string = typeof value;
  // Error
  if (value instanceof Error) type = "error";
  // Error
  else if (type === "object" && isNativeError(value)) type = "error";


  if (type === "string") return styleString(value, options);
  if (type === "error") return styleError(value, options);
  if (type === "object") return styleObject(value, options);
  return value;
}


function styleString(str: string, options?: Options): string {
  if (options?.parentType === "object" || options?.parentType === "array") {
    return `'${str}'`;
  }
  else {
    return str;
  }
}

function styleError(error: Error, options?: Options): string {
  const message = colors.underline(error.message);
  let stack = error.stack?.replace(error.message, message) || message;

  if (options?.breakLine) stack = `\n${stack}\n`;

  return colors.red(stack);
}

function styleObject(obj: object, options?: Options) {
  return JSON.stringify(obj, null, 2);
}

type Options = {
  index?: number;
  argCount?: number;
  breakLine?: boolean;
  parentType?: "string" | "array" | "object" | "error" | "boolean" | "number" | "symbol" | "bigint" | "function" | "undefined";
}