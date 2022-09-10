import {
  Appearance,
  PixelRatio,
  Platform,
  PlatformColor,
  PlatformOSType,
  StyleSheet,
} from "react-native";
import createStore from "zustand";

import { create } from "./create";
import { resetInternals } from "./internals";
import {
  getAtomsAndMask,
  getAtomStyles,
  getChildAtoms,
  getChildClassNames,
} from "./get-styles";
import { setColorScheme, toggleColorScheme } from "./color-scheme";
import {
  dangerouslyCompileStyles,
  initialState,
  preprocessed,
  State,
  store,
} from "./store";

export const NativeWindStyleSheet = {
  store: createStore(store),
  create,
  getAtomsAndMask,
  getAtomStyles,
  getChildClassNames,
  getChildAtoms,
  reset: () => {
    store.setState(initialState);
    resetInternals();
  },
  isPreprocessed: () => store.getState()[preprocessed],
  setOutput: (specifics: {
    [platform in PlatformOSType | "default"]?: "css" | "native";
  }) => {
    store.setState(() => ({
      [preprocessed]: Platform.select(specifics) === "css",
    }));
  },
  setColorScheme,
  toggleColorScheme,
  setDangerouslyCompileStyles: (
    callback: State[typeof dangerouslyCompileStyles]
  ) => {
    store.setState(() => ({
      [dangerouslyCompileStyles]: callback,
    }));
  },
  platformSelect: Platform.select,
  platformColor: (color: string) => {
    // RWN does not implement PlatformColor
    // https://github.com/necolas/react-native-web/issues/2128
    return PlatformColor ? PlatformColor(color) : color;
  },
  hairlineWidth() {
    return StyleSheet.hairlineWidth;
  },
  pixelRatio: (value: number | Record<string, number>) => {
    const ratio = PixelRatio.get();
    return typeof value === "number" ? ratio * value : value[ratio] ?? ratio;
  },
  fontScale: (value: number | Record<string, number>) => {
    const scale = PixelRatio.getFontScale();
    return typeof value === "number" ? scale * value : value[scale] ?? scale;
  },
  getPixelSizeForLayoutSize: PixelRatio.getPixelSizeForLayoutSize,
  roundToNearestPixel: PixelRatio.getPixelSizeForLayoutSize,
};
