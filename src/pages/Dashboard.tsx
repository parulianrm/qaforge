import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  FolderOpen,
  Gauge,
  Radio,
  Search,
  ShieldAlert,
  Timer,
  X,
  XCircle,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  labelize,
  normalizeDefectPriority,
  normalizeDefectStatus,
  normalizeTestCaseStatus,
  normalizeValue,
} from "../lib/domain";
import { Defect, Project, RecordingSession, TestCase, TestRun } from "../types";

type CountResult = { count: number; available: boolean };
type TestCaseStatusCounts = {
  pass: number;
  fail: number;
  skip: number;
  notRun: number;
};
type RecordingStep = {
  id: string;
  recording_session_id: string;
  step_order: number;
  action_type: string;
  target_text?: string;
  locator_css?: string;
  locator_xpath?: string;
  value?: string;
  url?: string;
  screenshot_url?: string;
  timestamp?: string;
  created_at?: string;
};
type CountQuery = {
  eq: (column: string, value: string) => CountQuery;
  then: PromiseLike<{ count: number | null; error: unknown } | { count: null; error: unknown }>["then"];
};
type CountFilter = (query: CountQuery) => CountQuery;

async function getCount(
  table: string,
  filters?: CountFilter,
): Promise<CountResult> {
  let query = supabase.from(table).select("id", {
    count: "exact",
    head: true,
  }) as unknown as CountQuery;
  if (filters) query = filters(query);
  const { count, error } = await query;
  return { count: error ? 0 : count || 0, available: !error };
}

function formatStatusLabel(status?: string) {
  return labelize(status);
}

function getTestCaseStatusCounts(testCases: TestCase[]): TestCaseStatusCounts {
  return testCases.reduce<TestCaseStatusCounts>(
    (acc, tc) => {
      const status = normalizeTestCaseStatus(tc.status);
      if (status === "pass") acc.pass += 1;
      else if (status === "fail") acc.fail += 1;
      else if (status === "skip") acc.skip += 1;
      else if (status === "not_run" || status === "notrun") acc.notRun += 1;
      return acc;
    },
    { pass: 0, fail: 0, skip: 0, notRun: 0 },
  );
}

function getStatusPill(status?: string) {
  const normalized = normalizeTestCaseStatus(status);
  if (normalized === "pass") return "bg-emerald-50 text-emerald-700";
  if (normalized === "fail") return "bg-red-50 text-red-700";
  if (normalized === "skip")
    return "bg-amber-50 text-amber-700";
  if (normalized === "not_run") return "bg-slate-100 text-slate-500";
  return "bg-slate-100 text-slate-600";
}

function getRecordingStepText(step: RecordingStep) {
  const action = normalizeValue(step.action_type).toUpperCase();
  if (action === "NAV" || action === "NAVIGATE") {
    return `Buka halaman ${step.url || "-"}`;
  }
  if (action === "CLICK") return `Klik "${step.target_text || "element"}"`;
  if (action === "TYPE" || action === "INPUT") {
    return `Isi field "${step.target_text || "field"}" dengan "${step.value || ""}"`;
  }
  if (action === "SCROLL") return `Scroll halaman`;
  if (action === "NOTIFICATION" || action === "ASSERT_TEXT") {
    return `Validasi teks/notifikasi "${step.target_text || step.value || ""}"`;
  }
  return `${formatStatusLabel(action)} ${step.target_text || step.value || ""}`.trim();
}

function generateRecordingGherkin(
  session: RecordingSession,
  steps: RecordingStep[],
) {
  const lines = [
    `Feature: ${session.title || session.name || "Recording Session"}`,
    "",
    `  Scenario: ${session.title || session.name || "Recorded flow"}`,
  ];

  steps.forEach((step, index) => {
    const action = normalizeValue(step.action_type).toUpperCase();
    let keyword = index === 0 ? "Given" : "And";
    let text = getRecordingStepText(step).toLowerCase();

    if (action === "CLICK" || action === "TYPE" || action === "INPUT") {
      keyword = index === 0 ? "Given" : "When";
    }
    if (action === "NOTIFICATION" || action === "ASSERT_TEXT") {
      keyword = "Then";
      text = `muncul "${step.target_text || step.value || "hasil yang diharapkan"}"`;
    }

    lines.push(`    ${keyword} ${text}`);
  });

  if (steps.length === 0) {
    lines.push("    Given recording steps belum tersedia");
  }

  return lines.join("\n");
}

function generateRecordingStepsText(steps: RecordingStep[]) {
  if (steps.length === 0) return "Step recording belum tersedia.";
  return steps
    .map((step) => `${step.step_order}. ${getRecordingStepText(step)}`)
    .join("\n");
}

function toJavaClassName(value?: string) {
  return (
    (value || "RecordedFlow")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("")
      .slice(0, 40) || "RecordedFlow"
  );
}

function toJavaMethodName(value?: string) {
  const className = toJavaClassName(value);
  return className.charAt(0).toLowerCase() + className.slice(1);
}

function getLocator(step: RecordingStep) {
  if (step.locator_css) return `By.cssSelector("${step.locator_css}")`;
  if (step.locator_xpath) return `By.xpath("${step.locator_xpath}")`;
  return `By.xpath("//*[contains(normalize-space(), '${step.target_text || "element"}')]")`;
}

function getSeleniumJavaParts(
  session: RecordingSession,
  steps: RecordingStep[],
) {
  const className = toJavaClassName(session.title || session.name);
  const pageClass = `${className}Page`;
  const stepClass = `${className}Steps`;
  const pageVar = toJavaMethodName(pageClass);
  const actionableSteps = steps.filter((step) =>
    ["CLICK", "TYPE", "INPUT", "NOTIFICATION", "ASSERT_TEXT"].includes(
      normalizeValue(step.action_type).toUpperCase(),
    ),
  );

  const pageMethods = actionableSteps
    .map((step, index) => {
      const action = normalizeValue(step.action_type).toUpperCase();
      const targetName = toJavaClassName(
        step.target_text || `Element${index + 1}`,
      );
      if (action === "TYPE" || action === "INPUT") {
        return [
          `    private final By ${targetName.toUpperCase()} = ${getLocator(step)};`,
          ``,
          `    public void enter${targetName}(String value) {`,
          `        type(${targetName.toUpperCase()}, value);`,
          `    }`,
        ].join("\n");
      }
      if (action === "NOTIFICATION" || action === "ASSERT_TEXT") {
        return [
          `    private final By ${targetName.toUpperCase()} = ${getLocator(step)};`,
          ``,
          `    public boolean is${targetName}Visible() {`,
          `        return isVisible(${targetName.toUpperCase()});`,
          `    }`,
        ].join("\n");
      }
      return [
        `    private final By ${targetName.toUpperCase()} = ${getLocator(step)};`,
        ``,
        `    public void click${targetName}() {`,
        `        click(${targetName.toUpperCase()});`,
        `    }`,
      ].join("\n");
    })
    .join("\n\n");

  const stepMethods = steps
    .map((step, index) => {
      const action = normalizeValue(step.action_type).toUpperCase();
      const targetName = toJavaClassName(
        step.target_text || `Element${index + 1}`,
      );
      if (action === "NAV" || action === "NAVIGATE") {
        return [
          `    @Given("buka halaman ${step.url || ""}")`,
          `    public void openRecordedPage() {`,
          `        ${pageVar}.openPage();`,
          `    }`,
        ].join("\n");
      }
      if (action === "TYPE" || action === "INPUT") {
        return [
          `    @When("isi ${step.target_text || "field"}")`,
          `    public void enter${targetName}() {`,
          `        ${pageVar}.enter${targetName}("${step.value || ""}");`,
          `    }`,
        ].join("\n");
      }
      if (action === "NOTIFICATION" || action === "ASSERT_TEXT") {
        return [
          `    @Then("muncul ${step.target_text || step.value || "hasil yang diharapkan"}")`,
          `    public void assert${targetName}Visible() {`,
          `        Assert.assertTrue(${pageVar}.is${targetName}Visible());`,
          `    }`,
        ].join("\n");
      }
      return [
        `    @When("klik ${step.target_text || "element"}")`,
        `    public void click${targetName}() {`,
        `        ${pageVar}.click${targetName}();`,
        `    }`,
      ].join("\n");
    })
    .join("\n\n");

  const page = [
    `package pages;`,
    ``,
    `import org.openqa.selenium.By;`,
    `import org.openqa.selenium.WebDriver;`,
    ``,
    `public class ${pageClass} extends BasePage {`,
    `    public ${pageClass}(WebDriver driver) {`,
    `        super(driver);`,
    `    }`,
    ``,
    `    public void openPage() {`,
    `        driver.get("${session.target_url || session.url || ""}");`,
    `    }`,
    ``,
    pageMethods || `    // No actionable locators recorded yet.`,
    `}`,
  ].join("\n");

  const stepDefinitions = [
    `package steps;`,
    ``,
    `import io.cucumber.java.en.*;`,
    `import org.testng.Assert;`,
    `import pages.${pageClass};`,
    `import utils.DriverFactory;`,
    ``,
    `public class ${stepClass} {`,
    `    private final ${pageClass} ${pageVar} = new ${pageClass}(DriverFactory.getDriver());`,
    ``,
    stepMethods || `    // Recording steps belum tersedia.`,
    `}`,
  ].join("\n");

  return {
    feature: generateRecordingGherkin(session, steps),
    steps: stepDefinitions,
    page,
  };
}

function CodePanel({
  label,
  code,
  copyKey,
  copiedKey,
  onCopy,
}: {
  label: string;
  code: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, code: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-slate-950 ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-3 text-sm font-semibold text-white">
          <span className="font-mono text-xs text-slate-300">&lt;/&gt;</span>
          <span>{label}</span>
        </div>
        <button
          onClick={() => onCopy(copyKey, code)}
          className="rounded-md p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          title={copiedKey === copyKey ? "Tersalin" : "Salin"}
        >
          <Copy size={16} />
        </button>
      </div>
      <pre className="max-h-[58vh] overflow-auto p-5 text-xs font-semibold leading-relaxed text-slate-100">
        {code}
      </pre>
    </div>
  );
}

function PaginationControls({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [recentRuns, setRecentRuns] = useState<TestRun[]>([]);
  const [recentRecordings, setRecentRecordings] = useState<RecordingSession[]>(
    [],
  );
  const [selectedRecording, setSelectedRecording] =
    useState<RecordingSession | null>(null);
  const [selectedRecordingSteps, setSelectedRecordingSteps] = useState<
    RecordingStep[]
  >([]);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [copiedRecordingTab, setCopiedRecordingTab] = useState("");
  const [recordingTab, setRecordingTab] = useState<"steps" | "selenium">(
    "selenium",
  );
  const [seleniumTab, setSeleniumTab] = useState<"feature" | "steps" | "page">(
    "feature",
  );
  const [recentDefects, setRecentDefects] = useState<Defect[]>([]);
  const [metrics, setMetrics] = useState({
    projects: 0,
    modules: 0,
    testCases: 0,
    testRuns: 0,
    recordingSessions: 0,
    pass: 0,
    fail: 0,
    skip: 0,
    notRun: 0,
    openDefects: 0,
    criticalDefects: 0,
  });
  const [availableTables, setAvailableTables] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [projectsPage, setProjectsPage] = useState(1);
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [runsPage, setRunsPage] = useState(1);
  const [defectsPage, setDefectsPage] = useState(1);
  const [testCasesPage, setTestCasesPage] = useState(1);

  useEffect(() => {
    setProjectsPage(1);
    setRecordingsPage(1);
    setRunsPage(1);
    setDefectsPage(1);
    setTestCasesPage(1);
    fetchData();
  }, [selectedProjectId]);

  async function fetchData() {
    setLoading(true);
    const byProject = <T,>(query: T): T => {
      if (!selectedProjectId) return query;
      return (
        query as { eq: (column: string, value: string) => T }
      ).eq("project_id", selectedProjectId);
    };

    const [
      projectsResult,
      recentTcResult,
      recentRunsResult,
      recentRecordingsResult,
      recentDefectsResult,
      moduleSourceResult,
      moduleCount,
      testCaseCount,
      testRunCount,
      recordingSessionCount,
      passCount,
      defectCount,
    ] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", {
        ascending: false,
      }),
      byProject(
        supabase
          .from("test_cases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      byProject(
        supabase
          .from("test_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      byProject(
        supabase
          .from("recording_sessions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      byProject(
        supabase
          .from("defects")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
      ),
      byProject(supabase.from("test_cases").select("project_id,module")),
      getCount("app_modules", byProject),
      getCount("test_cases", byProject),
      getCount("test_runs", byProject),
      getCount("recording_sessions", byProject),
      getCount("test_run_items", (q) => q.eq("execution_status", "PASS")),
      getCount("defects", byProject),
    ]);

    const projectsData = projectsResult.data || [];
    const recentTcData = recentTcResult.data || [];
    const moduleSourceData =
      moduleSourceResult.error || !moduleSourceResult.data
        ? []
        : moduleSourceResult.data;
    const moduleFallbackCount = new Set(
      moduleSourceData
        .map((row: Pick<TestCase, "module">) =>
          (row.module || "").trim().toLowerCase(),
        )
        .filter(Boolean),
    ).size;
    const displayedStatusCounts = getTestCaseStatusCounts(recentTcData);
    const recentDefectsData: Defect[] = recentDefectsResult.error
      ? []
      : recentDefectsResult.data || [];
    const openDefects = recentDefectsData.filter((defect) =>
      ["open", "in_progress"].includes(normalizeDefectStatus(defect.status)),
    ).length;
    const criticalDefects = recentDefectsData.filter(
      (defect) =>
        normalizeDefectPriority(defect.priority || defect.severity) ===
        "blocker",
    ).length;

    setProjects(projectsData);
    setTestCases(recentTcData);
    setRecentRuns(recentRunsResult.error ? [] : recentRunsResult.data || []);
    setRecentRecordings(
      recentRecordingsResult.error ? [] : recentRecordingsResult.data || [],
    );
    setRecentDefects(recentDefectsData);
    setMetrics({
      projects: selectedProjectId ? 1 : projectsData.length,
      modules: Math.max(moduleCount.count, moduleFallbackCount),
      testCases: testCaseCount.count || recentTcData.length,
      testRuns: testRunCount.count,
      recordingSessions: recordingSessionCount.count,
      pass: displayedStatusCounts.pass,
      fail: displayedStatusCounts.fail,
      skip: displayedStatusCounts.skip,
      notRun: displayedStatusCounts.notRun,
      openDefects,
      criticalDefects,
    });
    setAvailableTables({
      app_modules: moduleCount.available,
      test_runs: testRunCount.available,
      test_run_items: passCount.available,
      defects: defectCount.available,
      recording_sessions: recordingSessionCount.available,
    });
    setLoading(false);
  }

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const projectList = selectedProject ? [selectedProject] : projects;
  const displayedProjects = paginate(projectList, projectsPage, 5);
  const displayedRecordings = paginate(recentRecordings, recordingsPage, 5);
  const displayedRuns = paginate(recentRuns, runsPage, 5);
  const displayedDefects = paginate(recentDefects, defectsPage, 5);
  const displayedTestCases = paginate(testCases, testCasesPage, 10);
  const missingMvpTables = Object.entries(availableTables)
    .filter(([, available]) => !available)
    .map(([table]) => table);

  const executedTotal = metrics.pass + metrics.fail + metrics.skip;
  const passRate =
    executedTotal > 0 ? Math.round((metrics.pass / executedTotal) * 100) : 0;
  const qualityStatus =
    executedTotal > 0 && metrics.fail === 0 && passRate === 100
      ? "Ready to Deploy"
      : metrics.fail > 0
        ? "Risk"
        : "Needs Attention";
  const totalStatus =
    metrics.pass + metrics.fail + metrics.skip + metrics.notRun;

  function getProjectName(projectId: string) {
    return projects.find((project) => project.id === projectId)?.name || "-";
  }

  async function openRecordingDetail(session: RecordingSession) {
    setSelectedRecording(session);
    setSelectedRecordingSteps([]);
    setRecordingTab("selenium");
    setSeleniumTab("feature");
    setRecordingLoading(true);
    const { data, error } = await supabase
      .from("recording_steps")
      .select("*")
      .eq("recording_session_id", session.id)
      .order("step_order", { ascending: true });
    setSelectedRecordingSteps(error ? [] : data || []);
    setRecordingLoading(false);
  }

  function copyRecordingCode(key: string, code: string) {
    navigator.clipboard.writeText(code);
    setCopiedRecordingTab(key);
    setTimeout(() => setCopiedRecordingTab(""), 1600);
  }

  const metricCards = [
    {
      label: "Projects",
      value: metrics.projects,
      icon: FolderOpen,
      accent: "bg-slate-900 text-white",
      text: "text-slate-900",
    },
    {
      label: "Modules",
      value: metrics.modules,
      icon: BarChart3,
      accent: "bg-sky-500 text-white",
      text: "text-slate-900",
    },
    {
      label: "Test Cases",
      value: metrics.testCases,
      icon: ClipboardList,
      accent: "bg-emerald-500 text-white",
      text: "text-emerald-600",
    },
    {
      label: "Test Runs",
      value: metrics.testRuns,
      icon: Timer,
      accent: "bg-blue-500 text-white",
      text: "text-blue-600",
    },
    {
      label: "Recordings",
      value: metrics.recordingSessions,
      icon: Radio,
      accent: "bg-violet-500 text-white",
      text: "text-violet-600",
    },
    {
      label: "Open Defects",
      value: metrics.openDefects,
      icon: ShieldAlert,
      accent: "bg-red-500 text-white",
      text: "text-red-500",
    },
    {
      label: "Critical Defects",
      value: metrics.criticalDefects,
      icon: AlertTriangle,
      accent: "bg-rose-700 text-white",
      text: "text-rose-700",
    },
  ];

  const statusCards = [
    {
      label: "PASS",
      value: metrics.pass,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    {
      label: "FAIL",
      value: metrics.fail,
      icon: XCircle,
      color: "text-red-500",
      bar: "bg-red-500",
    },
    {
      label: "SKIP",
      value: metrics.skip,
      icon: AlertTriangle,
      color: "text-amber-600",
      bar: "bg-amber-500",
    },
    {
      label: "NOT RUN",
      value: metrics.notRun,
      icon: Timer,
      color: "text-slate-400",
      bar: "bg-slate-300",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6 lg:p-8">
      <div className="mb-6 rounded-lg bg-slate-900 text-white shadow-lg">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/30">
              <Gauge size={28} className="text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-200">
                HavoX QA Command Center
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-300">
                Ringkasan kondisi QA
                {selectedProject
                  ? ` untuk ${selectedProject.name}`
                  : " semua project"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-80">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Filter Project
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-white/10 bg-white/10 px-9 py-2 text-sm text-white outline-none transition focus:border-emerald-300"
                >
                  <option className="text-slate-900" value="">
                    Semua project
                  </option>
                  {projects.map((project) => (
                    <option
                      className="text-slate-900"
                      key={project.id}
                      value={project.id}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {missingMvpTables.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Beberapa tabel Core MVP belum tersedia: {missingMvpTables.join(", ")}.
          Dashboard tetap memakai data yang sudah ada.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-4 flex items-start">
              <div className={`rounded-lg p-2 ${card.accent}`}>
                <card.icon size={16} />
              </div>
            </div>
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold ${card.text}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-lg">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="relative">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  Quality Pulse
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {qualityStatus}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  Fokus utama kualitas dari test case yang sedang difilter.
                </p>
              </div>
              <Gauge size={28} className="text-emerald-300" />
            </div>

            <div className="mx-auto mb-6 flex h-56 w-56 items-center justify-center rounded-full bg-white/5">
              <div
                className="relative flex h-48 w-48 items-center justify-center rounded-full shadow-2xl"
                style={{
                  background: `conic-gradient(#10b981 ${passRate * 3.6}deg, rgba(148, 163, 184, 0.22) 0deg)`,
                }}
              >
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-slate-950 ring-1 ring-white/10">
                  <span className="text-5xl font-semibold text-emerald-300">
                    {passRate}%
                  </span>
                  <span className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Pass Rate
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-xs text-slate-400">Executed</p>
                <p className="mt-1 text-2xl font-semibold">{executedTotal}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-xs text-slate-400">Open Defects</p>
                <p className="mt-1 text-2xl font-semibold text-red-300">
                  {metrics.openDefects}
                </p>
              </div>
              <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
                <p className="text-xs text-slate-400">Recordings</p>
                <p className="mt-1 text-2xl font-semibold text-violet-300">
                  {metrics.recordingSessions}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Execution Status
              </h2>
              <p className="text-xs text-slate-500">
                Berdasarkan recent test case yang sedang difilter
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
                Pass Rate <span className="text-base">{passRate}%</span>
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {totalStatus} total
              </span>
            </div>
          </div>
          <div className="mb-5 overflow-hidden rounded-lg bg-slate-100">
            <div className="flex h-3">
              <div
                className="bg-emerald-500"
                style={{
                  width: `${totalStatus > 0 ? (metrics.pass / totalStatus) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-red-500"
                style={{
                  width: `${totalStatus > 0 ? (metrics.fail / totalStatus) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-amber-500"
                style={{
                  width: `${totalStatus > 0 ? (metrics.skip / totalStatus) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-slate-300"
                style={{
                  width: `${totalStatus > 0 ? (metrics.notRun / totalStatus) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            {statusCards.map((item) => {
              const percent =
                totalStatus > 0
                  ? Math.round((item.value / totalStatus) * 100)
                  : 0;
              return (
                <div
                  key={item.label}
                  className="flex min-h-40 flex-col justify-between rounded-lg bg-slate-50 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-full bg-white p-2 shadow-sm">
                      <item.icon size={22} className={item.color} />
                    </div>
                    <span className={`text-4xl font-semibold ${item.color}`}>
                      {item.value}
                    </span>
                  </div>
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-500">
                        {item.label}
                      </p>
                      <p className="text-xs font-medium text-slate-400">
                        {percent}%
                      </p>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${item.bar}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Projects
            </h2>
          </div>
          {displayedProjects.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Belum ada project.
            </div>
          ) : (
            <>
              {displayedProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="flex w-full items-center gap-3 border-b border-slate-50 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <FolderOpen size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {project.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {project.description || "Tidak ada deskripsi"}
                    </p>
                  </div>
                </button>
              ))}
              <PaginationControls
                page={projectsPage}
                total={projectList.length}
                pageSize={5}
                onPageChange={setProjectsPage}
              />
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Recording Sessions
            </h2>
          </div>
          {recentRecordings.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Belum ada recording session tersimpan.
            </div>
          ) : (
            <>
              {displayedRecordings.map((session) => (
                <button
                  key={session.id}
                  onClick={() => openRecordingDetail(session)}
                  className="flex w-full items-center gap-3 border-b border-slate-50 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Radio size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {session.title || session.name || "Untitled recording"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {session.step_count
                        ? `${session.step_count} steps · `
                        : ""}
                      {session.target_url || session.url || "-"}
                    </p>
                  </div>
                </button>
              ))}
              <PaginationControls
                page={recordingsPage}
                total={recentRecordings.length}
                pageSize={5}
                onPageChange={setRecordingsPage}
              />
            </>
          )}
        </section>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Test Runs
            </h2>
          </div>
          {recentRuns.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Belum ada test run.
            </div>
          ) : (
            <>
              {displayedRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between border-b border-slate-50 px-5 py-4"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {run.name}
                  </p>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600">
                    {formatStatusLabel(run.status)}
                  </span>
                </div>
              ))}
              <PaginationControls
                page={runsPage}
                total={recentRuns.length}
                pageSize={5}
                onPageChange={setRunsPage}
              />
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent Defects
            </h2>
          </div>
          {recentDefects.length === 0 ? (
            <div className="px-5 py-8 text-sm text-slate-400">
              Belum ada defect.
            </div>
          ) : (
            <>
              {displayedDefects.map((defect) => (
                <div
                  key={defect.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-50 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {defect.issue_id || defect.def_id
                        ? `${defect.issue_id || defect.def_id} · `
                        : ""}
                      {defect.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {labelize(
                        normalizeDefectPriority(
                          defect.priority || defect.severity,
                        ),
                      )}{" "}
                      · {labelize(normalizeDefectStatus(defect.status))}
                    </p>
                  </div>
                  <ShieldAlert size={17} className="text-red-500" />
                </div>
              ))}
              <PaginationControls
                page={defectsPage}
                total={recentDefects.length}
                pageSize={5}
                onPageChange={setDefectsPage}
              />
            </>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Test Cases
          </h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : testCases.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Belum ada test case terbaru.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    TC ID
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Title
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Project
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Priority
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedTestCases.map((tc) => (
                  <tr
                    key={tc.id}
                    className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50"
                    onClick={() => navigate(`/projects/${tc.project_id}`)}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {tc.tc_id || tc.test_case_code || "-"}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {tc.title}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-700">
                        {getProjectName(tc.project_id)}
                      </p>
                      {(tc.module || tc.module_id) && (
                        <p className="text-xs text-slate-400">
                          {tc.module || tc.module_id}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {formatStatusLabel(tc.priority)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusPill(tc.status)}`}
                      >
                        {formatStatusLabel(tc.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={testCasesPage}
              total={testCases.length}
              pageSize={10}
              onPageChange={setTestCasesPage}
            />
          </div>
        )}
      </section>

      {selectedRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
                1
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-slate-700">
                  {selectedRecording.title ||
                    selectedRecording.name ||
                    "Belum diberi judul..."}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedRecordingSteps.length} langkah ·{" "}
                  {selectedRecording.created_at
                    ? new Date(selectedRecording.created_at).toLocaleString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "-"}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedRecording(null);
                  setSelectedRecordingSteps([]);
                }}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[calc(92vh-72px)] overflow-y-auto">
              <div className="flex border-b border-slate-100 px-6">
                {(["steps", "selenium"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRecordingTab(tab)}
                    className={`px-5 py-3 text-xs font-semibold transition ${
                      recordingTab === tab
                        ? "border-b-2 border-emerald-500 text-emerald-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab === "steps"
                      ? `Steps (${selectedRecordingSteps.length})`
                      : "Selenium Java"}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {recordingLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                  </div>
                ) : recordingTab === "steps" ? (
                  <CodePanel
                    label="steps"
                    code={generateRecordingStepsText(selectedRecordingSteps)}
                    copyKey="steps"
                    copiedKey={copiedRecordingTab}
                    onCopy={copyRecordingCode}
                  />
                ) : (
                  <div>
                    <div className="mb-4 flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
                      {(["feature", "steps", "page"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setSeleniumTab(tab)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                            seleniumTab === tab
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {tab === "feature"
                            ? "Feature"
                            : tab === "steps"
                              ? "Steps"
                              : "Page"}
                        </button>
                      ))}
                    </div>
                    <p className="mb-2 text-xs text-slate-400">
                      {seleniumTab === "feature"
                        ? "features/*.feature"
                        : seleniumTab === "steps"
                          ? "steps/*Steps.java"
                          : "pages/*Page.java"}
                    </p>
                    <CodePanel
                      label={
                        seleniumTab === "feature"
                          ? "gherkin"
                          : seleniumTab === "steps"
                            ? "java steps"
                            : "java page"
                      }
                      code={
                        getSeleniumJavaParts(
                          selectedRecording,
                          selectedRecordingSteps,
                        )[seleniumTab]
                      }
                      copyKey={`selenium-${seleniumTab}`}
                      copiedKey={copiedRecordingTab}
                      onCopy={copyRecordingCode}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
