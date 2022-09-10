import { Appearance } from "react-native";
import { store, topicValues } from "./store";

export type ColorScheme = "light" | "dark";
export type ColorSchemeSystem = "light" | "dark" | "system";

export function setColorScheme(system: ColorSchemeSystem) {
  store.setState((state) => ({
    [topicValues]: {
      ...state[topicValues],
      colorSchemeSystem: system,
      colorScheme:
        system === "system" ? Appearance.getColorScheme() || "light" : system,
    },
  }));
}
export function toggleColorScheme() {
  return store.setState((state) => {
    const currentColor =
      state[topicValues].colorSchemeSystem === "system"
        ? Appearance.getColorScheme() || "light"
        : state[topicValues].colorScheme;

    const newColor = currentColor === "light" ? "dark" : "light";

    return {
      [topicValues]: {
        ...state[topicValues],
        colorScheme: newColor,
        colorSchemeSystem: newColor,
      },
    };
  });
}

store.subscribe(
  (state) => state[topicValues].colorScheme,
  (colorScheme) => {
    if (typeof localStorage !== "undefined") {
      localStorage.nativewind_theme = colorScheme;
    }
  }
);
