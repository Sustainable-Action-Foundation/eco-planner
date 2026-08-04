/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison --
 * TSESTree types node.type as the AST_NODE_TYPES enum; comparing against its
 * literal string values is exact, and importing the enum would make the
 * transitive @typescript-eslint/utils dependency a runtime one. */
import type { Rule } from "eslint";
import type { TSESTree } from "@typescript-eslint/utils";

/**
 * Enforces the repo's enum-ish const convention:
 *
 *   export const GraphType = {
 *     Main: "MAIN",
 *   } as const;
 *   export type GraphType = (typeof GraphType)[keyof typeof GraphType];
 *
 * A top-level const object counts as enum-ish when it has a same-named type
 * alias of the `(typeof X)[keyof typeof X]` shape, or when it is a PascalCase
 * `as const` object whose values already all look like enum values. Anything
 * else (label maps, config objects) is ignored, so the rule only ever asks for
 * the missing parts of a convention the object has visibly opted into.
 *
 * Values may be UPPER_SNAKE string literals, kebab-case string literals (for
 * values that end up in the DOM), `""` (the none/default sentinel), or member
 * references to other enum-ish values (e.g. `AccessLevel.RO`).
 */

const PascalName = /^[A-Z][A-Za-z0-9]*$/;
const UpperSnake = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const KebabCase = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

type Options = { ignore?: string[]; ignoreValueCasing?: string[] };

// Facade over eslint's RuleContext so the rule body can stay in TSESTree land;
// eslint's own types only know the estree nodes.
type Context = {
  options: [Options?];
  report(descriptor: {
    node: TSESTree.Node;
    messageId: string;
    data?: Record<string, string>;
    fix?: (fixer: { insertTextAfter(node: TSESTree.Node, text: string): unknown }) => unknown;
  }): void;
};

function isPascal(name: string): boolean {
  // Multi-char all-caps ("ID", "MAIN") is indistinguishable from UPPER_SNAKE, so require a lowercase letter.
  return PascalName.test(name) && (name.length === 1 || /[a-z]/.test(name));
}

function isEnumShape(alias: TSESTree.TSTypeAliasDeclaration, name: string): boolean {
  const t = alias.typeAnnotation;
  return t.type === "TSIndexedAccessType"
    && t.objectType.type === "TSTypeQuery"
    && t.objectType.exprName.type === "Identifier"
    && t.objectType.exprName.name === name
    && t.indexType.type === "TSTypeOperator"
    && t.indexType.operator === "keyof"
    && t.indexType.typeAnnotation?.type === "TSTypeQuery"
    && t.indexType.typeAnnotation.exprName.type === "Identifier"
    && t.indexType.typeAnnotation.exprName.name === name;
}

function isEnumValue(value: TSESTree.Property["value"]): boolean {
  if (value.type === "MemberExpression") return true;
  return value.type === "Literal" && typeof value.value === "string"
    && (value.value === "" || UpperSnake.test(value.value) || KebabCase.test(value.value));
}

function looksLikeEnum(object: TSESTree.ObjectExpression): boolean {
  return object.properties.length > 0
    && object.properties.every((p) => p.type === "Property" && isEnumValue(p.value));
}

function create(ruleContext: unknown) {
  const context = ruleContext as Context;
  const ignore = new Set(context.options[0]?.ignore ?? []);
  const ignoreValueCasing = new Set(context.options[0]?.ignoreValueCasing ?? []);

  // All reports for a const are anchored on its name, so one
  // `eslint-disable-next-line` above the declaration silences the whole object.
  function checkProperties(name: string, object: TSESTree.ObjectExpression, reportNode: TSESTree.Node): void {
    const badKeys: string[] = [];
    const badValues: string[] = [];
    const nonLiteralKeys: string[] = [];
    let hasSpread = false;
    for (const prop of object.properties) {
      if (prop.type !== "Property") {
        hasSpread = true;
        continue;
      }
      const key = !prop.computed && prop.key.type === "Identifier" ? prop.key.name
        : prop.key.type === "Literal" && typeof prop.key.value === "string" ? prop.key.value
          : null;
      if (key === null || !isPascal(key)) {
        badKeys.push(key ?? "(computed)");
      }
      const value = prop.value;
      if (value.type === "Literal" && typeof value.value === "string") {
        if (!ignoreValueCasing.has(name) && value.value !== ""
          && !UpperSnake.test(value.value) && !KebabCase.test(value.value)) {
          badValues.push(JSON.stringify(value.value));
        }
      } else if (value.type !== "MemberExpression") {
        nonLiteralKeys.push(key ?? "(computed)");
      }
    }
    if (hasSpread) context.report({ node: reportNode, messageId: "noSpread", data: { name } });
    if (badKeys.length > 0) context.report({ node: reportNode, messageId: "badKey", data: { name, keys: badKeys.join(", ") } });
    if (badValues.length > 0) context.report({ node: reportNode, messageId: "badValue", data: { name, values: badValues.join(", ") } });
    if (nonLiteralKeys.length > 0) context.report({ node: reportNode, messageId: "nonLiteralValue", data: { name, keys: nonLiteralKeys.join(", ") } });
  }

  return {
    Program(programNode: unknown) {
      const program = programNode as TSESTree.Program;

      const aliases = new Map<string, { alias: TSESTree.TSTypeAliasDeclaration; exported: boolean }>();
      for (const stmt of program.body) {
        if (stmt.type === "TSTypeAliasDeclaration") {
          aliases.set(stmt.id.name, { alias: stmt, exported: false });
        } else if (stmt.type === "ExportNamedDeclaration" && stmt.declaration?.type === "TSTypeAliasDeclaration") {
          aliases.set(stmt.declaration.id.name, { alias: stmt.declaration, exported: true });
        }
      }

      for (const stmt of program.body) {
        const exported = stmt.type === "ExportNamedDeclaration";
        const decl = exported ? stmt.declaration : stmt;
        if (decl?.type !== "VariableDeclaration" || decl.kind !== "const") continue;

        for (const declarator of decl.declarations) {
          if (declarator.id.type !== "Identifier" || !declarator.init) continue;
          const name = declarator.id.name;
          if (ignore.has(name)) continue;
          const init = declarator.init;

          let object: TSESTree.ObjectExpression;
          let asConst = false;
          if (init.type === "TSAsExpression"
            && init.typeAnnotation.type === "TSTypeReference"
            && init.typeAnnotation.typeName.type === "Identifier"
            && init.typeAnnotation.typeName.name === "const"
            && init.expression.type === "ObjectExpression") {
            object = init.expression;
            asConst = true;
          } else if (init.type === "ObjectExpression") {
            object = init;
          } else continue;

          const paired = aliases.get(name);
          const pairedIsEnumShape = paired !== undefined && isEnumShape(paired.alias, name);
          const enumish = pairedIsEnumShape || (asConst && isPascal(name) && looksLikeEnum(object));
          if (!enumish) continue;

          if (!asConst) {
            context.report({ node: declarator.id, messageId: "missingAsConst", data: { name } });
          }
          if (!isPascal(name)) {
            context.report({ node: declarator.id, messageId: "badName", data: { name } });
          }
          checkProperties(name, object, declarator.id);

          const keyword = exported ? "export type" : "type";
          const expected = `${keyword} ${name} = (typeof ${name})[keyof typeof ${name}];`;
          if (!paired) {
            context.report({
              node: declarator.id,
              messageId: "missingType",
              data: { name, expected },
              fix: (fixer) => fixer.insertTextAfter(stmt, `\n${expected}`),
            });
          } else if (!pairedIsEnumShape) {
            context.report({ node: paired.alias, messageId: "badTypeShape", data: { name, expected } });
          } else if (paired.exported !== exported) {
            context.report({ node: paired.exported ? declarator.id : paired.alias.id, messageId: "exportMismatch", data: { name } });
          }
        }
      }
    },
  };
}

export const enumStyle = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce the enum-ish const convention: PascalCase const and keys, UPPER_SNAKE string values, and a same-named `(typeof X)[keyof typeof X]` type alias next to the const.",
    },
    fixable: "code",
    schema: [{
      type: "object",
      properties: {
        ignore: { type: "array", items: { type: "string" } },
        ignoreValueCasing: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    }],
    messages: {
      badName: "Enum-ish const `{{name}}` must be PascalCase.",
      badKey: "Enum-ish const `{{name}}` has non-PascalCase keys: {{keys}}.",
      badValue: "Enum-ish const `{{name}}` has values that are neither UPPER_SNAKE nor kebab-case: {{values}}.",
      nonLiteralValue: "Enum-ish const `{{name}}` has values that are neither string literals nor references to other enum-ish values: {{keys}}.",
      missingAsConst: "Enum-ish const `{{name}}` must be declared `as const`.",
      missingType: "Enum-ish const `{{name}}` needs its type alias next to it: `{{expected}}`.",
      badTypeShape: "The type alias paired with enum-ish const `{{name}}` must be `{{expected}}`.",
      exportMismatch: "`{{name}}`'s const and type must both be exported, or both be local.",
      noSpread: "Enum-ish const `{{name}}` must not contain spread elements.",
    },
  },
  create,
} as unknown as Rule.RuleModule;
