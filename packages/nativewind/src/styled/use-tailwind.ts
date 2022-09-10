import { useMemo } from "react";
import shallow from "zustand/shallow";

import { NativeWindStyleSheet } from "../style-sheet";
import { StyleArray, StyleProp } from "../types/common";
import { StateBitOptions } from "../utils/selector";

export interface UseTailwindOptions extends StateBitOptions {
  className: string;
  inlineStyles?: StyleArray;
  additionalStyles?: StyleArray;
  flatten?: boolean;
  preprocessed: boolean;
}

export function useTailwind({
  className,
  inlineStyles,
  additionalStyles,
  flatten,
  preprocessed,
  ...stateBitOptions
}: UseTailwindOptions): [StyleProp, string[], number] {
  if (preprocessed) {
    const styles = useMemo(() => {
      return [
        {
          nativewind: className,
          $$css: true,
        },
        inlineStyles,
      ] as StyleProp;
    }, [className, inlineStyles]);

    return [styles, [], 0];
  }

  const { atoms, mask } = NativeWindStyleSheet.getAtomsAndMask(
    className,
    stateBitOptions
  );

  // Get the styles for this element
  const styles = NativeWindStyleSheet.store(() => {
    return NativeWindStyleSheet.getAtomStyles(atoms, {
      additionalStyles,
      flatten,
    });
  }, shallow);

  // Get the classes that we need to pass to our children
  const childClasses = NativeWindStyleSheet.store(() => {
    return NativeWindStyleSheet.getChildClassNames(atoms);
  }, shallow);

  return [styles, childClasses, mask];
}
