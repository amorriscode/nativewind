import { ReactNode, Children, isValidElement, createElement } from "react";
import { isFragment } from "react-is";
import { matchesMask, PARENT } from "../utils/selector";
import { StyledChild } from "./styled-child";

export interface WithStyledChildrenOptions {
  childClasses: string[];
  componentChildren: ReactNode;
  mask: number;
  parentActive: boolean;
  parentFocus: boolean;
  parentHover: boolean;
}

export function withStyledChildren({
  childClasses,
  componentChildren,
  mask,
  parentActive,
  parentFocus,
  parentHover,
}: WithStyledChildrenOptions): ReactNode {
  if (childClasses.length === 0) {
    return componentChildren;
  }

  const isParent = matchesMask(mask, PARENT);

  if (!isParent) {
    return componentChildren;
  }

  const children = isFragment(componentChildren)
    ? // This probably needs to be recursive
      componentChildren.props.children
    : componentChildren;

  const className = childClasses.join(" ");

  return Children.toArray(children)
    .filter(Boolean) // Remove nothing children
    .map((child, index) => {
      // Skip number and strings
      if (!isValidElement(child)) {
        return child;
      }

      return createElement(StyledChild, {
        child,
        nthChild: index,
        className,
        parentActive,
        parentFocus,
        parentHover,
        ...child.props,
      });
    });
}
