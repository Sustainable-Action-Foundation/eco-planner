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
