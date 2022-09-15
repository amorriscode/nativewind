import {
  Appearance,
  ColorSchemeName,
  Dimensions,
  EmitterSubscription,
  Platform,
  PlatformOSType,
  StyleSheet,
} from "react-native";
import { match } from "css-mediaquery";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

import { AtRuleTuple, Style } from "../types/common";
import themeFunctions from "./theme-functions";

type Listener<T> = (state: T, oldState: T) => void;

export type AtomStyle =
  | Style
  | {
      [T: string]: { unit: string; value: string | number };
    };

export interface Atom {
  styles: AtomStyle[];
  atRules?: Record<number, Array<AtRuleTuple>>;
  conditions?: string[];
  topics?: string[];
  topicSubscription?: () => void;
  childClasses?: string[];
  units?: Record<string, string>;
  transforms?: Record<string, true>;
  context?: Record<string, true>;
}

const createSetter =
  <T extends Record<string, unknown | undefined>>(
    getRecord: () => T,
    setRecord: (newDate: T) => void,
    listeners: Set<Listener<T>>
  ) =>
  (partialRecord: T | ((value: T) => T)) => {
    const oldRecord = { ...getRecord() };
    setRecord(
      typeof partialRecord === "function"
        ? partialRecord(oldRecord)
        : partialRecord
    );

    for (const listener of listeners) listener(getRecord(), oldRecord);
  };

const createSubscriber =
  <T>(listeners: Set<Listener<T>>) =>
  (listener: Listener<T>) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

const atoms: Map<string, Atom> = new Map();
const childClassNames: Map<string, string[]> = new Map();

let styleSets: Record<string, Style[]> = {};
const styleSetsListeners = new Set<Listener<typeof styleSets>>();
const setStyleSets = createSetter(
  () => styleSets,
  (data) => {
    styleSets = { ...styleSets, ...data };
  },
  styleSetsListeners
);
const subscribeToStyleSets = createSubscriber(styleSetsListeners);

let styles: Record<string, Style[] | undefined> = {};
const styleListeners = new Set<Listener<typeof styles>>();
const setStyles = createSetter(
  () => styles,
  (data) => {
    styles = { ...styles, ...data };
  },
  styleListeners
);
const subscribeToStyles = createSubscriber(styleListeners);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let topicValues: Record<string, string | number> = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const topicValueListeners = new Set<Listener<typeof topicValues>>();
const setTopicValues = createSetter(
  () => topicValues,
  (data) => {
    topicValues = { ...topicValues, ...data };
  },
  topicValueListeners
);
const subscribeToTopics = createSubscriber(topicValueListeners);

let isPreprocessed = Platform.select({
  default: false,
  web: typeof StyleSheet.create({ test: {} }).test !== "number",
});

let dangerouslyCompileStyles: (css: string) => void | undefined;

export const NativeWindStyleSheet = {
  ...themeFunctions,
  create,
  warmCache,
  useSync,
  reset: () => {
    atoms.clear();
    childClassNames.clear();
    styleSets = {};
    styleSetsListeners.clear();
    styles = {};
    styleListeners.clear();
    topicValues = {
      platform: Platform.OS,
    };
    topicValueListeners.clear();
    setDimensions(Dimensions);
    setColorScheme("system");

    // Add some default atoms. These no do not compile

    atoms.set("group", {
      styles: [],
      context: {
        group: true,
      },
    });

    atoms.set("group-isolate", {
      styles: [],
      context: {
        groupIsolate: true,
      },
    });

    atoms.set("parent", {
      styles: [],
      context: {
        parent: true,
      },
    });
  },
  isPreprocessed: () => isPreprocessed,
  setOutput: (
    specifics: { [platform in PlatformOSType]?: "native" | "css" } & {
      default: "native" | "css";
    }
  ) => (isPreprocessed = Platform.select(specifics) === "css"),
  getColorScheme,
  setColorScheme,
  toggleColorScheme,
  setDimensions,
  setDangerouslyCompileStyles: (callback: typeof dangerouslyCompileStyles) =>
    (dangerouslyCompileStyles = callback),
};
NativeWindStyleSheet.reset();

export type CreateOptions = Record<string, Atom>;

function create(options: CreateOptions) {
  if (isPreprocessed) {
    return;
  } else {
    const newStyles: Record<string, Style[]> = {};

    for (const [atomName, atom] of Object.entries(options)) {
      if (atom.topics) {
        atom.topicSubscription = subscribeToTopics((values, oldValues) => {
          const topicChanged = atom.topics?.some((topic) => {
            return values[topic] !== oldValues[topic];
          });

          if (!topicChanged) {
            return;
          }

          setStyles(evaluate(atomName, atom));
        });
      }

      // Remove any existing subscriptions
      atoms.get(atomName)?.topicSubscription?.();
      atoms.set(atomName, atom);
      Object.assign(newStyles, evaluate(atomName, atom));
    }

    setStyles(newStyles);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const unitRecord: Record<string, (...options: any[]) => any> = {};

function evaluate(name: string, atom: Atom) {
  const atomStyles: Style[] = [];
  const newStyles: Record<string, Style[] | undefined> = { [name]: atomStyles };

  for (const [index, style] of atom.styles.entries()) {
    if (atom.units) {
      for (const [key, unit] of Object.entries(atom.units)) {
        style[key] = unitRecord[unit](style[key]);
      }
    }

    const atRules = atom.atRules?.[index];

    if (!atRules || atRules.length === 0) {
      atomStyles.push(style);
      continue;
    }

    const atRulesResult = atRules.every(([rule, params]) => {
      if (rule === "selector") {
        // These atRules shouldn't be on the atomic styles, they only
        // apply to childStyles
        return false;
      } else if (rule === "colorScheme") {
        return topicValues["colorScheme"] === params;
      } else {
        return matchAtRule({
          rule,
          params,
          width: topicValues["width"] as number,
          height: topicValues["height"] as number,
          orientation: topicValues["orientation"] as OrientationLockType,
        });
      }
    });

    if (atRulesResult) {
      atomStyles.push(style);

      if (atom.childClasses) {
        for (const child of atom.childClasses) {
          const childStyles = atoms.get("child")?.styles;
          if (childStyles) newStyles[child] = childStyles;
        }
      }
    } else {
      if (atom.childClasses) {
        for (const child of atom.childClasses) {
          newStyles[child] = undefined;
        }
      }
    }
  }

  return newStyles;
}

function useSync(
  className: string,
  componentState: Record<string, boolean | number> = {}
) {
  const keyTokens: string[] = [];

  for (const atomName of className.split(/\s+/)) {
    const atom = atoms.get(atomName);

    if (!atom) continue;

    if (atom.conditions) {
      let conditionsPass = true;
      for (const condition of atom.conditions) {
        switch (condition) {
          case "not-first-child":
            conditionsPass =
              typeof componentState["nthChild"] === "number" &&
              componentState["nthChild"] > 0;
            break;
          case "odd":
            conditionsPass =
              typeof componentState["nthChild"] === "number" &&
              componentState["nthChild"] % 2 === 1;
            break;
          case "even":
            conditionsPass =
              typeof componentState["nthChild"] === "number" &&
              componentState["nthChild"] % 2 === 0;
            break;
          default:
            conditionsPass = !!componentState[condition];
        }

        if (!conditionsPass) {
          break;
        }
      }

      if (conditionsPass) {
        keyTokens.push(atomName);
      }
    } else {
      keyTokens.push(atomName);
    }
  }

  const key = keyTokens.join(" ");

  if (!styleSets[key] && key.length > 0) {
    warmCache([keyTokens]);
  }

  const currentStyles = useSyncExternalStoreWithSelector(
    subscribeToStyleSets,
    () => styleSets,
    () => styleSets,
    (styles) => styles[key]
  );

  return {
    styles: currentStyles,
    childClassNames: childClassNames.get(key),
  };
}

function warmCache(tokenSets: Array<string[]>) {
  for (const keyTokens of tokenSets) {
    const key = keyTokens.join(" ");

    setStyleSets({
      [key]: keyTokens.flatMap((token) => {
        return styles[token] ?? [];
      }),
    });

    subscribeToStyles((styles, oldStyles) => {
      const hasChanged = keyTokens.some(
        (token) => styles[token] !== oldStyles[token]
      );

      if (hasChanged) {
        setStyleSets({
          [key]: keyTokens.flatMap((token) => styles[token] ?? []),
        });
      }
    });

    const children = keyTokens.flatMap((token) => {
      const childClasses = atoms.get(token)?.childClasses;
      return childClasses ?? [];
    });

    if (children.length > 0) {
      childClassNames.set(key, children);
    }
  }
}

function getColorScheme() {
  return topicValues["colorScheme"] as "light" | "dark";
}

function setColorScheme(system?: ColorSchemeName | "system" | null) {
  setTopicValues({
    colorSchemeSystem: system ?? "system",
    colorScheme:
      !system || system === "system"
        ? Appearance.getColorScheme() || "light"
        : system,
  });
}

function toggleColorScheme() {
  return setTopicValues((state) => {
    const currentColor =
      state["colorSchemeSystem"] === "system"
        ? Appearance.getColorScheme() || "light"
        : state["colorScheme"];

    const newColor = currentColor === "light" ? "dark" : "light";

    return {
      colorScheme: newColor,
      colorSchemeSystem: newColor,
    };
  });
}

topicValueListeners.add((topics) => {
  if (typeof localStorage !== "undefined") {
    localStorage.nativewind_theme = topics["colorScheme"];
  }
});

try {
  if (typeof localStorage !== "undefined") {
    const isDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    const hasLocalStorageTheme = "nativewind_theme" in localStorage;

    if (
      localStorage.nativewind_theme === "dark" ||
      (!hasLocalStorageTheme && isDarkMode)
    ) {
      document.documentElement.classList.add("dark");
      setColorScheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setColorScheme("light");
    }
  }
} catch {
  // Do nothing
}

Appearance.addChangeListener(({ colorScheme }) => {
  setColorScheme(colorScheme);
});

let dimensionsListener: EmitterSubscription | undefined;
function setDimensions(dimensions: Dimensions) {
  dimensionsListener?.remove();

  const window = dimensions.get("window");
  setTopicValues({
    width: window.width,
    height: window.height,
    orientation: window.width > window.height ? "landscape" : "portrait",
  });

  dimensionsListener = dimensions.addEventListener("change", ({ window }) => {
    setTopicValues({
      width: window.width,
      height: window.height,
      orientation: window.width > window.height ? "landscape" : "portrait",
    });
  });
}

interface MatchAtRuleOptions {
  rule: string;
  params?: string;
  width: number;
  height: number;
  orientation: OrientationLockType;
}

function matchAtRule({
  rule,
  params,
  width,
  height,
  orientation,
}: MatchAtRuleOptions) {
  if (rule === "media" && params) {
    return match(params, {
      type: Platform.OS,
      "aspect-ratio": width / height,
      "device-aspect-ratio": width / height,
      width,
      height,
      "device-width": width,
      "device-height": width,
      orientation,
    });
  }

  return false;
}
