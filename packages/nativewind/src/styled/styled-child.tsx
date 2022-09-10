import { cloneElement, ReactElement } from "react";
import shallow from "zustand/shallow";

import { NativeWindStyleSheet } from "../style-sheet";
import { GetChildAtomsOptions } from "../style-sheet/get-styles";
import { StyleArray } from "../types/common";

interface StyledChildProps extends GetChildAtomsOptions {
  child: ReactElement;
  className: string;
  style: StyleArray;
}

export function StyledChild({
  child,
  style: additionalStyles,
  className,
  ...options
}: StyledChildProps) {
  const atoms = NativeWindStyleSheet.getChildAtoms(className, options);

  const style = NativeWindStyleSheet.store(() => {
    return NativeWindStyleSheet.getAtomStyles(atoms, { additionalStyles });
  }, shallow);

  return cloneElement(child, { style });
}
