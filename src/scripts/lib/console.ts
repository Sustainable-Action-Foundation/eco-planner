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

/** Apply modification */
for (const [key, colorFunc] of Object.entries(consoleColors)) {
  (console as any)[key] = (...args: any) => {
    if (args.length === 1) {
      (__console as any)[key](colorFunc(styleByType(args[0], { index: 0, breakLine: true })));

    } else {
      (__console as any)[key](...args.map((arg: any, index: number) => colorFunc(styleByType(arg, { index, breakLine: true }))));
    }
  }
}

function styleByType(value: any, options?: Options): string {
  if (options?.index) options.index += 1;

  let type: any = typeof value;
  // Array
  if (Array.isArray(value)) type = "array";
  // Error
  if (value instanceof Error) type = "error";
  // Record
  if (type === "object" && Object.entries(value).length) type = "record";
  // Error
  if (type === "object" && isNativeError(value)) type = "error";


  if (type === "error") return styleError(value, options);
  else if (type === "array") return styleArray(value, options);
  else if (type === "record") return styleRecord(value, options);
  else return value;
}

function styleError(error: Error, options?: Options): string {
  const message = `${colors.custom(4)}${error.message}${colors.custom(24)}`;
  let stack = error.stack?.replace(error.message, message) || message;

  if(options?.breakLine) stack = `\n${stack}\n`;

  return colors.red(stack);
}

function styleArray(arr: string[], options?: Options): string {
  let open: string, comma: string, close: string;

  if (options?.breakLine) {
    open = "[\n  ";
    comma = ",\n  ";
    close = "\n]\n";
  } else {
    open = "[ ";
    comma = ", ";
    close = " ]";
  }

  if (options?.index !== 0) open = `\n${open}`;

  return `${open}${arr.join(comma)}${close}`;
}

function styleRecord(obj: Record<string, unknown>, options?: Options): string {
  let open: string, colon: string, comma: string, close: string;

  if (options?.breakLine) {
    open = "{\n  ";
    colon = ": ";
    comma = ",\n  ";
    close = "\n}\n";
  } else {
    open = "{ ";
    colon = ": ";
    comma = ", ";
    close = " }";
  }

  if (options?.index !== 0) open = `\n${open}`;

  const entries = Object.entries(obj).map(([key, value]) => {
    return `'${key}'${colon}${styleByType(value, { breakLine: false })}`;
  });

  return `${open}${entries.join(comma)}${close}`;
}

type Options = {
  index?: number;
  breakLine?: boolean;
}