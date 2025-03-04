/* eslint @typescript-eslint/no-explicit-any: 0 */

import { colors } from "./colors";

/* Modify console functions to color them */
export const __console = { ...console };
const consoleColors = {
  log: (text: string) => colors.gray(text),
  info: (text: string) => colors.blue(text),
  error: (text: string) => colors.red(colors.bold(text)),
  warn: (text: string) => colors.yellow(colors.bold(text)),
  debug: (text: string) => colors.cyanBright(colors.italic(text))
};

for (const [key, colorFunc] of Object.entries(consoleColors)) {
  (console as any)[key] = (...args: any) => {
    if (args.length === 1) {
      (__console as any)[key](colorFunc(styleByType(args[0], { breakLine: true })));

    } else {
      (__console as any)[key](...args.map((arg: any) => colorFunc(styleByType(arg, { breakLine: true }))));
    }
  }
}

function styleByType(value: any, options?: Options): string {
  const type = Array.isArray(value) ? "array" : typeof value;

  if (type === "string") return value;
  else if (type === "object") return styleObject(value, options);
  else if (type === "array") return styleArray(value, options);
  else return value;
}

function styleArray(arr: string[], option?: Options): string {
  let open: string, comma: string, close: string;
  if (option?.breakLine) {
    open = "[\n  ";
    comma = ",\n  ";
    close = "\n]";
  } else {
    open = "[ ";
    comma = ", ";
    close = " ]";
  }

  return `${open}${arr.join(comma)}${close}`;
}

function styleObject(obj: Record<string, unknown>, options?: Options): string {
  let open: string, colon: string, comma: string, close: string;

  if (options?.breakLine) {
    open = "{\n  ";
    colon = ": ";
    comma = ",\n  ";
    close = "\n}";
  } else {
    open = "{ ";
    colon = ": ";
    comma = ", ";
    close = " }";
  }

  const entries = Object.entries(obj).map(([key, value]) => {
    return `'${key}'${colon}${styleByType(value, { breakLine: false })}`;
  });

  return `${open}${entries.join(comma)}${close}`;
}

type Options = {
  breakLine?: boolean;
}