import { supabase } from "./supabase";
import { RoleAccent } from "./roles";

export const OPTION_CATEGORIES = [
  { key: "test_case_priority", label: "Test Case Priority" },
  { key: "test_case_status", label: "Test Case Status" },
  { key: "defect_priority", label: "Defect Priority" },
  { key: "defect_status", label: "Defect Status" },
] as const;

export type OptionCategory = (typeof OPTION_CATEGORIES)[number]["key"];

export interface OptionListItem {
  id: string;
  category: OptionCategory;
  value: string;
  label: string;
  accent: RoleAccent;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

export async function fetchOptionLists(): Promise<OptionListItem[]> {
  const { data } = await supabase
    .from("option_lists")
    .select("*")
    .order("category")
    .order("sort_order");
  return (data || []) as OptionListItem[];
}

export function optionsFor(
  items: OptionListItem[],
  category: OptionCategory,
): OptionListItem[] {
  return items.filter((item) => item.category === category);
}

export function optionValues(
  items: OptionListItem[],
  category: OptionCategory,
): string[] {
  return optionsFor(items, category).map((item) => item.value);
}

export function findOption(
  items: OptionListItem[],
  category: OptionCategory,
  value: string,
): OptionListItem | undefined {
  return items.find(
    (item) => item.category === category && item.value === value,
  );
}
