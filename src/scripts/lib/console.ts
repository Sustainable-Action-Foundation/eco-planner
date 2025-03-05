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
  let type: any = typeof value;
  // Array
  if (Array.isArray(value)) type = "array";
  // Error
  else if (value instanceof Error) type = "error";
  // Record
  else if (type === "object" && Object.entries(value).length) type = "record";
  // Error
  else if (type === "object" && isNativeError(value)) type = "error";


  if (type === "string") return styleString(value, options);
  else if (type === "error") return styleError(value, options);
  else if (type === "array") return styleArray(value, options);
  else if (type === "record") return styleRecord(value, options);
  else if (type === "object") return styleObject(value, options);
  else return value;
}


function styleString(str: string, options?: Options): string {
  if (options?.parentType === "record" || options?.parentType === "array") {
    return `'${str}'`;
  }
  else {
    return str;
  }
}

function styleError(error: Error, options?: Options): string {
  // Underline the message
  const message = `${colors.custom(4)}${error.message}${colors.custom(24)}`;
  let stack = error.stack?.replace(error.message, message) || message;

  if (options?.breakLine) stack = `\n${stack}\n`;

  return colors.red(stack);
}

function styleArray(arr: string[], options?: Options): string {
  let open: string, comma: string, close: string;

  if (options?.breakLine) {
    open = "[\n  ";
    comma = ",\n  ";
    close = "\n]";
  } else {
    open = "[ ";
    comma = ", ";
    close = " ]";
  }

  const argCount = options?.argCount || 0;
  const index = options?.index || 0;

  const hasNeighbors = argCount !== 1;

  // If it has leading neighbors, add a newline
  const hasLeadingNeighbors = hasNeighbors && index !== 0;
  if (hasLeadingNeighbors) open = `\n${open}`;

  // If it has trailing neighbors, add a newline
  const hasTrailingNeighbors = hasNeighbors && index !== argCount - 1;
  if (hasTrailingNeighbors) close = `${close}\n`;

  const entries = arr.map((value) => {
    return styleByType(value, { argCount: arr.length, breakLine: false, parentType: "array" });
  });

  return `${open}${entries.join(comma)}${close}`;
}

function styleRecord(obj: Record<string, unknown>, options?: Options): string {
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

  const argCount = options?.argCount || 0;
  const index = options?.index || 0;

  const hasNeighbors = argCount !== 1;

  // If it has leading neighbors, add a newline
  const hasLeadingNeighbors = hasNeighbors && index !== 0;
  if (hasLeadingNeighbors) open = `\n${open}`;

  // If it has trailing neighbors, add a newline
  const hasTrailingNeighbors = hasNeighbors && index !== argCount - 1;
  if (hasTrailingNeighbors) close = `${close}\n`;

  const entries = Object.entries(obj).map(([key, value]) => {
    return `'${key}'${colon}${styleByType(value, { argCount: Object.keys(obj).length, breakLine: false, parentType: "record" })}`;
  });

  return `${open}${entries.join(comma)}${close}`;
}

function styleObject(obj: object, options?: Options) {
  return JSON.stringify(obj, null, 2);
}

type Options = {
  index?: number;
  argCount?: number;
  breakLine?: boolean;
  parentType?: string;
}