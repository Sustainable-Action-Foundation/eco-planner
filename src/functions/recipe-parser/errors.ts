export class RecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
export class RecipeInvalidFormatError extends RecipeError { }
export class RecipeEquationError extends RecipeError { }
export class RecipeVariablesError extends RecipeError { }

export class VectorTransformError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
