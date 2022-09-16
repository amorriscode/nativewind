import postcss from "postcss";
import calc from "postcss-calc";
import postcssColorFunctionalNotation from "postcss-color-functional-notation";
import { walk, parse } from "css-tree";

import tailwind, { Config } from "tailwindcss";

import { CreateOptions } from "../style-sheet";

import { serializer } from "./serialize";
import { toCreateOptions } from "./to-create-options";

export function extractStyles(
  tailwindConfig: Config,
  cssInput = "@tailwind components;@tailwind utilities;"
) {
  let createOptions: CreateOptions = {};

  const tailwindOutput = postcss([
    tailwind(tailwindConfig),
    postcssColorFunctionalNotation(),
    calc({
      warnWhenCannotResolve: true,
    }),
  ]).process(cssInput).css;

  walk(parse(tailwindOutput), (node) => {
    createOptions = {
      ...createOptions,
      ...toCreateOptions(node),
    };
  });

  return {
    raw: createOptions,
    styleSheetExpression: serializer(createOptions),
  };
}
