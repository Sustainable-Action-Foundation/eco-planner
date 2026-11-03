class NamedError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;

    // Keep instanceof checks reliable when extending built-ins.
    Object.setPrototypeOf(this, new.target.prototype);

    // Hide constructor frames in V8-based runtimes (Node.js / Next.js).
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, new.target);
    }
  }
}

export class RecipeError extends NamedError {
  constructor(message: string) {
    super("RecipeError", message);
  }
}

export class MathjsError extends NamedError {
  constructor(message: string) {
    super("MathjsError", message);
  }
}

/** What `Recipe.evaluate` puts in front of the message mathjs threw. */
export const MathjsErrorPrefix = "Error evaluating formula equation: ";

/**
 * Raw mathjs messages with a readable replacement. Matched by pattern rather
 * than the full text: the argument index and the order mathjs lists the
 * expected types in vary between calls and versions.
 */
const mathjsErrorAliases: { pattern: RegExp, friendly: string }[] = [
  { pattern: /function addScalar \(expected: Unit, actual: number/, friendly: "Cannot add a unitless number to a unit." },
  { pattern: /function addScalar \(expected: [^)]*, actual: Unit/, friendly: "Cannot add a unit to a unitless number." },
  { pattern: /function subtractScalar \(expected: Unit, actual: number/, friendly: "Cannot subtract a unitless number from a unit." },
  { pattern: /function subtractScalar \(expected: [^)]*, actual: Unit/, friendly: "Cannot subtract a unit from a unitless number." },
];

/**
 * The message to show a user for an evaluation error: the mathjs messages the
 * aliases cover become their friendly text, anything else is returned as is.
 * Works on the bare mathjs message and on the {@link MathjsError} message that
 * wraps it with {@link MathjsErrorPrefix}.
 */
export function friendlyRecipeErrorMessage(message: string): string {
  const alias = mathjsErrorAliases.find(({ pattern }) => pattern.test(message));
  return alias ? alias.friendly : message;
}
