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

export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number];
export type TestCasePriority = (typeof TEST_CASE_PRIORITIES)[number];
export type DefectStatus = (typeof DEFECT_STATUSES)[number];
export type DefectPriority = (typeof DEFECT_PRIORITIES)[number];

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

export function normalizeTestCaseStatus(
  status?: string | number | null,
): TestCaseStatus {
  const normalized = normalizeValue(status);
  if (normalized === "pass" || normalized === "passed") return "pass";
  if (normalized === "fail" || normalized === "failed") return "fail";
  if (normalized === "skip" || normalized === "skipped") return "skip";
  return "not_run";
}

export function normalizeTestCasePriority(
  priority?: string | number | null,
): TestCasePriority {
  const normalized = normalizeValue(priority);
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "low") return "low";
  return "medium";
}

export function normalizeDefectStatus(
  status?: string | number | null,
): DefectStatus {
  const normalized = normalizeValue(status).replace(/\//g, "_");
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
  return "open";
}

export function labelizeDefectStatus(status?: string | number | null) {
  return DEFECT_STATUS_LABELS[normalizeDefectStatus(status)];
}

export function normalizeDefectPriority(
  priority?: string | number | null,
): DefectPriority {
  const normalized = normalizeValue(priority);
  if (normalized === "blocker" || normalized === "critical") return "blocker";
  if (normalized === "high" || normalized === "major") return "high";
  if (
    normalized === "low" ||
    normalized === "minor" ||
    normalized === "trivial"
  )
    return "low";
  return "medium";
}
