import postcss, { PluginCreator } from "postcss";
import calc from "postcss-calc";
import postcssColorFunctionalNotation from "postcss-color-functional-notation";

import nativewind, { PostcssPluginOptions } from "./processor";

import tailwind, { Config } from "tailwindcss";

import { CreateOptions } from "../style-sheet";

import { StyleError } from "../types/common";
import { serializer } from "./serialize";

export function extractStyles(
  tailwindConfig: Config,
  cssInput = "@tailwind components;@tailwind utilities;"
) {
  let errors: StyleError[] = [];

  let output: CreateOptions = {};

  const plugins = [
    tailwind(tailwindConfig as Config),
    ...getPlugins({
      done: ({ errors: resultErrors, result }) => {
        output = result;
        errors = resultErrors;
      },
    }),
  ];

  postcss(plugins).process(cssInput).css;

  return {
    raw: output,
    errors,
    styleSheetExpression: serializer(output),
  };
}

export function getPlugins(options?: PostcssPluginOptions) {
  return [
    postcssColorFunctionalNotation(),
    calc({
      warnWhenCannotResolve: true,
    }),
    nativewind(options),
  ];
}

const pluginPack: PluginCreator<PostcssPluginOptions> = (options) => {
  return postcss(getPlugins(options));
};

pluginPack.postcss = true;

export default pluginPack;
