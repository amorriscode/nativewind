import {
  arrayExpression,
  booleanLiteral,
  callExpression,
  Expression,
  identifier,
  isExpression,
  memberExpression,
  nullLiteral,
  numericLiteral,
  objectExpression,
  objectProperty,
  stringLiteral,
  unaryExpression,
} from "@babel/types";
import { CreateOptions } from "../style-sheet";

export function serializer(options: CreateOptions) {
  return callExpression(
    memberExpression(identifier("_NativeWindStyleSheet"), identifier("create")),
    [babelSerializeLiteral(options)]
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function babelSerializeLiteral(literal: any): Expression {
  if (literal === null) {
    return nullLiteral();
  }

  if (isExpression(literal)) {
    return literal;
  }

  switch (typeof literal) {
    case "number":
      return numericLiteral(literal);
    case "string":
      if (isRuntimeFunction(literal)) {
        const { name, args } = JSON.parse(literal.slice(2)) as {
          name: string;
          args: unknown[];
        };

        return callExpression(
          memberExpression(
            identifier("_NativeWindStyleSheet"),
            identifier(name)
          ),
          args.map((argument) => babelSerializeLiteral(argument))
        );
      } else {
        return stringLiteral(literal);
      }
    case "boolean":
      return booleanLiteral(literal);
    case "undefined":
      return unaryExpression("void", numericLiteral(0), true);
    default:
      if (Array.isArray(literal)) {
        return arrayExpression(literal.map((n) => babelSerializeLiteral(n)));
      }

      if (isObject(literal)) {
        return objectExpression(
          Object.keys(literal)
            .filter((k) => {
              return typeof literal[k] !== "undefined";
            })
            .map((k) => {
              return objectProperty(
                stringLiteral(k),
                babelSerializeLiteral(literal[k])
              );
            })
        );
      }

      throw new Error("un-serializable literal");
  }
}

function isObject(literal: unknown): literal is Record<string, unknown> {
  return typeof literal === "object";
}

export function isRuntimeFunction(input: unknown): input is string {
  return typeof input === "string" && input.startsWith("__{");
}
