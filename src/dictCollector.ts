class CaseHandler {
  public static camelToSnake(string: string): string {
    return string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
  }

  public static camelToMacro(string: string): string {
    return this.camelToSnake(string).toUpperCase();
  }

  public static camelToPascalSnake(string: string): string {
    const snakeCaseString = this.camelToSnake(string);
    const words = snakeCaseString.split('_');
    const wordsCapitalized = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1));
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

console.log('\n');
console.log(CaseHandler.camelToSnake('helloWorldHeyWorld')); // hello_world
console.log(CaseHandler.camelToMacro('helloWorldHeyWorld')); // hello_world
console.log(CaseHandler.camelToPascalSnake('helloWorldHeyWorld')); // hello_world
console.log(CaseHandler.camelToPascal('helloWorldHeyWorld')); // hello_world

console.log('\n');
console.log(CaseHandler.snakeToCamel('hello_world_hey_world')); // helloWorld
console.log(CaseHandler.snakeToMacro('hello_world_hey_world')); // HELLO_WORLD

console.log('\n');
console.log(CaseHandler.macroToCamel('HELLO_WORLD_HEY_WORLD'));

console.log('\n');
