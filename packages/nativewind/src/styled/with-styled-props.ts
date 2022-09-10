import type { StyledOptions } from ".";
import { useTailwind } from "./use-tailwind";

export interface WithStyledPropsOptions<
  T,
  P extends keyof T,
  C extends keyof T
> {
  preprocessed: boolean;
  className: string;
  propsToTransform?: StyledOptions<T, P, C>["props"];
  componentProps: Record<P | C | string, string>;
  classProps?: C[];
}

export function withStyledProps<T, P extends keyof T, C extends keyof T>({
  propsToTransform,
  componentProps,
  classProps,
  preprocessed,
  className,
}: WithStyledPropsOptions<T, P, C>) {
  const styledProps: Partial<Record<P | C, unknown>> = {};
  let mask = 0;

  if (classProps) {
    if (preprocessed) {
      for (const prop of classProps) {
        styledProps[prop] = undefined;
        className += ` ${componentProps[prop]}`;
      }
    } else {
      for (const prop of classProps) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [style, , styleMask] = useTailwind({
          className: componentProps[prop],
          flatten: true,
          preprocessed,
        });

        if (styleMask) {
          mask |= styleMask;
        }

        Object.assign(
          styledProps,
          { [prop]: undefined },
          Array.isArray(style) ? style[0] : style
        );
      }
    }
  }

  if (propsToTransform && !preprocessed) {
    for (const [prop, styleKey] of Object.entries(propsToTransform)) {
      const [style, , styleMask] = useTailwind({
        className: componentProps[prop],
        flatten: styleKey !== true,
        preprocessed,
      });

      if (styleMask) {
        mask |= styleMask;
      }

      if (typeof styleKey === "boolean") {
        styledProps[prop as P | C] = style;
      } else {
        const firstStyle = Array.isArray(style) ? style[0] : style;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        styledProps[prop as P | C] = (firstStyle as any)[styleKey as any];
      }
    }
  }

  return { styledProps, mask, className };
}
