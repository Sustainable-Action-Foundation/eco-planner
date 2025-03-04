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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (console as any)[key] = (args: any | any[]) => (__console as any)[key](Array.isArray(args) ? args.map(colorFunc) : colorFunc(args));
}