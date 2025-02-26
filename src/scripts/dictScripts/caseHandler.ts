export default class CaseHandler {
  public static camelToSnake(string: string): string {
    return string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
  }

  public static camelToMacro(string: string): string {
    return this.camelToSnake(string).toUpperCase();
  }

  public static camelToPascalSnake(string: string): string {
    const snakeCaseString: string = this.camelToSnake(string);
    const words: string[] = snakeCaseString.split('_');
    const wordsCapitalized: string[] = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
    return wordsCapitalized.join('_');
  }

  public static camelToPascal(string: string): string {
    return this.camelToPascalSnake(string).split('_').join('');
  }

  public static snakeToCamel(string: string): string {
    return string.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  }

  public static snakeToMacro(string: string): string {
    return string.toUpperCase();
  }

  public static macroToCamel(string: string): string {
    return string.toLowerCase().replace(/(_\w)/g, (match) => match[1].toUpperCase());
  }
}