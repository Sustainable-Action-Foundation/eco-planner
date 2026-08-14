/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison --
 * TSESTree types node.type as the AST_NODE_TYPES enum; comparing against its
 * literal string values is exact, and importing the enum would make the
 * transitive @typescript-eslint/utils dependency a runtime one. */
import type { Rule } from "eslint";
import type { TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";

/**
 * Checks that values passed to client components from server modules are
 * serializable across the React server→client boundary.
 *
 * Unlike Next's editor-only "props must be serializable" check — which fires on
 * every exported component in a `"use client"` file, even ones only ever
 * rendered from other client components — this rule checks the *call site*:
 * when a file without `"use client"` renders JSX whose component resolves to a
 * `"use client"` module, each prop's actual (narrowed) type must be
 * RSC-serializable. Client→client usage is never flagged, so callback props on
 * internal client components stay legal.
 *
 * Serializable: primitives (incl. bigint), plain objects/arrays of serializable
 * values, Date, Map, Set, typed arrays, Blob/File/FormData, Promises of
 * serializable values, and React elements. Functions are allowed only when the
 * expression is provably a server action: an inline function whose body starts
 * with `"use server"`, a reference to a declaration in a `"use server"` module
 * (or with such a body), or a `.bind(...)` on one.
 */

const DEPTH_LIMIT = 6;

// Named types the React flight serializer handles; only the generic containers
// among them need their type arguments checked too.
const AllowedRefs = new Set([
  "Date", "Map", "Set", "ReadonlyMap", "ReadonlySet", "Promise", "PromiseLike",
  "ArrayBuffer", "SharedArrayBuffer", "DataView", "Blob", "File", "FormData",
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
]);
const RecurseRefs = new Set(["Map", "Set", "ReadonlyMap", "ReadonlySet", "Promise", "PromiseLike"]);
// React elements serialize as rendered output; never recurse into their innards.
const ReactRefs = new Set(["ReactNode", "ReactElement", "ReactPortal"]);

// Types the rule cannot or should not judge: any/unknown (the no-unsafe-* rules
// own those), type parameters, `object`, and every serializable primitive.
const OkFlags = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never
  | ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Null
  | ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike
  | ts.TypeFlags.BigIntLike | ts.TypeFlags.EnumLike | ts.TypeFlags.Index
  | ts.TypeFlags.TypeParameter | ts.TypeFlags.NonPrimitive;

type Options = { allowTypes?: string[] };

type Services = {
  program?: ts.Program;
  esTreeNodeToTSNodeMap?: { get(node: TSESTree.Node): ts.Node | undefined };
};

type Context = {
  options: [Options?];
  sourceCode: { parserServices?: Services };
  report(descriptor: { node: TSESTree.Node; messageId: string; data?: Record<string, string> }): void;
};

type Problem = { path: string; reason: string };

function fileHasDirective(file: ts.SourceFile, directive: string): boolean {
  for (const stmt of file.statements) {
    if (!ts.isExpressionStatement(stmt) || !ts.isStringLiteral(stmt.expression)) break;
    if (stmt.expression.text === directive) return true;
  }
  return false;
}

function bodyHasUseServer(body: ts.ConciseBody | undefined): boolean {
  if (!body || !ts.isBlock(body)) return false;
  const first = body.statements[0];
  return first !== undefined && ts.isExpressionStatement(first)
    && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
}

function resolveSymbol(symbol: ts.Symbol | undefined, checker: ts.TypeChecker): ts.Symbol | undefined {
  return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

function isServerAction(expr: ts.Expression, checker: ts.TypeChecker): boolean {
  if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
    return bodyHasUseServer(expr.body);
  }
  // `action.bind(null, ...)` — React serializes bound server actions.
  if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression)
    && expr.expression.name.text === "bind") {
    return isServerAction(expr.expression.expression, checker);
  }
  const symbol = resolveSymbol(checker.getSymbolAtLocation(expr), checker);
  for (const decl of symbol?.declarations ?? []) {
    if (fileHasDirective(decl.getSourceFile(), "use server")) return true;
    if (ts.isFunctionDeclaration(decl) && bodyHasUseServer(decl.body)) return true;
    if (ts.isVariableDeclaration(decl) && decl.initializer !== undefined
      && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
      && bodyHasUseServer(decl.initializer.body)) return true;
  }
  return false;
}

type Walk = {
  checker: ts.TypeChecker;
  program: ts.Program;
  seen: Set<ts.Type>;
  allowTypes: Set<string>;
  problems: Problem[];
};

// Members inherited from the default lib (Array.prototype, Object.prototype,
// Symbol.iterator, ...) are implementation surface, not data being passed —
// e.g. Prisma's JsonArray is an interface extending Array, so its methods show
// up as regular properties here.
function isDefaultLibMember(prop: ts.Symbol, walk: Walk): boolean {
  const declarations = prop.declarations ?? [];
  return declarations.length > 0
    && declarations.every((decl) => walk.program.isSourceFileDefaultLibrary(decl.getSourceFile()));
}

function collectProblems(type: ts.Type, path: string, depth: number, walk: Walk): void {
  if (depth > DEPTH_LIMIT || walk.seen.has(type)) return;
  walk.seen.add(type);
  const { checker } = walk;

  if ((type.flags & ts.TypeFlags.ESSymbolLike) !== 0) {
    walk.problems.push({ path, reason: "a symbol" });
    return;
  }
  if ((type.flags & OkFlags) !== 0) return;

  if (type.isUnionOrIntersection()) {
    for (const member of type.types) collectProblems(member, path, depth, walk);
    return;
  }

  const name = type.aliasSymbol?.name ?? type.getSymbol()?.name;
  if (name !== undefined) {
    if (ReactRefs.has(name) || walk.allowTypes.has(name)) return;
    if (AllowedRefs.has(name)) {
      if (RecurseRefs.has(name)) {
        for (const arg of checker.getTypeArguments(type as ts.TypeReference)) {
          collectProblems(arg, `${path}<>`, depth + 1, walk);
        }
      }
      return;
    }
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    for (const arg of checker.getTypeArguments(type as ts.TypeReference)) {
      collectProblems(arg, `${path}[]`, depth + 1, walk);
    }
    return;
  }

  if (type.getCallSignatures().length > 0 || type.getConstructSignatures().length > 0) {
    walk.problems.push({ path, reason: "a function" });
    return;
  }

  const symbol = type.getSymbol();
  if (symbol !== undefined && (symbol.flags & ts.SymbolFlags.Class) !== 0) {
    walk.problems.push({ path, reason: `an instance of class \`${symbol.name}\`` });
    return;
  }

  for (const prop of checker.getPropertiesOfType(type)) {
    if (isDefaultLibMember(prop, walk)) continue;
    collectProblems(checker.getTypeOfSymbol(prop), `${path}.${prop.name}`, depth + 1, walk);
  }
  for (const index of checker.getIndexInfosOfType(type)) {
    collectProblems(index.type, `${path}[]`, depth + 1, walk);
  }
}

function create(ruleContext: unknown) {
  const context = ruleContext as Context;
  const services = context.sourceCode.parserServices;
  if (!services?.program || !services.esTreeNodeToTSNodeMap) return {};
  // Rebound so the narrowing survives into the hoisted helper functions below.
  const program: ts.Program = services.program;
  const nodeMap = services.esTreeNodeToTSNodeMap;
  const checker = program.getTypeChecker();
  const allowTypes = new Set(context.options[0]?.allowTypes ?? []);

  let skipFile = false;

  function isClientComponent(nameNode: TSESTree.Node): boolean {
    const tsName = nodeMap?.get(nameNode);
    if (tsName === undefined) return false;
    const symbol = resolveSymbol(checker.getSymbolAtLocation(tsName), checker);
    const file = symbol?.declarations?.[0]?.getSourceFile();
    // node_modules declarations are .d.ts files, which never carry the
    // directive of their implementation — those components can't be judged.
    if (!file || file.fileName.includes("node_modules")) return false;
    return fileHasDirective(file, "use client");
  }

  function checkValue(tsExpr: ts.Expression, path: string, component: string, reportNode: TSESTree.Node): void {
    if (isServerAction(tsExpr, checker)) return;
    const problems: Problem[] = [];
    collectProblems(checker.getTypeAtLocation(tsExpr), path, 0, { checker, program, seen: new Set(), allowTypes, problems });
    for (const problem of problems) {
      context.report({
        node: reportNode,
        messageId: "nonSerializable",
        data: { path: problem.path, component, reason: problem.reason },
      });
    }
  }

  return {
    Program(programNode: unknown) {
      const program_ = programNode as TSESTree.Program;
      // In a client module every JSX call site is client→client; nothing to check.
      skipFile = program_.body.some((stmt) =>
        stmt.type === "ExpressionStatement" && "directive" in stmt && stmt.directive === "use client");
    },
    JSXOpeningElement(elementNode: unknown) {
      if (skipFile) return;
      const element = elementNode as TSESTree.JSXOpeningElement;
      // Intrinsic elements (<div>) resolve into react's d.ts; skip them cheaply.
      if (element.name.type === "JSXIdentifier" && /^[a-z]/.test(element.name.name)) return;
      if (!isClientComponent(element.name)) return;
      // Report under the name used at the call site, not the (often `default`) export symbol.
      const component = element.name.type === "JSXIdentifier" ? element.name.name
        : element.name.type === "JSXMemberExpression" && element.name.property.type === "JSXIdentifier" ? element.name.property.name
          : "component";

      for (const attr of element.attributes) {
        if (attr.type === "JSXAttribute") {
          if (attr.value === null || attr.value.type === "Literal") continue;
          if (attr.value.type !== "JSXExpressionContainer" || attr.value.expression.type === "JSXEmptyExpression") continue;
          const tsExpr = nodeMap.get(attr.value.expression);
          if (tsExpr === undefined) continue;
          const name = attr.name.type === "JSXIdentifier" ? attr.name.name : `${attr.name.namespace.name}:${attr.name.name.name}`;
          checkValue(tsExpr as ts.Expression, name, component, attr);
        } else {
          const tsExpr = nodeMap.get(attr.argument);
          if (tsExpr === undefined) continue;
          checkValue(tsExpr as ts.Expression, "(spread)", component, attr);
        }
      }
    },
  };
}

export const serializableBoundaryProps = {
  meta: {
    type: "problem",
    docs: {
      description: "Values passed from server modules to client components must be serializable across the React server→client boundary (or be server actions).",
    },
    schema: [{
      type: "object",
      properties: {
        allowTypes: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    }],
    messages: {
      nonSerializable: "`{{path}}` passed to client component `<{{component}}>` is {{reason}}, which cannot cross the server→client boundary. Pass serializable data, or a server action for callbacks.",
    },
  },
  create,
} as unknown as Rule.RuleModule;
