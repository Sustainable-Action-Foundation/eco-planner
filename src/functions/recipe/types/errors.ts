export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeError";
  }
};
export class MathjsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathjsError";
  }
};
