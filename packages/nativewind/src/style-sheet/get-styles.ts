import { StyleSheet } from "react-native";
import { StyleArray } from "../types/common";
import {
  createAtRuleSelector,
  getStateBit,
  matchesMask,
  StateBitOptions,
} from "../utils/selector";
import { atRules, childClasses, masks } from "./internals";
import { matchChildAtRule } from "./match-at-rule";
import { store } from "./store";

export interface GetAtomStyleOptions {
  additionalStyles?: StyleArray;
  flatten?: boolean;
}

export function getAtomStyles(
  atoms: string[],
  { additionalStyles, flatten }: GetAtomStyleOptions
) {
  const state = store.getState();
  const styles = atoms.flatMap((atom) => state[atom] ?? []);
  const allStyles = additionalStyles ? [styles, additionalStyles] : styles;
  return flatten ? (StyleSheet.flatten(allStyles) as StyleArray) : allStyles;
}

export function getChildClassNames(className: string | string[]) {
  const atoms = Array.isArray(className) ? className : className.split(/\s+/);
  return atoms.flatMap((atom) => childClasses.get(atom) ?? []);
}

export function getAtomsAndMask(className: string, options: StateBitOptions) {
  const stateBit = getStateBit(options);

  let mask = 0;
  const atoms: string[] = [];

  for (const atom of className.split(/\s+/)) {
    const atomMask = masks.get(atom) || 0;
    mask |= atomMask;
    if (matchesMask(atomMask, stateBit)) {
      atoms.push(atom);
    }
  }

  return { atoms, mask };
}

export interface GetChildAtomsOptions {
  nthChild: number;
  parentActive: boolean;
  parentFocus: boolean;
  parentHover: boolean;
}

export function getChildAtoms(
  className: string,
  options: GetChildAtomsOptions
) {
  const atoms: string[] = [];

  for (const atom of className.split(" ")) {
    const atRulesTuple = atRules.get(atom);

    if (!atRulesTuple) continue;

    for (const [index, atRules] of atRulesTuple.entries()) {
      const match = atRules.every(([rule, params]) => {
        return matchChildAtRule(rule, params, options);
      });

      if (match) {
        atoms.push(createAtRuleSelector(atom, index));
      }
    }
  }

  return atoms;
}
