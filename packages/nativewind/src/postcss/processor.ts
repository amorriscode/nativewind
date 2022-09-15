import { Plugin, PluginCreator } from "postcss";
import { AtRuleTuple, StyleError } from "../types/common";
import { outputWriter } from "./fs-writer";
import { toReactNative } from "./to-react-native";
import { AtomStyle, CreateOptions } from "../style-sheet";

const atRuleSymbol = Symbol("media");
const isForChildrenSymbol = Symbol("children");

declare module "postcss" {
  abstract class Container {
    [atRuleSymbol]: Map<string, string | undefined>;
    [isForChildrenSymbol]: boolean;
  }
}

interface DoneResult {
  result: CreateOptions;
  errors: StyleError[];
}

export interface PostcssPluginOptions {
  output?: string;
  done?: (result: DoneResult) => void;
}

export const plugin: PluginCreator<PostcssPluginOptions> = ({
  done,
  output,
} = {}) => {
  const createOptions: CreateOptions = {};
  const errors: StyleError[] = [];

  return {
    postcssPlugin: "nativewind-style-extractor",
    OnceExit: (root) => {
      root.walk((node) => {
        if (node.type === "atrule") {
          node[atRuleSymbol] ??= node?.parent?.[atRuleSymbol]
            ? new Map(node.parent[atRuleSymbol].entries())
            : new Map();

          if (node.name === "selector" && node.params.startsWith("(>")) {
            node[isForChildrenSymbol] = true;
          }

          const existingAtRule = node[atRuleSymbol].get(node.name);

          existingAtRule
            ? node[atRuleSymbol].set(
                node.name,
                `${existingAtRule} and ${node.params}`
              )
            : node[atRuleSymbol].set(node.name, node.params);
        } else if (node.type === "rule") {
          let nativeDeclarations: AtomStyle = {};

          // Get all the declarations
          node.walkDecls((decl) => {
            nativeDeclarations = {
              ...nativeDeclarations,
              ...toReactNative(decl, {
                onError: (error) => errors.push(error),
              }),
            };
          });

          for (const s of node.selectors) {
            const { selector, pseudoClasses, isForChildren, parent } =
              normalizeCssSelector(s);

            if (!createOptions[selector]) {
              createOptions[selector] = {
                styles: [],
              };
            }

            if (isForChildren) {
              const childClasses = new Set(createOptions[parent].childClasses);
              childClasses.add(selector);
              createOptions[parent].childClasses = [...childClasses];
            }

            const styleIndex = createOptions[selector].styles.length;
            createOptions[selector].styles.push(nativeDeclarations);

            const topics = new Set<string>(createOptions[selector].topics);

            const rules = node.parent?.[atRuleSymbol];

            if (rules) {
              const indexAtRules: Array<AtRuleTuple> = [...rules.entries()].map(
                ([key, value]) => {
                  switch (value) {
                    case "(prefers-color-scheme: dark)":
                      topics.add("colorScheme");
                      return ["colorScheme", "dark"];
                    case "(prefers-color-scheme: light)":
                      topics.add("colorScheme");
                      return ["colorScheme", "light"];
                    default:
                      if (value?.includes("width")) topics.add("width");
                      if (value?.includes("height")) topics.add("height");
                      if (value?.includes("aspect-ratio")) topics.add("window");
                      if (value?.includes("orientation"))
                        topics.add("orientation");

                      return [key, value];
                  }
                }
              );

              createOptions[selector].atRules = {
                ...createOptions[selector].atRules,
                [styleIndex]: indexAtRules,
              };
            }

            if (topics.size > 0) {
              createOptions[selector].topics = [...topics];
            }

            const conditions = new Set<string>(
              createOptions[selector].conditions
            );

            for (const pseudoClass of pseudoClasses) {
              if (isForChildren) {
                switch (pseudoClass) {
                  case "not-first-child":
                    conditions.add(pseudoClass);
                }
              } else {
                conditions.add(pseudoClass);
              }
            }

            if (conditions.size > 0) {
              createOptions[selector].conditions = [...conditions];
            }
          }
        }
      });

      if (done)
        done({
          result: createOptions,
          errors,
        });

      if (output) {
        outputWriter(output, createOptions);
      }
    },
  } as Plugin;
};

function normalizeCssSelector(s: string) {
  let lastSelector = s.trim().split(" ").pop() ?? "";

  const isForChildren = lastSelector.includes(".children.");

  if (isForChildren) {
    lastSelector = lastSelector.replace(/\.children/, "");
  }

  const prefixes = lastSelector.replace(/^\./, "").split(/\\:/); /// [.group-hover, stroke-white]
  prefixes.pop();
  const [selectorToken, ...pseudoClasses] = lastSelector // .group-hover\:stroke-white
    .replace(/^(.+\\:)|^\./, "")
    .split(":");

  let selector = [...prefixes, selectorToken].join(":");

  const parent = selector;

  if (isForChildren) {
    selector = `${selector}.children`;
  }

  return { selector, parent, pseudoClasses, prefixes, isForChildren };
}

plugin.postcss = true;

export default plugin;
