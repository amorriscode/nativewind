import { NativeWindStyleSheet } from "./style-sheet";
import { colorScheme } from "./style-sheet/store";

export function useColorScheme() {
  return {
    setColorScheme: NativeWindStyleSheet.setColorScheme,
    toggleColorScheme: NativeWindStyleSheet.toggleColorScheme,
    colorScheme: NativeWindStyleSheet.store((state) => state[colorScheme]),
  };
}
