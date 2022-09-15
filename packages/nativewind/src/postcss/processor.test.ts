import { Atom, CreateOptions } from "../style-sheet";
import nativePreset from "../tailwind/native-preset";
import { extractStyles } from "./index";

const expectStyle = (style: string) => {
  const { raw } = extractStyles({
    content: [],
    safelist: style.split(" "),
    presets: [nativePreset],
  });

  return expect(raw);
};

const cases: Record<string, Atom | CreateOptions> = {
  "w-screen": {
    styles: [{ width: { unit: "vw", value: 100 } }],
  },
  "text-red-500": {
    styles: [{ color: "#ef4444" }],
  },
  "dark:text-red-500": {
    styles: [{ color: "#ef4444" }],
    atRules: { 0: [["colorScheme", "dark"]] },
    topics: ["colorScheme"],
  },
  "hover:text-red-500": {
    styles: [{ color: "#ef4444" }],
    conditions: ["hover"],
  },
  "dark:group-hover:hover:text-red-500": {
    styles: [{ color: "#ef4444" }],
    conditions: ["hover", "group-hover"],
    topics: ["colorScheme"],
    atRules: {
      "0": [["colorScheme", "dark"]],
    },
  },
  "scale-50": {
    styles: [{ transform: [{ scaleY: 0.5 }, { scaleX: 0.5 }] }],
  },
  "group-hover:text-red-500": {
    styles: [{ color: "#ef4444" }],
    conditions: ["group-hover"],
  },
  "lg:hover:divide-x-2": {
    "lg:hover:divide-x-2": {
      styles: [{}],
      conditions: ["hover", "parent"],
      childClasses: ["lg:hover:divide-x-2.children"],
      topics: ["width"],
      atRules: {
        0: [["media", "(min-width: 1024px)"]],
      },
    },
    "lg:hover:divide-x-2.children": {
      styles: [{ borderLeftWidth: 2, borderRightWidth: 0 }],
      conditions: ["not-first-child"],
      topics: ["width"],
      atRules: {
        0: [["media", "(min-width: 1024px)"]],
      },
    },
  },
  container: {
    styles: [
      { width: "100%" },
      { maxWidth: 640 },
      { maxWidth: 768 },
      { maxWidth: 1024 },
      { maxWidth: 1280 },
      { maxWidth: 1536 },
    ],
    atRules: {
      1: [["media", "(min-width: 640px)"]],
      2: [["media", "(min-width: 768px)"]],
      3: [["media", "(min-width: 1024px)"]],
      4: [["media", "(min-width: 1280px)"]],
      5: [["media", "(min-width: 1536px)"]],
    },
    topics: ["width"],
  },
};

test.each(Object.entries(cases))("%s", (input, output) => {
  if ("styles" in output) {
    expectStyle(input).toEqual({
      [input]: output,
    });
  } else {
    expectStyle(input).toEqual(output);
  }
});
