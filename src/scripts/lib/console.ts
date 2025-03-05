/* eslint @typescript-eslint/no-explicit-any: 0 */
import { colors } from "./colors";
import { isNativeError } from "node:util/types";

const indentation = `${colors.dim("|")} `;
const indent = (depth: number): string => Array(depth).fill(indentation).join("");
// const randomColors = [colors.redBG, colors.blueBG, colors.greenBG, colors.yellowBG, colors.magentaBG, colors.cyanBG, colors.whiteBG, colors.redBrightBG, colors.blueBrightBG, colors.greenBrightBG, colors.yellowBrightBG, colors.magentaBrightBG, colors.cyanBrightBG, colors.whiteBrightBG];
// let count = 0;
// const indent = (depth: number): string => { count++; return Array(depth).fill(randomColors[count % randomColors.length](indentation)).join(""); }

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
  // Array
  if (value instanceof Array || Array.isArray(value)) type = "array";
  // Error
  else if (value instanceof Error) type = "error";
  // Error
  else if (type === "object" && isNativeError(value)) type = "error";
  // Record
  else if (type === "object" && Object.entries(value).length) type = "record";


  if (type === "string") return styleString(value, options);
  if (type === "error") return styleError(value, options);
  if (type === "array") return styleArray(value, options);
  if (type === "record") return styleRecord(value, options);
  if (type === "object") return styleObject(value, options);
  return value;
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
  const message = colors.underline(error.message);
  let stack = error.stack?.replace(error.message, message) || message;

  if (options?.breakLine) stack = `\n${stack}\n`;

  return colors.red(stack);
}

function styleArray(arr: string[], options?: Options): string {
  let open: string, comma: string, close: string;

  const breakLine = options?.breakLine || false;

  if (breakLine) {
    open = "[\n";
    comma = ",\n";
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
  if (breakLine && hasLeadingNeighbors) open = `\n${open}`;

  // If it has trailing neighbors, add a newline
  const hasTrailingNeighbors = hasNeighbors && index !== argCount - 1;
  if (breakLine && hasTrailingNeighbors) close = `${close}\n`;

  const entries = arr.map((value) => {
    return styleByType(value, { argCount: arr.length, breakLine: false, parentType: "array" });
  });

  return `${open}${entries.join(comma)}${close}`;
}

function styleRecord(obj: Record<string, unknown>, options?: Options): string {
  let open: string, colon: string, comma: string, close: string;

  let breakLine = options?.breakLine || false;
  if (options?.parentType === "record" || options?.parentType === "array") breakLine = true;

  const index = options?.index || 0;
  const argCount = options?.argCount || 0;
  const hasNeighbors = argCount !== 1;
  const isFirst = index === 0;
  const isLast = index === argCount - 1;

  if (breakLine) {
    open = `{\n${indent(1)}`;
    colon = ": ";
    comma = `,\n${indent(1)}`;
    close = `\n}`;
  } else {
    open = "{ ";
    colon = ": ";
    comma = ", ";
    close = " }";
  }

  // If it has leading neighbors, add a newline
  if (breakLine && hasNeighbors && !isFirst && options?.parentType !== "record") open = `\n${open}`;
  // If it has trailing neighbors, add a newline
  if (breakLine && hasNeighbors && !isLast && options?.parentType !== "record") close = `${close}\n`;

  const entries = Object.entries(obj).map(([key, value]) => {
    return `'${key}'${colon}${styleByType(value, { argCount: Object.keys(obj).length, breakLine: false, parentType: "record" })}`;
  });

  // Indent everything
  const output = `${open}${entries.join(comma)}${close}`.replaceAll("\n", "\n" + (options?.parentType ? indent(1) : ""));

  return output;
}

function styleObject(obj: object, options?: Options) {
  return JSON.stringify(obj, null, 2);
}

type Options = {
  index?: number;
  argCount?: number;
  breakLine?: boolean;
  parentType?: "string" | "array" | "record" | "object" | "error" | "boolean" | "number" | "symbol" | "bigint" | "function" | "undefined";
}