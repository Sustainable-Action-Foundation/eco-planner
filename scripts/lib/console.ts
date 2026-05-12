import { colors } from "./colors.js";

/** Unmodified console */
export const __console = { ...console };

const consoleColors = {
  log: (text: string) => colors.gray(text),
  info: (text: string) => colors.blue(text),
  error: (text: string) => colors.red(colors.bold(text)),
  warn: (text: string) => colors.yellow(colors.bold(text)),
  debug: (text: string) => colors.cyanBright(colors.italic(text)),
};

/* Apply modification */
for (const [key, colorFunc] of Object.entries(consoleColors)) {
  console[key as keyof typeof consoleColors] = (...args: unknown[]) => {
    let color: (text: string) => unknown = colorFunc;

    /* Override color if first arg provides a color function */
    if (Array.isArray(args) && typeof args[0] === "object" && "_color" in (args[0] ?? {}) && typeof (args[0] as { _color: unknown })._color === "function") {
      color = (args[0] as { _color: () => unknown })._color;
      args = args.slice(1);
    }

    if (args.length === 1) {
      __console[key as keyof typeof consoleColors](color(String(styleByType(args[0], { index: 0, argCount: 1, breakLine: true }))));

    } else {
      __console[key as keyof typeof consoleColors](...args.map((arg, index) => color(String(styleByType(arg, { index: index, argCount: args.length, breakLine: true })))));
    }
  };
}

function styleByType(value: unknown, options: Options): unknown {
  let type: Types = typeof value;
  // Error
  if (Error.isError(value) || value instanceof Error) {
    type = "error";
  }

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

function styleObject(obj: object, _options: Options): string {
  return JSON.stringify(obj, null, 2);
}

type Types = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function" | "error" | "array";
type Options = {
  index?: number;
  argCount?: number;
  breakLine?: boolean;
  parentType?: Types;
}