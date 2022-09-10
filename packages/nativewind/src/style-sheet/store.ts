import { Appearance, Platform, StyleSheet } from "react-native";
import createStore from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";

import { Style } from "../types/common";
import type { ColorScheme, ColorSchemeSystem } from "./color-scheme";

export type Orientation = "portrait" | "landscape";

export const preprocessed = Symbol("preprocessed");
export const topicValues = Symbol("topicValues");
export const dangerouslyCompileStyles = Symbol("dangerouslyCompileStyles");

interface InitialState {
  [topicValues]: Record<string, string | number>;
  [preprocessed]: boolean;
  [dangerouslyCompileStyles]?: (css: string) => void;
}

export type State = Record<string, Style | Style[]> & InitialState;

export const initialState: State = {
  [topicValues]: {
    colorScheme: initialColorScheme(),
    colorSchemeSystem: "system" as ColorSchemeSystem,
  },
  [preprocessed]: Platform.select({
    default: false,
    web: typeof StyleSheet.create({ test: {} }).test !== "number",
  }),
};

function initialColorScheme(): ColorScheme {
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
        return "dark";
      } else {
        document.documentElement.classList.remove("dark");
        return "light";
      }
    } else {
      return Appearance.getColorScheme() ?? "light";
    }
  } catch {
    return Appearance.getColorScheme() ?? "light";
  }
}

export const store = createStore(subscribeWithSelector(() => initialState));
