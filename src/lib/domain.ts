// Fallback/seed values — used only until the admin-configurable Master
// Data list (option_lists table, see src/lib/optionLists.ts) has loaded, or
// as the legacy-alias table for normalizing messy/old data (Excel imports,
// inconsistent casing). The real source of truth for what values exist is
// the database now, not these arrays.
export const TEST_CASE_STATUSES = ["not_run", "pass", "fail", "skip"] as const;
export const TEST_CASE_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const DEFECT_STATUSES = [
  "open",
  "in_development",
  "done_development",
  "on_check",
  "solved",
  "gwind_issue",
  "hold",
  "re_open",
] as const;
export const DEFECT_STATUS_LABELS: Record<
  (typeof DEFECT_STATUSES)[number],
  string
> = {
  open: "Open",
  in_development: "In Development/Fixing",
  done_development: "Done Development/Fixing",
  on_check: "On Check",
  solved: "Solved",
  gwind_issue: "GWind Issue",
  hold: "HOLD",
  re_open: "RE - OPEN",
};
export const DEFECT_PRIORITIES = ["blocker", "high", "medium", "low"] as const;

export function normalizeValue(value?: string | number | null) {
  return (value == null ? "" : String(value))
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function labelize(value?: string | number | null) {
  return normalizeValue(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Every normalize* function below now takes an optional `validValues` list
 * (the current Master Data options for that category). If the input
 * exactly matches one of those — which is always true for values chosen
 * from the app's own dropdowns — it's returned as-is, so admin-added custom
 * values work everywhere. The hardcoded fuzzy-alias checks after that stay
 * as a fallback for messy legacy input (old Excel exports, mixed casing)
 * that predates whatever is currently configured.
 */

export function normalizeTestCaseStatus(
  status?: string | number | null,
  validValues?: readonly string[],
): string {
  const normalized = normalizeValue(status);
  if (validValues?.includes(normalized)) return normalized;
  if (normalized === "pass" || normalized === "passed") return "pass";
  if (normalized === "fail" || normalized === "failed") return "fail";
  if (normalized === "skip" || normalized === "skipped") return "skip";
  if (normalized === "not_run") return "not_run";
  return validValues?.[0] ?? "not_run";
}

export function normalizeTestCasePriority(
  priority?: string | number | null,
  validValues?: readonly string[],
): string {
  const normalized = normalizeValue(priority);
  if (validValues?.includes(normalized)) return normalized;
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  if (normalized === "medium") return "medium";
  return validValues?.[0] ?? "medium";
}

export function normalizeDefectStatus(
  status?: string | number | null,
  validValues?: readonly string[],
): string {
  const normalized = normalizeValue(status).replace(/\//g, "_");
  if (validValues?.includes(normalized)) return normalized;
  if (["re_open", "reopen", "reopened"].includes(normalized)) return "re_open";
  if (["hold", "on_hold", "paused"].includes(normalized)) return "hold";
  if (["gwind_issue", "gwind"].includes(normalized)) return "gwind_issue";
  if (
    ["on_check", "checking", "qa_check", "review", "on_review"].includes(
      normalized,
    )
  )
    return "on_check";
  if (
    [
      "done_development_fixing",
      "done_development",
      "development_done",
      "done",
      "ready_for_test",
      "fixed_pending_test",
    ].includes(normalized)
  )
    return "done_development";
  if (
    [
      "in_development_fixing",
      "in_development",
      "in_progress",
      "developing",
      "fixing",
      "development",
      "retest",
    ].includes(normalized)
  )
    return "in_development";
  if (["solved", "resolved", "fixed", "closed"].includes(normalized))
    return "solved";
  if (normalized === "open") return "open";
  return validValues?.[0] ?? "open";
}

export function labelizeDefectStatus(
  status?: string | number | null,
  options?: { value: string; label: string }[],
) {
  const normalized = normalizeDefectStatus(
    status,
    options?.map((o) => o.value),
  );
  return (
    options?.find((o) => o.value === normalized)?.label ??
    DEFECT_STATUS_LABELS[normalized as keyof typeof DEFECT_STATUS_LABELS] ??
    labelize(normalized)
  );
}

export function normalizeDefectPriority(
  priority?: string | number | null,
  validValues?: readonly string[],
): string {
  const normalized = normalizeValue(priority);
  if (validValues?.includes(normalized)) return normalized;
  if (normalized === "blocker" || normalized === "critical") return "blocker";
  if (normalized === "high" || normalized === "major") return "high";
  if (
    normalized === "low" ||
    normalized === "minor" ||
    normalized === "trivial"
  )
    return "low";
  if (normalized === "medium") return "medium";
  return validValues?.[0] ?? "medium";
}
