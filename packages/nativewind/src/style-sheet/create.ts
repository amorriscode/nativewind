import { StyleSheet } from "react-native";
import { Style } from "../types/common";
import { createAtRuleSelector, matchesMask } from "../utils/selector";
import {
  atomTopics,
  atRules,
  childClasses,
  masks,
  styles,
  topics,
  transforms,
  units,
} from "./internals";
import { matchAtRule } from "./match-at-rule";
import {
  store,
  preprocessed as preprocessedSymbol,
  topicValues,
} from "./store";

export function create(options: {
  styles?: Record<string, Style>;
  atRules?: Record<string, Array<Array<[string, string | undefined]>>>;
  masks?: Record<string, number>;
  topics?: Record<string, string[]>;
  childClasses?: Record<string, string[]>;
  units?: Record<string, Record<string, string>>;
  transforms?: Record<string, true>;
}) {
  const preprocessed = store.getState()[preprocessedSymbol];

  if (preprocessed) {
    return;
  } else {
    if (options.atRules) {
      for (const entry of Object.entries(options.atRules)) {
        atRules.set(...entry);
      }
    }

    if (options.childClasses) {
      for (const entry of Object.entries(options.childClasses)) {
        childClasses.set(...entry);
      }
    }

    if (options.masks) {
      for (const entry of Object.entries(options.masks)) {
        masks.set(...entry);
      }
    }

    if (options.topics) {
      for (const entry of Object.entries(options.topics)) {
        topics.set(...entry);
      }
    }

    if (options.units) {
      for (const entry of Object.entries(options.units)) {
        units.set(...entry);
      }
    }

    if (options.transforms) {
      for (const [key, value] of Object.entries(options.transforms)) {
        if (value) {
          transforms.add(key);
        }
      }
    }

    if (options.styles) {
      const newStyles = {};
      for (const [atom, value] of Object.entries(
        StyleSheet.create(options.styles)
      )) {
        styles.set(atom, value);

        const styleTopics = topics.get(atom);

        if (styleTopics) {
          let subscriptions = atomTopics.get(atom);
          if (!subscriptions) {
            subscriptions = new Set<string>();
            atomTopics.set(atom, subscriptions);
          }

          for (const topic of styleTopics) {
            if (!subscriptions.has(topic)) {
              store.subscribe(
                (state) => state[topicValues][topic],
                () => store.setState(evaluate(atom))
              );

              subscriptions.add(topic);
            }
          }
        }

        Object.assign(newStyles, evaluate(atom));
      }

      store.setState(newStyles);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unitRecord: Record<string, (...options: any[]) => any> = {};

function evaluate(atom: string) {
  const state = store.getState();
  const mask = masks.get(atom) || 0;

  if (!matchesMask(0, mask)) {
    return {};
  }

  const atomStyle = styles.get(atom) ?? {};

  const unitMap = units.get(atom);
  if (unitMap) {
    for (const [key, unit] of Object.entries(unitMap)) {
      atomStyle[key as keyof Style] = unitRecord[unit](
        atomStyle[key as keyof Style],
        state
      );
    }
  }

  const atRulesTuple = atRules.get(atom);

  if (!atRulesTuple || atRulesTuple.length === 0) {
    return { [atom]: atomStyle };
  }

  const newStyles = [atomStyle];

  for (const [index, atRules] of atRulesTuple.entries()) {
    const atRulesResult = atRules.every(([rule, params]) => {
      if (rule === "selector") {
        // These atRules shouldn't be on the atomic styles, they only
        // apply to childStyles
        return false;
      }

      return matchAtRule({
        rule,
        params,
        width: state[topicValues].width as number,
        height: state[topicValues].height as number,
        orientation: state[topicValues].orientation as OrientationLockType,
      });
    });

    if (!atRulesResult) {
      continue;
    }

    newStyles.push(styles.get(createAtRuleSelector(atom, index)) ?? {});
  }

  return { [atom]: newStyles };
}
