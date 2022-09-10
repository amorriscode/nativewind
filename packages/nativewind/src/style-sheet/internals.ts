import { AtRuleTuple, Style } from "../types/common";

export const styles: Map<string, Style> = new Map();
export const atRules: Map<string, Array<Array<AtRuleTuple>>> = new Map();
export const masks: Map<string, number> = new Map();
export const topics: Map<string, string[]> = new Map();
export const childClasses: Map<string, string[]> = new Map();
export const units: Map<string, Record<string, string>> = new Map();
export const transforms: Set<string> = new Set();

export const atomTopics: Map<string, Set<string>> = new Map();

export function resetInternals() {
  styles.clear();
  atRules.clear();
  masks.clear();
  topics.clear();
  childClasses.clear();
  units.clear();
  transforms.clear();
  atomTopics.clear();
}
