export const TEST_CASE_STATUSES = ["not_run", "pass", "fail", "skip"] as const;
export const TEST_CASE_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const DEFECT_STATUSES = [
  "open",
  "in_progress",
  "solved",
  "closed",
] as const;
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

export function normalizeDefectStatus(status?: string | number | null): DefectStatus {
  const normalized = normalizeValue(status);
  if (["in_progress", "retest"].includes(normalized)) return "in_progress";
  if (["solved", "resolved", "fixed"].includes(normalized)) return "solved";
  if (normalized === "closed") return "closed";
  return "open";
}

export function normalizeDefectPriority(
  priority?: string | number | null,
): DefectPriority {
  const normalized = normalizeValue(priority);
  if (normalized === "blocker" || normalized === "critical") return "blocker";
  if (normalized === "high" || normalized === "major") return "high";
  if (normalized === "low" || normalized === "minor" || normalized === "trivial")
    return "low";
  return "medium";
}
