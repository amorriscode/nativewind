import { cloneElement, ReactElement } from "react";
// import shallow from "zustand/shallow";

// import { GetChildAtomsOptions, NativeWindStyleSheet } from "../style-sheet";
import { StyleArray } from "../types/common";

interface StyledChildProps {
  child: ReactElement;
  className: string;
  style: StyleArray;
}

export function StyledChild({
  child,
  style,
}: // style: additionalStyles,
// className,
// ...options
StyledChildProps) {
  // const atoms = NativeWindStyleSheet.getChildAtoms(className, options);

  // const style = NativeWindStyleSheet.store(() => {
  //   return NativeWindStyleSheet.getAtomStyles(atoms, { additionalStyles });
  // }, shallow);

  return cloneElement(child, { style });
}
