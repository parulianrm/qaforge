export function getProjectCode(projectName?: string): string {
  const words =
    projectName
      ?.replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean) || [];

  if (words.length === 0) return "TC";

  if (words.length === 1) {
    const compact = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return compact.slice(0, Math.min(3, Math.max(2, compact.length))) || "TC";
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function formatTestCaseCode(
  projectName: string | undefined,
  sequence: number,
): string {
  return `${getProjectCode(projectName)}-${String(sequence).padStart(3, "0")}`;
}
