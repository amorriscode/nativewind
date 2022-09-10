import {
  createElement,
  ReactNode,
  ComponentType,
  forwardRef,
  RefAttributes,
  ForwardedRef,
  ClassAttributes,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  useContext,
} from "react";
import { NativeWindStyleSheet } from "../style-sheet";
import { InteractionProps, useInteraction } from "./use-interaction";
import { withStyledChildren } from "./with-styled-children";
import { withStyledProps } from "./with-styled-props";
import { useTailwind } from "./use-tailwind";
import { StyleProp } from "react-native";
import { GroupContext, IsolateGroupContext } from "./group-context";
import { useComponentState } from "./use-component-state";
import { GROUP, GROUP_ISO, matchesMask } from "../utils/selector";
import { Style } from "../types/common";

export interface StyledOptions<
  T,
  P extends keyof T = never,
  C extends keyof T = never
> {
  props?: Partial<Record<P, keyof Style | true>>;
  classProps?: C[];
  baseClassName?: string;
}

export type StyledProps<P> = P & {
  className?: string;
  tw?: string;
  baseClassName?: string;
  baseTw?: string;
};

type ForwardRef<T, P> = ForwardRefExoticComponent<
  PropsWithoutRef<P> & RefAttributes<T>
>;

type InferRef<T> = T extends RefAttributes<infer R> | ClassAttributes<infer R>
  ? R
  : unknown;

/**
 * Default
 */
export function styled<T>(
  Component: ComponentType<T>
): ForwardRef<InferRef<T>, StyledProps<T>>;

/**
 * Base className
 */
export function styled<T>(
  Component: ComponentType<T>,
  baseClassName: string
): ForwardRef<InferRef<T>, StyledProps<T>>;

/**
 * Only options
 */
export function styled<T, P extends keyof T, C extends keyof T>(
  Component: ComponentType<T>,
  options: StyledOptions<T, P, C>
): ForwardRef<
  InferRef<T>,
  StyledProps<{ [key in keyof T]: key extends P ? T[key] | string : T[key] }>
>;

/**
 * Base className w/ options
 */
export function styled<T, P extends keyof T, C extends keyof T>(
  Component: ComponentType<T>,
  baseClassName: string,
  options: StyledOptions<T, P, C>
): ForwardRef<
  InferRef<T>,
  StyledProps<{ [key in keyof T]: key extends P ? T[key] | string : T[key] }>
>;

/**
 * Actual implementation
 */
export function styled<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { style?: StyleProp<any>; children?: ReactNode | undefined },
  P extends keyof T,
  C extends keyof T
>(
  Component: ComponentType<T>,
  styledBaseClassNameOrOptions?: string | StyledOptions<T, P, C>,
  maybeOptions: StyledOptions<T, P, C> = {}
) {
  const { props: propsToTransform, classProps } =
    typeof styledBaseClassNameOrOptions === "object"
      ? styledBaseClassNameOrOptions
      : maybeOptions;

  const baseClassName =
    typeof styledBaseClassNameOrOptions === "string"
      ? styledBaseClassNameOrOptions
      : maybeOptions?.baseClassName;

  function Styled(
    {
      className: propClassName = "",
      tw: twClassName,
      style: inlineStyles,
      children: componentChildren,
      ...componentProps
    }: StyledProps<T>,
    ref: ForwardedRef<unknown>
  ) {
    const groupContext = useContext(GroupContext);
    const isolateGroupContext = useContext(IsolateGroupContext);
    const preprocessed = NativeWindStyleSheet.isPreprocessed();

    const classNameWithDefaults = baseClassName
      ? `${baseClassName} ${twClassName ?? propClassName}`
      : twClassName ?? propClassName;

    /**
     * Get the hover/focus/active state of this component
     */
    const [componentState, dispatch] = useComponentState();

    /**
     * Resolve the props/classProps/spreadProps options
     */
    const {
      styledProps,
      mask: propsMask,
      className,
    } = withStyledProps<T, P, C>({
      preprocessed,
      className: classNameWithDefaults,
      propsToTransform,
      classProps,
      componentProps: componentProps as unknown as Record<
        P | C | string,
        string
      >,
    });

    /**
     * Resolve the className->style
     */
    const [style, childClasses, styleMask] = useTailwind({
      className,
      inlineStyles,
      preprocessed,
      ...componentState,
      ...groupContext,
      ...isolateGroupContext,
    });

    const mask = styleMask | propsMask;

    /**
     * Determine if we need event handlers for our styles
     */
    const handlers = useInteraction(
      dispatch,
      mask,
      componentProps as InteractionProps
    );

    /**
     * Resolve the child styles
     */
    const children = withStyledChildren({
      childClasses,
      componentChildren,
      mask,
      parentActive: componentState.active,
      parentFocus: componentState.focus,
      parentHover: componentState.hover,
    });

    /**
     * Pass the styles to the element
     */
    let reactNode: ReactNode = createElement(Component, {
      ...componentProps,
      ...handlers,
      ...styledProps,
      style: style,
      children,
      ref,
    } as unknown as T);

    /**
     * Determine if we need to wrap element in Providers
     */
    if (matchesMask(mask, GROUP)) {
      reactNode = createElement(GroupContext.Provider, {
        children: reactNode,
        value: {
          groupHover: groupContext.groupHover || componentState.hover,
          groupFocus: groupContext.groupFocus || componentState.focus,
          groupActive: groupContext.groupActive || componentState.active,
        },
      });
    }

    if (matchesMask(mask, GROUP_ISO)) {
      reactNode = createElement(IsolateGroupContext.Provider, {
        children: reactNode,
        value: {
          isolateGroupHover: componentState.hover,
          isolateGroupFocus: componentState.focus,
          isolateGroupActive: componentState.active,
        },
      });
    }

    return reactNode;
  }

  if (typeof Component !== "string") {
    Styled.displayName = `NativeWind.${
      Component.displayName || Component.name || "NoName"
    }`;
  }

  return forwardRef(Styled);
}
