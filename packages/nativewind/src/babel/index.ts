import { resolve, sep, posix, join, dirname, relative } from "node:path";
import { statSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import type { ConfigAPI, NodePath, PluginPass, Visitor } from "@babel/core";
import { addNamed, addSideEffect } from "@babel/helper-module-imports";
import {
  Expression,
  identifier,
  isJSXAttribute,
  isJSXIdentifier,
  isJSXMemberExpression,
  isJSXSpreadAttribute,
  isStringLiteral,
  jSXAttribute,
  jsxClosingElement,
  jsxElement,
  JSXElement,
  jsxExpressionContainer,
  jsxIdentifier,
  jSXIdentifier,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  jsxOpeningElement,
  JSXOpeningElement,
  memberExpression,
} from "@babel/types";

import micromatch from "micromatch";
import type { Config } from "tailwindcss";
import resolveConfigPath from "tailwindcss/lib/util/resolveConfigPath";
import resolveConfig from "tailwindcss/resolveConfig";
import { validateConfig } from "tailwindcss/lib/util/validateConfig";

// import { getImportBlockedComponents } from "./get-import-blocked-components";
import { extractStyles } from "../postcss/extract";
import { outputWriter } from "./fs-writer";

export interface TailwindcssReactNativeBabelOptions {
  allowModuleTransform?: "*" | string[];
  blockModuleTransform?: string[];
  mode?: "compileAndTransform" | "compileOnly" | "transformOnly";
  rem?: number;
  tailwindConfigPath?: string;
  tailwindConfig?: Config | undefined;
}

export default function (
  api: ConfigAPI,
  options: TailwindcssReactNativeBabelOptions,
  cwd: string
) {
  /**
   * Get the users config
   */
  const userConfigPath = resolveConfigPath(
    options.tailwindConfig || options.tailwindConfigPath
  );

  let tailwindConfig: Config;

  if (userConfigPath === null) {
    tailwindConfig = resolveConfig(options.tailwindConfig);
  } else {
    api.cache.using(() => statSync(userConfigPath).mtimeMs);

    // eslint-disable-next-line @typescript-eslint/no-var-requires,unicorn/prefer-module
    delete require.cache[require.resolve(userConfigPath)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires,unicorn/prefer-module
    const userConfig = require(userConfigPath);

    const newConfig = resolveConfig(userConfig);

    tailwindConfig = validateConfig(newConfig);
  }

  /**
   * Resolve their content paths
   */
  const contentFilePaths = (
    Array.isArray(tailwindConfig.content)
      ? tailwindConfig.content.filter(
          (filePath): filePath is string => typeof filePath === "string"
        )
      : tailwindConfig.content.files.filter(
          (filePath): filePath is string => typeof filePath === "string"
        )
  ).map((contentFilePath) => normalizePath(resolve(cwd, contentFilePath)));

  // const allowModuleTransform = Array.isArray(options.allowModuleTransform)
  //   ? ["react-native", "react-native-web", ...options.allowModuleTransform]
  //   : "*";

  let canCompile = true;
  let canTransform = true;

  switch (options.mode) {
    case "compileOnly": {
      canTransform = false;
      break;
    }
    case "transformOnly": {
      canCompile = false;
      break;
    }
  }

  const outputDirectory = resolve(
    // We could use nativewind here, but it breaks the tests
    // as nativewind doesn't exists in our node_modules!
    require.resolve("tailwindcss/package.json"),
    "../../.cache/nativewind"
  );
  if (canCompile) {
    mkdirSync(outputDirectory, { recursive: true });
  }

  const blockedComponents = new Map<string, Set<string>>();
  const didTransform = new Set<string>();

  const programVisitor: Visitor<
    PluginPass & {
      opts: TailwindcssReactNativeBabelOptions;
    }
  > = {
    Program: {
      enter(path, state) {
        const filename = state.filename;
        if (!filename) return;

        if (canCompile) {
          path.traverse({
            ImportDeclaration(path) {
              const currentDirectory = dirname(filename);
              const source = resolve(currentDirectory, path.node.source.value);
              return compileCSS(
                path,
                source,
                currentDirectory,
                outputDirectory,
                tailwindConfig
              );
            },
            CallExpression(path) {
              if (
                !("name" in path.node.callee) ||
                path.node.callee.name !== "require"
              ) {
                return;
              }

              const argument = path.node.arguments[0];

              if (!isStringLiteral(argument)) {
                return;
              }

              const currentDirectory = dirname(filename);
              const source = resolve(currentDirectory, argument.value);

              return compileCSS(
                path,
                source,
                currentDirectory,
                outputDirectory,
                tailwindConfig
              );
            },
          });
        }

        const isInContent = micromatch.isMatch(
          normalizePath(filename),
          contentFilePaths
        );

        if (!isInContent) {
          path.skip();
        }

        blockedComponents.set(filename, new Set());
      },
      exit(path, state) {
        if (state.filename && didTransform.has(state.filename)) {
          addNamed(path, "StyledComponent", "nativewind");
        }
      },
    },
    // ImportDeclaration(path, state) {
    // for (const component of getImportBlockedComponents(path, state)) {
    //   state.blockList.add(component);
    // }
    // },
    JSXElement: {
      exit: (path, state) => {
        if (!state.filename) return;

        const blockList = blockedComponents.get(state.filename);

        if (
          !blockList ||
          isWrapper(path.node) ||
          !canTransform ||
          !someAttributes(path, ["className", "tw"])
        ) {
          return;
        }

        const name = getElementName(path.node.openingElement);

        if (blockList.has(name) || name[0] !== name[0].toUpperCase()) {
          return;
        }

        path.replaceWith(
          jsxElement(
            jsxOpeningElement(jsxIdentifier("_StyledComponent"), [
              ...path.node.openingElement.attributes,
              jSXAttribute(
                jSXIdentifier("component"),
                jsxExpressionContainer(
                  toExpression(path.node.openingElement.name)
                )
              ),
            ]),
            jsxClosingElement(jsxIdentifier("_StyledComponent")),
            path.node.children
          )
        );

        didTransform.add(state.filename);
      },
    },
  };

  return {
    visitor: programVisitor,
  };
}

export interface VisitorState extends PluginPass {
  opts: TailwindcssReactNativeBabelOptions;
  filename: string;
  allowModuleTransform: "*" | string[];
  allowRelativeModules: "*" | string[];
  blockList: Set<string>;
}

function normalizePath(filePath: string) {
  /**
   * This is my naive way to get path matching working on Windows.
   * Basically I turn it into a posix path which seems to work fine
   *
   * If you are a windows user and understand micromatch, can you please send a PR
   * to do this the proper way
   */
  return filePath.split(sep).join(posix.sep);
}

function isWrapper(node: JSXElement) {
  const nameNode = node.openingElement.name;
  if (isJSXIdentifier(nameNode)) {
    return (
      nameNode.name === "_StyledComponent" ||
      nameNode.name === "StyledComponent"
    );
  } else if (isJSXMemberExpression(nameNode)) {
    return (
      nameNode.property.name === "_StyledComponent" ||
      nameNode.property.name === "StyledComponent"
    );
  } else {
    return false;
  }
}

function getElementName({ name }: JSXOpeningElement): string {
  if (isJSXIdentifier(name)) {
    return name.name;
  } else if (isJSXMemberExpression(name)) {
    return name.property.name;
  } else {
    // https://github.com/facebook/jsx/issues/13#issuecomment-54373080
    throw new Error("JSXNamespacedName is not supported by React JSX");
  }
}

function toExpression(
  node: JSXIdentifier | JSXMemberExpression | JSXNamespacedName
): Expression {
  if (isJSXIdentifier(node)) {
    return identifier(node.name);
  } else if (isJSXMemberExpression(node)) {
    return memberExpression(
      toExpression(node.object),
      toExpression(node.property)
    );
  } else {
    // https://github.com/facebook/jsx/issues/13#issuecomment-54373080
    throw new Error("JSXNamespacedName is not supported by React JSX");
  }
}

function compileCSS(
  path: NodePath,
  source: string,
  currentDirectory: string,
  outputDirectory: string,
  tailwindConfig: Config
) {
  if (!source.endsWith(".css")) {
    return;
  }

  if (!existsSync(source)) return;

  const css = readFileSync(source, "utf8");

  path.remove();
  const hash = createHash("md5").update(css).digest("hex");
  const outputFile = join(outputDirectory, `${hash}.js`);
  outputWriter(outputFile, extractStyles(tailwindConfig, css));
  addSideEffect(path, relative(currentDirectory, outputFile));
}

function someAttributes(path: NodePath<JSXElement>, names: string[]) {
  return path.node.openingElement.attributes.some((attribute) => {
    /**
     * I think we should be able to process spread attributes
     * by checking their binding, but I still learning how this works
     *
     * If your reading this and understand Babel bindings please send a PR
     */
    if (isJSXSpreadAttribute(attribute)) {
      return false;
    }

    return names.some((name) => {
      return (
        isJSXAttribute(attribute) && isJSXIdentifier(attribute.name, { name })
      );
    });
  });
}
