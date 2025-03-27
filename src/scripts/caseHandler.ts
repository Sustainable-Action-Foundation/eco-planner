const possibleCases: string[] = [
  "pascal",
  "camel",
  "macro",
  "pascalSnake",
  "pascalKebab",
  "kebab",
  "snake",
];
export default class CaseHandler {

  public static detectCase(string: string): string {
    let localPossibleCases: string[] = possibleCases;

    if (string.charAt(0).match(/[a-z]/i)) {
      // Check if string contains underscores
      if (string.includes("_")) {
        localPossibleCases = localPossibleCases.filter((value) => value.includes("snake") || value.includes("Snake") || value.includes("macro"));
      } else {
        localPossibleCases = localPossibleCases.filter((value) => !value.includes("snake") && !value.includes("Snake") && !value.includes("macro"));
      }
      // Check if string contains dashes
      if (string.includes("-")) {
        localPossibleCases = localPossibleCases.filter((value) => value.includes("kebab") || value.includes("Kebab"));
      } else {
        localPossibleCases = localPossibleCases.filter((value) => !value.includes("kebab") && !value.includes("Kebab"));
      }
      // Check if string starts with upper case letter
      if (string.charAt(0).match(/[A-Z]/)) {
        localPossibleCases = localPossibleCases.filter((value) => value.includes("pascal") || value.includes("macro"));
      }
      // Check if string starts with lower case letter
      if (string.charAt(0).match(/[a-z]/)) {
        localPossibleCases = localPossibleCases.filter((value) => value.includes("camel") || value.includes("kebab") || value.includes("snake"));
      }
      // Check if string is all upper case
      if (string == string.toUpperCase()) {
        localPossibleCases = localPossibleCases.filter((value) => value.includes("macro"));
      } else {
        localPossibleCases = localPossibleCases.filter((value) => !value.includes("macro"));
      }
    }

    if (localPossibleCases.length === 1) {
      return localPossibleCases[0];
    } else {
      return "unknown";
    }
  };

  // TO PASCAL FUNCTIONS
  public static toPascalCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return string;
      case "camel":
        return this.camelToPascal(string);
      case "macro":
        return this.macroToPascal(string);
      case "pascalSnake":
        return this.pascalSnakeToPascal(string);
      case "pascalKebab":
        return this.pascalKebabToPascal(string);
      case "kebab":
        return this.kebabToPascal(string);
      case "snake":
        return this.snakeToPascal(string);
      default:
        return "unknown";
    }
  }

  public static camelToPascal(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static macroToPascal(string: string): string {
    string = string.toLowerCase().replace(/(_\w)/g, (match) => match[1].toUpperCase());
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static pascalSnakeToPascal(string: string): string {
    return string.replace(/_/g, '');
  }

  public static pascalKebabToPascal(string: string): string {
    return string.replace(/-/g, '');
  }

  public static kebabToPascal(string: string): string {
    string = string.replace(/(-\w)/g, (match) => match[1].toUpperCase());
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static snakeToPascal(string: string): string {
    string = string.replace(/(_\w)/g, (match) => match[1].toUpperCase());
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // TO CAMEL FUNCTIONS
  public static toCamelCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToCamel(string);
      case "camel":
        return string;
      case "macro":
        return this.macroToCamel(string);
      case "pascalSnake":
        return this.pascalSnakeToCamel(string);
      case "pascalKebab":
        return this.pascalKebabToCamel(string);
      case "kebab":
        return this.kebabToCamel(string);
      case "snake":
        return this.snakeToCamel(string);
      default:
        return "unknown";
    }
  }

  public static pascalToCamel(string: string): string {
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  public static macroToCamel(string: string): string {
    return string.toLowerCase().replace(/(_\w)/g, (match) => match[1].toUpperCase());
  }

  public static pascalSnakeToCamel(string: string): string {
    string = string.replace(/_/g, '');
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  public static pascalKebabToCamel(string: string): string {
    string = string.replace(/-/g, '');
    return string.charAt(0).toLowerCase() + string.slice(1);
  }

  public static kebabToCamel(string: string): string {
    return string.replace(/(-\w)/g, (match) => match[1].toUpperCase());
  }

  public static snakeToCamel(string: string): string {
    return string.replace(/(_\w)/g, (match) => match[1].toUpperCase());
  }

  // TO MACRO FUNCTIONS
  public static toMacroCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToMacro(string);
      case "camel":
        return this.camelToMacro(string);
      case "macro":
        return string;
      case "pascalSnake":
        return this.pascalSnakeToMacro(string);
      case "pascalKebab":
        return this.pascalKebabToMacro(string);
      case "kebab":
        return this.kebabToMacro(string);
      case "snake":
        return this.snakeToMacro(string);
      default:
        return "unknown";
    }
  }

  public static kebabToMacro(string: string): string {
    return string.replace(/-/g, '_').toUpperCase();
  }

  public static pascalKebabToMacro(string: string): string {
    return string.replace(/-/g, '_').toUpperCase();
  }

  public static camelToMacro(string: string): string {
    return this.camelToSnake(string).toUpperCase();
  }

  public static pascalToMacro(string: string): string {
    return this.pascalToSnake(string).toUpperCase();
  }

  public static snakeToMacro(string: string): string {
    return string.toUpperCase();
  }

  public static pascalSnakeToMacro(string: string): string {
    return string.toUpperCase();
  }

  // TO PASCAL_SNAKE FUNCTIONS
  public static toPascalSnakeCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToPascalSnake(string);
      case "camel":
        return this.camelToPascalSnake(string);
      case "macro":
        return this.macroToPascalSnake(string);
      case "pascalSnake":
        return string;
      case "pascalKebab":
        return this.pascalKebabToPascalSnake(string);
      case "kebab":
        return this.kebabToPascalSnake(string);
      case "snake":
        return this.snakeToPascalSnake(string);
      default:
        return "unknown";
    }
  }

  public static pascalToPascalSnake(string: string): string {
    return string.replace(/([A-Z])/g, (match) => `_${match}`).slice(1);
  }

  public static camelToPascalSnake(string: string): string {
    string = string.replace(/([A-Z])/g, (match) => `_${match}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static macroToPascalSnake(string: string): string {
    string = string.toLowerCase().replace(/(_\w)/g, (match) => `_${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static pascalKebabToPascalSnake(string: string): string {
    return string.replace(/-/g, '_')
  }

  public static kebabToPascalSnake(string: string): string {
    string = string.replace(/(-\w)/g, (match) => `_${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static snakeToPascalSnake(string: string): string {
    string = string.replace(/(_\w)/g, (match) => `_${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // TO PASCAL KEBAB FUNCTIONS
  public static toPascalKebabCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToPascalKebab(string);
      case "camel":
        return this.camelToPascalKebab(string);
      case "macro":
        return this.macroToPascalKebab(string);
      case "pascalSnake":
        return this.pascalSnakeToPascalKebab(string);
      case "pascalKebab":
        return string;
      case "kebab":
        return this.kebabToPascalKebab(string);
      case "snake":
        return this.snakeToPascalKebab(string);
      default:
        return "unknown";
    }
  }

  public static pascalToPascalKebab(string: string): string {
    return string.replace(/([A-Z])/g, (match) => `-${match}`).slice(1);
  }

  public static camelToPascalKebab(string: string): string {
    string = string.replace(/([A-Z])/g, (match) => `-${match}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static macroToPascalKebab(string: string): string {
    string = string.toLowerCase().replace(/(_\w)/g, (match) => `-${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static pascalSnakeToPascalKebab(string: string): string {
    return string.replace(/_/g, '-');
  }

  public static kebabToPascalKebab(string: string): string {
    string = string.replace(/(-\w)/g, (match) => `-${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public static snakeToPascalKebab(string: string): string {
    string = string.replace(/(_\w)/g, (match) => `-${match[1].toUpperCase()}`);
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // TO KEBAB FUNCTIONS
  public static toKebabCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToKebab(string);
      case "camel":
        return this.camelToKebab(string);
      case "macro":
        return this.macroToKebab(string);
      case "pascalSnake":
        return this.pascalSnakeToKebab(string);
      case "pascalKebab":
        return this.pascalKebabToKebab(string);
      case "kebab":
        return string;
      case "snake":
        return this.snakeToKebab(string);
      default:
        return "unknown";
    }
  }

  public static pascalToKebab(string: string): string {
    return this.pascalToSnake(string).replace(/_/g, '-');
  }

  public static camelToKebab(string: string): string {
    return this.camelToSnake(string).replace(/_/g, '-');
  }

  public static macroToKebab(string: string): string {
    return string.toLowerCase().replace(/_/g, '-');
  }

  public static pascalSnakeToKebab(string: string): string {
    return string.toLowerCase().replace(/_/g, '-');
  }

  public static pascalKebabToKebab(string: string): string {
    return string.toLowerCase();
  }

  public static snakeToKebab(string: string): string {
    return string.replace(/_/g, '-');
  }

  // TO SNAKE FUNCTIONS
  public static toSnakeCase(string: string): string {
    const detectedCase: string = this.detectCase(string);
    switch (detectedCase) {
      case "pascal":
        return this.pascalToSnake(string);
      case "camel":
        return this.camelToSnake(string);
      case "macro":
        return this.macroToSnake(string);
      case "pascalSnake":
        return this.pascalSnakeToSnake(string);
      case "pascalKebab":
        return this.pascalKebabToSnake(string);
      case "kebab":
        return this.kebabToSnake(string);
      case "snake":
        return string;
      default:
        return "unknown";
    }
  }

  public static pascalToSnake(string: string): string {
    string = string.replace(string[0], string[0].toLowerCase());
    return string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
  }

  public static camelToSnake(string: string): string {
    return string.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
  }

  public static macroToSnake(string: string): string {
    return string.toLowerCase();
  }

  public static pascalSnakeToSnake(string: string): string {
    return string.toLowerCase();
  }

  public static kebabToSnake(string: string): string {
    return string.replace(/-/g, '_');
  }

  public static pascalKebabToSnake(string: string): string {
    return string.replace(/-/g, '_').toLowerCase();
  }
}

function testAllCases() {
  const snakeCaseString: string = "this_is_a_snake_case_string";
  const camelCaseString: string = "thisIsACamelCaseString";
  const pascalCaseString: string = "ThisIsAPascalCaseString";
  const macroCaseString: string = "THIS_IS_A_MACRO_CASE_STRING";
  const pascalSnakeCaseString: string = "This_Is_A_Pascal_Snake_Case_String";
  const kebabCaseString: string = "this-is-a-kebab-case-string";
  const pascalKebabCaseString: string = "This-Is-A-Pascal-Kebab-Case-String";

  console.log("--------------------------------------------------");
  console.log("TO PASCAL CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.camelToPascal(camelCaseString)); // ThisIsACamelCaseString
  console.log(CaseHandler.macroToPascal(macroCaseString)); // ThisIsAMacroCaseString
  console.log(CaseHandler.pascalSnakeToPascal(pascalSnakeCaseString)); // ThisIsAPascalSnakeCaseString
  console.log(CaseHandler.pascalKebabToPascal(pascalKebabCaseString)); // ThisIsAPascalKebabCaseString
  console.log(CaseHandler.kebabToPascal(kebabCaseString)); // ThisIsAKebabCaseString
  console.log(CaseHandler.snakeToPascal(snakeCaseString)); // ThisIsASnakeCaseString

  console.log("");

  console.log(CaseHandler.toPascalCase(camelCaseString)); // ThisIsACamelCaseString
  console.log(CaseHandler.toPascalCase(macroCaseString)); // ThisIsAMacroCaseString
  console.log(CaseHandler.toPascalCase(pascalSnakeCaseString)); // ThisIsAPascalSnakeCaseString
  console.log(CaseHandler.toPascalCase(pascalKebabCaseString)); // ThisIsAPascalKebabCaseString
  console.log(CaseHandler.toPascalCase(kebabCaseString)); // ThisIsAKebabCaseString
  console.log(CaseHandler.toPascalCase(snakeCaseString)); // ThisIsASnakeCaseString

  console.log("--------------------------------------------------");
  console.log("TO CAMEL CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToCamel(pascalCaseString)); // thisIsAPascalCaseString
  console.log(CaseHandler.macroToCamel(macroCaseString)); // thisIsAMacroCaseString
  console.log(CaseHandler.pascalSnakeToCamel(pascalSnakeCaseString)); // thisIsAPascalSnakeCaseString
  console.log(CaseHandler.pascalKebabToCamel(pascalKebabCaseString)); // thisIsAPascalKebabCaseString
  console.log(CaseHandler.kebabToCamel(kebabCaseString)); // thisIsAKebabCaseString
  console.log(CaseHandler.snakeToCamel(snakeCaseString)); // thisIsASnakeCaseString

  console.log("");

  console.log(CaseHandler.toCamelCase(pascalCaseString)); // thisIsAPascalCaseString
  console.log(CaseHandler.toCamelCase(macroCaseString)); // thisIsAMacroCaseString
  console.log(CaseHandler.toCamelCase(pascalSnakeCaseString)); // thisIsAPascalSnakeCaseString
  console.log(CaseHandler.toCamelCase(pascalKebabCaseString)); // thisIsAPascalKebabCaseString
  console.log(CaseHandler.toCamelCase(kebabCaseString)); // thisIsAKebabCaseString
  console.log(CaseHandler.toCamelCase(snakeCaseString)); // thisIsASnakeCaseString

  console.log("--------------------------------------------------");
  console.log("TO MACRO CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToMacro(pascalCaseString)); // THIS_IS_A_PASCAL_CASE_STRING
  console.log(CaseHandler.camelToMacro(camelCaseString)); // THIS_IS_A_CAMEL_CASE_STRING
  console.log(CaseHandler.pascalSnakeToMacro(pascalSnakeCaseString)); // THIS_IS_A_PASCAL_SNAKE_CASE_STRING
  console.log(CaseHandler.pascalKebabToMacro(pascalKebabCaseString)); // THIS_IS_A_PASCAL_KEBAB_CASE_STRING
  console.log(CaseHandler.kebabToMacro(kebabCaseString)); // THIS_IS_A_KEBAB_CASE_STRING
  console.log(CaseHandler.snakeToMacro(snakeCaseString)); // THIS_IS_A_SNAKE_CASE_STRING

  console.log("");

  console.log(CaseHandler.toMacroCase(pascalCaseString)); // THIS_IS_A_PASCAL_CASE_STRING
  console.log(CaseHandler.toMacroCase(camelCaseString)); // THIS_IS_A_CAMEL_CASE_STRING
  console.log(CaseHandler.toMacroCase(pascalSnakeCaseString)); // THIS_IS_A_PASCAL_SNAKE_CASE_STRING
  console.log(CaseHandler.toMacroCase(pascalKebabCaseString)); // THIS_IS_A_PASCAL_KEBAB_CASE_STRING
  console.log(CaseHandler.toMacroCase(kebabCaseString)); // THIS_IS_A_KEBAB_CASE_STRING
  console.log(CaseHandler.toMacroCase(snakeCaseString)); // THIS_IS_A_SNAKE_CASE_STRING

  console.log("--------------------------------------------------");
  console.log("TO PASCAL SNAKE CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToPascalSnake(pascalCaseString)); // This_Is_A_Pascal_Case_String
  console.log(CaseHandler.camelToPascalSnake(camelCaseString)); // This_Is_A_Camel_Case_String
  console.log(CaseHandler.macroToPascalSnake(macroCaseString)); // This_Is_A_Macro_Case_String
  console.log(CaseHandler.pascalKebabToPascalSnake(pascalKebabCaseString)); // This_Is_A_Pascal_Kebab_Case_String
  console.log(CaseHandler.kebabToPascalSnake(kebabCaseString)); // This_Is_A_Kebab_Case_String
  console.log(CaseHandler.snakeToPascalSnake(snakeCaseString)); // This_Is_A_Snake_Case_String

  console.log("");

  console.log(CaseHandler.toPascalSnakeCase(pascalCaseString)); // This_Is_A_Pascal_Case_String
  console.log(CaseHandler.toPascalSnakeCase(camelCaseString)); // This_Is_A_Camel_Case_String
  console.log(CaseHandler.toPascalSnakeCase(macroCaseString)); // This_Is_A_Macro_Case_String
  console.log(CaseHandler.toPascalSnakeCase(pascalKebabCaseString)); // This_Is_A_Pascal_Kebab_Case_String
  console.log(CaseHandler.toPascalSnakeCase(kebabCaseString)); // This_Is_A_Kebab_Case_String
  console.log(CaseHandler.toPascalSnakeCase(snakeCaseString)); // This_Is_A_Snake_Case_String

  console.log("--------------------------------------------------");
  console.log("TO PASCAL KEBAB CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToPascalKebab(pascalCaseString)); // This-Is-A-Pascal-Case-String
  console.log(CaseHandler.camelToPascalKebab(camelCaseString)); // This-Is-A-Camel-Case-String
  console.log(CaseHandler.macroToPascalKebab(macroCaseString)); // This-Is-A-Macro-Case-String
  console.log(CaseHandler.pascalSnakeToPascalKebab(pascalSnakeCaseString)); // This-Is-A-Pascal-Snake-Case-String
  console.log(CaseHandler.kebabToPascalKebab(kebabCaseString)); // This-Is-A-Kebab-Case-String
  console.log(CaseHandler.snakeToPascalKebab(snakeCaseString)); // This-Is-A-Snake-Case-String

  console.log("");

  console.log(CaseHandler.toPascalKebabCase(pascalCaseString)); // This-Is-A-Pascal-Case-String
  console.log(CaseHandler.toPascalKebabCase(camelCaseString)); // This-Is-A-Camel-Case-String
  console.log(CaseHandler.toPascalKebabCase(macroCaseString)); // This-Is-A-Macro-Case-String
  console.log(CaseHandler.toPascalKebabCase(pascalSnakeCaseString)); // This-Is-A-Pascal-Snake-Case-String
  console.log(CaseHandler.toPascalKebabCase(kebabCaseString)); // This-Is-A-Kebab-Case-String
  console.log(CaseHandler.toPascalKebabCase(snakeCaseString)); // This-Is-A-Snake-Case-String

  console.log("--------------------------------------------------");
  console.log("TO KEBAB CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToKebab(pascalCaseString)); // this-is-a-pascal-case-string
  console.log(CaseHandler.camelToKebab(camelCaseString)); // this-is-a-camel-case-string
  console.log(CaseHandler.macroToKebab(macroCaseString)); // this-is-a-macro-case-string
  console.log(CaseHandler.pascalSnakeToKebab(pascalSnakeCaseString)); // this-is-a-pascal-snake-case-string
  console.log(CaseHandler.pascalKebabToKebab(pascalKebabCaseString)); // this-is-a-pascal-kebab-case-string
  console.log(CaseHandler.snakeToKebab(snakeCaseString)); // this-is-a-snake-case-string

  console.log("");

  console.log(CaseHandler.toKebabCase(pascalCaseString)); // this-is-a-pascal-case-string
  console.log(CaseHandler.toKebabCase(camelCaseString)); // this-is-a-camel-case-string
  console.log(CaseHandler.toKebabCase(macroCaseString)); // this-is-a-macro-case-string
  console.log(CaseHandler.toKebabCase(pascalSnakeCaseString)); // this-is-a-pascal-snake-case-string
  console.log(CaseHandler.toKebabCase(pascalKebabCaseString)); // this-is-a-pascal-kebab-case-string
  console.log(CaseHandler.toKebabCase(snakeCaseString)); // this-is-a-snake-case-string

  console.log("--------------------------------------------------");
  console.log("TO SNAKE CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.pascalToSnake(pascalCaseString)); // this_is_a_pascal_case_string
  console.log(CaseHandler.camelToSnake(camelCaseString)); // this_is_a_camel_case_string
  console.log(CaseHandler.macroToSnake(macroCaseString)); // this_is_a_macro_case_string
  console.log(CaseHandler.pascalSnakeToSnake(pascalSnakeCaseString)); // this_is_a_pascal_snake_case_string
  console.log(CaseHandler.kebabToSnake(kebabCaseString)); // this_is_a_kebab_case_string
  console.log(CaseHandler.pascalKebabToSnake(pascalKebabCaseString)); // this_is_a_pascal_kebab_case_string

  console.log("");

  console.log(CaseHandler.toSnakeCase(pascalCaseString)); // this_is_a_pascal_case_string
  console.log(CaseHandler.toSnakeCase(camelCaseString)); // this_is_a_camel_case_string
  console.log(CaseHandler.toSnakeCase(macroCaseString)); // this_is_a_macro_case_string
  console.log(CaseHandler.toSnakeCase(pascalSnakeCaseString)); // this_is_a_pascal_snake_case_string
  console.log(CaseHandler.toSnakeCase(kebabCaseString)); // this_is_a_kebab_case_string
  console.log(CaseHandler.toSnakeCase(pascalKebabCaseString)); // this_is_a_pascal_kebab_case_string

  console.log("--------------------------------------------------");
  console.log("DETECT CASE");
  console.log("--------------------------------------------------");

  console.log(CaseHandler.detectCase(snakeCaseString)); // snake
  console.log(CaseHandler.detectCase(kebabCaseString)); // kebab
  console.log(CaseHandler.detectCase(pascalCaseString)); // pascal
  console.log(CaseHandler.detectCase(camelCaseString)); // camel
  console.log(CaseHandler.detectCase(macroCaseString)); // macro
  console.log(CaseHandler.detectCase(pascalSnakeCaseString)); // pascalSnake
  console.log(CaseHandler.detectCase(pascalKebabCaseString)); // pascalKebab
}

// testAllCases();