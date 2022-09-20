import { resolve, sep, posix, join } from "node:path";
import { statSync, mkdirSync } from "node:fs";

import type { ConfigAPI, NodePath, PluginPass, Visitor } from "@babel/core";
import { addNamed } from "@babel/helper-module-imports";
import {
  Expression,
  identifier,
  isJSXAttribute,
  isJSXIdentifier,
  isJSXMemberExpression,
  isJSXSpreadAttribute,
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

import { getImportBlockedComponents } from "./get-import-blocked-components";
import { extractStyles } from "../postcss";
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

  const allowModuleTransform = Array.isArray(options.allowModuleTransform)
    ? ["react-native", "react-native-web", ...options.allowModuleTransform]
    : "*";

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

  if (canCompile) {
    const outputDirectory = resolve(
      process.cwd(),
      "node_modules/.cache/nativewind"
    );
    mkdirSync(outputDirectory, { recursive: true });
    outputWriter(
      join(outputDirectory, "styles.js"),
      extractStyles(tailwindConfig)
    );
  }

  if (!canTransform) {
    return;
  }

  const programVisitor: Visitor<
    PluginPass & {
      opts: TailwindcssReactNativeBabelOptions;
    }
  > = {
    Program: {
      enter(projectPath, state) {
        const filename = state.filename;
        if (!filename) return;

        const isInContent = micromatch.isMatch(
          normalizePath(filename),
          contentFilePaths
        );

        if (!isInContent) {
          return;
        }

        projectPath.traverse(visitor, {
          ...state,
          canCompile,
          canTransform,
          filename,
          allowModuleTransform,
          allowRelativeModules: contentFilePaths,
          blockList: new Set<string>(),
          tailwindConfig: tailwindConfig,
        });
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

const visitor: Visitor<VisitorState> = {
  ImportDeclaration(path, state) {
    for (const component of getImportBlockedComponents(path, state)) {
      state.blockList.add(component);
    }
  },
  JSXElement: {
    exit: (path, state) => {
      const { blockList, canTransform } = state;

      if (
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

      addNamed(path, "StyledComponent", "nativewind");
    },
  },
};

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
