import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, X, Check, Copy, Radio } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  normalizeTestCasePriority,
  normalizeTestCaseStatus,
} from "../lib/domain";
import { formatTestCaseCode } from "../lib/testCaseCode";
import { getUserDisplayName } from "../lib/userProfile";
import { useAuth } from "../hooks/useAuth";
import { CustomSelect } from "../components/CustomSelect";
import { Project } from "../types";

interface RecorderStep {
  type: "click" | "type" | "nav" | "scroll" | "notification";
  target?: string;
  value?: string;
  url?: string;
  scrollY?: number;
  message?: string;
  id?: string;
  name?: string;
  className?: string;
  xpath?: string;
  cssSelector?: string;
  inputType?: string;
  tag?: string;
  timestamp: number;
}

interface Session {
  id: number;
  steps: RecorderStep[];
  stepCount: number;
  url: string;
  timestamp: string;
}

interface SessionForm {
  title: string;
  priority: string;
  tester: string;
  module: string;
}

const STEP_COLORS: Record<string, string> = {
  nav: "bg-emerald-100 text-emerald-700",
  click: "bg-blue-100 text-blue-700",
  type: "bg-purple-100 text-purple-700",
  scroll: "bg-amber-100 text-amber-700",
  notification: "bg-orange-100 text-orange-700",
};

// ── String helpers ────────────────────────────────────────────────────────────
function toClassName(str: string): string {
  return (
    (str || "Test")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("")
      .slice(0, 40) || "Test"
  );
}

function toMethodName(str: string): string {
  return (
    (str || "element")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .map((w, i) =>
        i === 0
          ? w.toLowerCase()
          : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
      .join("")
      .slice(0, 40) || "element"
  );
}

function toConstName(str: string): string {
  return (
    (str || "ELEMENT")
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .slice(0, 4)
      .join("_")
      .slice(0, 40) || "ELEMENT"
  );
}

// ── Gherkin ───────────────────────────────────────────────────────────────────
function generateGherkin(steps: RecorderStep[]): string {
  const lines = [
    "Feature: Pengujian Aplikasi Web",
    "",
    "  Scenario: Skenario hasil rekaman QA",
  ];
  steps.forEach((step, i) => {
    let keyword = i === 0 ? "Given" : "And";
    let text = "";
    if (step.type === "nav") {
      text = `buka halaman "${step.url}"`;
    } else if (step.type === "click") {
      keyword = i === 0 ? "Given" : "When";
      text = `klik "${step.target}"`;
    } else if (step.type === "type") {
      text = `isi field "${step.target}" dengan "${step.value}"`;
    } else if (step.type === "scroll") {
      text = `scroll ke posisi ${step.scrollY}px`;
    } else if (step.type === "notification") {
      keyword = "Then";
      text = `muncul notifikasi "${step.message}"`;
    }
    lines.push(`    ${keyword} ${text}`);
  });
  return lines.join("\n");
}

function stepsToText(steps: RecorderStep[]): string {
  return steps
    .map((s, i) => {
      if (s.type === "nav") return `${i + 1}. Buka halaman ${s.url}`;
      if (s.type === "click") return `${i + 1}. Klik "${s.target}"`;
      if (s.type === "type")
        return `${i + 1}. Isi field "${s.target}" dengan "${s.value}"`;
      if (s.type === "scroll") return `${i + 1}. Scroll ke ${s.scrollY}px`;
      if (s.type === "notification")
        return `${i + 1}. Notifikasi muncul: "${s.message}"`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

// ── Feature file ──────────────────────────────────────────────────────────────
function generateFeatureFile(
  steps: RecorderStep[],
  title: string,
  module: string,
): string {
  const lines: string[] = [];
  lines.push(`Feature: ${module || "General"}`);
  lines.push(``);
  lines.push(`  Scenario: ${title}`);

  steps.forEach((step, i) => {
    let keyword = i === 0 ? "Given" : "And";
    let text = "";
    if (step.type === "nav") {
      text = `I am on the page "${step.url}"`;
    } else if (step.type === "click") {
      keyword = i === 0 ? "Given" : "When";
      text = `I click the "${step.target}" button`;
    } else if (step.type === "type") {
      keyword = "When";
      const val = step.value === "••••••••" ? "password" : step.value || "";
      text = `I enter "${step.target}" with value "${val}"`;
    } else if (step.type === "scroll") {
      text = `I scroll the page to position ${step.scrollY}`;
    } else if (step.type === "notification") {
      keyword = "Then";
      text = `I should see notification "${step.message}"`;
    }
    lines.push(`    ${keyword} ${text}`);
  });

  return lines.join("\n");
}

// ── Page class ────────────────────────────────────────────────────────────────
function generatePageClass(steps: RecorderStep[], title: string): string {
  const className = toClassName(title) + "Page";
  const lines: string[] = [];

  // ── Kumpulkan elemen unik ─────────────────────────────────────────────────
  const usedConst = new Set<string>();
  const elements: { constName: string; locator: string; step: RecorderStep }[] =
    [];

  function getLocatorForStep(step: RecorderStep): string {
    if (step.id) return `By.id("${step.id}")`;
    if (step.name) return `By.name("${step.name}")`;
    if (step.className) return `By.className("${step.className}")`;
    if (step.cssSelector) return `By.cssSelector("${step.cssSelector}")`;
    if (step.xpath) return `By.xpath("${step.xpath}")`;
    return `By.tagName("${step.tag || "div"}")`;
  }

  function addElement(constName: string, step: RecorderStep) {
    if (usedConst.has(constName)) return constName;
    usedConst.add(constName);
    elements.push({ constName, locator: getLocatorForStep(step), step });
    return constName;
  }

  steps.forEach((step) => {
    if (step.type === "nav" || step.type === "scroll") return;

    if (step.type === "click" || step.type === "type") {
      let constName = toConstName(step.target || "element");
      // Hindari duplikat dengan suffix _BTN atau _FIELD
      if (usedConst.has(constName)) {
        constName = constName + (step.type === "click" ? "_BTN" : "_FIELD");
      }
      addElement(constName, step);
    }

    if (step.type === "notification") {
      const notifBase = step.id
        ? toConstName(step.id)
        : step.className
          ? toConstName(step.className)
          : "NOTIFICATION";
      const constName = usedConst.has(notifBase) ? notifBase : notifBase;
      if (!usedConst.has(constName)) {
        usedConst.add(constName);
        elements.push({
          constName,
          locator: step.id
            ? `By.id("${step.id}")`
            : step.className
              ? `By.className("${step.className}")`
              : step.cssSelector
                ? `By.cssSelector("${step.cssSelector}")`
                : `By.xpath("${step.xpath || "//div"}")`,
          step,
        });
      }
    }
  });

  const navStep = steps.find((s) => s.type === "nav");

  // ── Imports ───────────────────────────────────────────────────────────────
  lines.push(`package pages;`);
  lines.push(``);
  lines.push(`import org.openqa.selenium.By;`);
  lines.push(`import org.openqa.selenium.WebDriver;`);
  lines.push(`import utils.ConfigReader;`);
  lines.push(``);

  // ── Class declaration ─────────────────────────────────────────────────────
  lines.push(`public class ${className} extends BasePage {`);
  lines.push(``);

  // ── Locator declarations ──────────────────────────────────────────────────
  elements.forEach((el) => {
    lines.push(`    private final By ${el.constName} = ${el.locator};`);
  });

  lines.push(``);
  // ── Constructor ───────────────────────────────────────────────────────────
  lines.push(`    public ${className}(WebDriver driver) {`);
  lines.push(`        super(driver);`);
  lines.push(`    }`);
  lines.push(``);

  // ── openPage ──────────────────────────────────────────────────────────────
  if (navStep) {
    lines.push(`    public void openPage() {`);
    lines.push(`        String baseUrl = ConfigReader.get("base.url");`);
    lines.push(`        System.out.println("Opening page: " + baseUrl);`);
    lines.push(`        driver.get("${navStep.url}");`);
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    public boolean isPageDisplayed() {`);
    if (elements.length > 0) {
      lines.push(`        return isVisible(${elements[0].constName});`);
    } else {
      lines.push(
        `        return driver.getCurrentUrl().contains("${navStep.url}");`,
      );
    }
    lines.push(`    }`);
    lines.push(``);
  }

  // ── Methods per step ──────────────────────────────────────────────────────
  steps.forEach((step) => {
    if (step.type === "nav" || step.type === "scroll") return;

    if (step.type === "click") {
      let constName = toConstName(step.target || "element");
      if (!usedConst.has(constName)) constName = constName + "_BTN";

      lines.push(
        `    public void click${toClassName(step.target || "element")}() {`,
      );
      lines.push(`        System.out.println("Clicking: ${step.target}");`);
      lines.push(`        click(${constName});`);
      lines.push(`    }`);
      lines.push(``);
    }

    if (step.type === "type") {
      let constName = toConstName(step.target || "element");
      if (!usedConst.has(constName)) constName = constName + "_FIELD";

      lines.push(
        `    public void enter${toClassName(step.target || "element")}(String value) {`,
      );
      lines.push(
        `        System.out.println("Entering ${step.target}: " + value);`,
      );
      lines.push(`        type(${constName}, value);`);
      lines.push(`    }`);
      lines.push(``);
    }

    if (step.type === "notification") {
      const notifBase = step.id
        ? toConstName(step.id)
        : step.className
          ? toConstName(step.className)
          : "NOTIFICATION";

      lines.push(`    public boolean isNotificationDisplayed() {`);
      lines.push(
        `        System.out.println("Checking notification visibility");`,
      );
      lines.push(`        return isVisible(${notifBase});`);
      lines.push(`    }`);
      lines.push(``);
      lines.push(`    public String getNotificationMessage() {`);
      lines.push(`        System.out.println("Getting notification message");`);
      lines.push(`        return getText(${notifBase});`);
      lines.push(`    }`);
      lines.push(``);
    }
  });

  lines.push(`}`);
  return lines.join("\n");
}

// ── Steps class ───────────────────────────────────────────────────────────────
function generateStepsClass(
  steps: RecorderStep[],
  title: string,
): string {
  const className = toClassName(title) + "Steps";
  const pageClass = toClassName(title) + "Page";
  const pageVar = toMethodName(title) + "Page";
  const lines: string[] = [];

  lines.push(`package steps;`);
  lines.push(``);
  lines.push(`import io.cucumber.java.en.*;`);
  lines.push(`import org.testng.Assert;`);
  lines.push(`import pages.${pageClass};`);
  lines.push(`import utils.DriverFactory;`);
  lines.push(`import utils.EnvReader;`);
  lines.push(``);
  lines.push(`public class ${className} {`);
  lines.push(``);
  lines.push(
    `    ${pageClass} ${pageVar} = new ${pageClass}(DriverFactory.getDriver());`,
  );
  lines.push(``);

  steps.forEach((step) => {
    if (step.type === "nav") {
      lines.push(`    @Given("I am on the page \\"${step.url}\\"")`);
      lines.push(`    public void i_am_on_the_page() {`);
      lines.push(`        ${pageVar}.openPage();`);
      lines.push(`        Assert.assertTrue(`);
      lines.push(`            ${pageVar}.isPageDisplayed(),`);
      lines.push(`            "Halaman tidak tampil"`);
      lines.push(`        );`);
      lines.push(`    }`);
    } else if (step.type === "click") {
      const methodSuffix = toClassName(step.target || "element");
      const stepMethod = `i_click_${toMethodName(step.target || "element")}`;
      lines.push(`    @When("I click the \\"${step.target}\\" button")`);
      lines.push(`    public void ${stepMethod}() {`);
      lines.push(`        ${pageVar}.click${methodSuffix}();`);
      lines.push(`    }`);
    } else if (step.type === "type") {
      const methodSuffix = toClassName(step.target || "element");
      const stepMethod = `i_enter_${toMethodName(step.target || "field")}`;
      const envKey = toMethodName(step.target || "field");
      const val = step.value === "••••••••" ? "password" : step.value || "";
      lines.push(
        `    @When("I enter \\"${step.target}\\" with value \\"${val}\\"")`,
      );
      lines.push(`    public void ${stepMethod}() {`);
      lines.push(`        String value = EnvReader.get("${envKey}");`);
      lines.push(`        ${pageVar}.enter${methodSuffix}(value);`);
      lines.push(`    }`);
    } else if (step.type === "scroll") {
      lines.push(`    @And("I scroll the page to position ${step.scrollY}")`);
      lines.push(`    public void i_scroll_page() {`);
      lines.push(
        `        ((org.openqa.selenium.JavascriptExecutor) DriverFactory.getDriver())`,
      );
      lines.push(
        `            .executeScript("window.scrollTo(0, ${step.scrollY});");`,
      );
      lines.push(`    }`);
    }

    lines.push(``);
  });

  lines.push(`    @Then("I should see the expected result")`);
  lines.push(`    public void i_should_see_expected_result() {`);
  lines.push(`        Assert.assertTrue(`);
  lines.push(`            ${pageVar}.isPageDisplayed(),`);
  lines.push(`            "Expected result tidak tampil"`);
  lines.push(`        );`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`}`);
  return lines.join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Recorder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const defaultTester = getUserDisplayName(user);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [forms, setForms] = useState<Record<number, SessionForm>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    Record<number, "steps" | "gherkin" | "selenium">
  >({});
  const [seleniumTab, setSeleniumTab] = useState<
    Record<number, "feature" | "steps" | "page">
  >({});

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [persistenceWarning, setPersistenceWarning] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  // ── Parse sessions dari URL ─────────────────────────────────────────────────
  useEffect(() => {
    const raw = searchParams.get("sessions");
    if (!raw) return;
    try {
      const parsed: Session[] = JSON.parse(decodeURIComponent(raw));
      setSessions(parsed);

      const initForms: Record<number, SessionForm> = {};
      const initTabs: Record<number, "steps" | "gherkin" | "selenium"> = {};
      const initSelTabs: Record<number, "feature" | "steps" | "page"> = {};

      parsed.forEach((s) => {
        const navStep = s.steps?.find((st) => st.type === "nav");
        let module = "General";
        if (navStep?.url) {
          try {
            module =
              new URL(navStep.url).pathname.split("/").filter(Boolean)[0] ||
              "General";
          } catch {
            module = "General";
          }
        }
        initForms[s.id] = {
          title: "",
          priority: "medium",
          tester: defaultTester,
          module,
        };
        initTabs[s.id] = "steps";
        initSelTabs[s.id] = "feature";
      });

      setForms(initForms);
      setActiveTab(initTabs);
      setSeleniumTab(initSelTabs);
      if (parsed.length > 0) setExpandedId(parsed[0].id);
      setSearchParams({});
    } catch (e) {
      console.error("Failed to parse sessions:", e);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!defaultTester) return;
    setForms((prev) => {
      let changed = false;
      const next = Object.fromEntries(
        Object.entries(prev).map(([id, form]) => {
          if (form.tester) return [id, form];
          changed = true;
          return [id, { ...form, tester: defaultTester }];
        }),
      );
      return changed ? next : prev;
    });
  }, [defaultTester]);

  async function fetchProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setProjects(data);
  }

  function updateForm(id: number, field: keyof SessionForm, value: string) {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function setTab(id: number, tab: "steps" | "gherkin" | "selenium") {
    setActiveTab((prev) => ({ ...prev, [id]: tab }));
  }

  function setSelTab(id: number, tab: "feature" | "steps" | "page") {
    setSeleniumTab((prev) => ({ ...prev, [id]: tab }));
  }

  function removeSession(id: number) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setForms((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  }

  function copyCode(key: number, code: string) {
    navigator.clipboard.writeText(code);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function persistRecordingSession(session: Session) {
    const form = forms[session.id];
    const gherkin = generateGherkin(session.steps);
    const title = form.title.trim();
    const navStep = session.steps.find((step) => step.type === "nav");

    const { data, error } = await supabase
      .from("recording_sessions")
      .insert({
        project_id: selectedProject,
        title,
        module: form.module || "General",
        description: gherkin,
        target_url: navStep?.url || session.url || "",
        browser: "Chrome Extension",
        status: "RECORDED",
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      console.warn("Recording session persistence skipped:", error);
      return false;
    }

    const stepRows = session.steps.map((step, index) => ({
      recording_session_id: data.id,
      step_order: index + 1,
      action_type: step.type.toUpperCase(),
      target_text: step.target || step.message || "",
      value: step.value || "",
      url: step.url || "",
      locator_css: step.cssSelector || null,
      locator_xpath: step.xpath || null,
      timestamp: step.timestamp
        ? new Date(step.timestamp).toISOString()
        : new Date().toISOString(),
    }));

    const { error: stepsError } = await supabase
      .from("recording_steps")
      .insert(stepRows);

    if (stepsError) {
      console.warn("Recording steps persistence skipped:", stepsError);
      return false;
    }

    return true;
  }

  async function saveAll() {
    if (!selectedProject) return;
    const toSave = sessions.filter((s) => forms[s.id]?.title?.trim());
    if (toSave.length === 0) return;
    setSaving(true);
    setPersistenceWarning("");

    const { data: existing } = await supabase
      .from("test_cases")
      .select("id")
      .eq("project_id", selectedProject);
    const baseCount = existing?.length || 0;
    const selectedProjectName = projects.find((p) => p.id === selectedProject)?.name;

    const inserts = toSave.map((session, i) => {
      const form = forms[session.id];
      return {
        project_id: selectedProject,
        tc_id: formatTestCaseCode(selectedProjectName, baseCount + i + 1),
        module: form.module || "General",
        title: form.title.trim(),
        steps: stepsToText(session.steps),
        expected_result: generateGherkin(session.steps),
        priority: normalizeTestCasePriority(form.priority),
        status: normalizeTestCaseStatus("not_run"),
        tester: form.tester,
      };
    });

    const recordingResults = await Promise.all(
      toSave.map((session) => persistRecordingSession(session)),
    );
    const { error } = await supabase.from("test_cases").insert(inserts);
    setSaving(false);
    if (!error) {
      if (recordingResults.some((ok) => !ok)) {
        setPersistenceWarning(
          "Test case tersimpan. Tabel recording_sessions/recording_steps belum siap atau skemanya berbeda, jadi session recorder belum tersimpan penuh.",
        );
      }
      setSaved(true);
      setTimeout(() => {
        setSessions([]);
        setForms({});
        setSaved(false);
        setPersistenceWarning("");
      }, 2000);
    }
  }

  const readyCount = sessions.filter((s) => forms[s.id]?.title?.trim()).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <Radio size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Web Recorder
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Hasil rekaman dari Chrome Extension — isi judul tiap test case
              lalu simpan session recorder dan test case ke project
            </p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-16 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <div className="w-4 h-4 bg-red-400 rounded-full" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Belum ada data rekaman
          </p>
          <p className="text-xs text-gray-400 leading-relaxed mb-4">
            Buka <strong>Chrome Extension HavoX Recorder</strong> di toolbar
            browser.
            <br />
            Klik <strong>Start</strong> → lakukan pengujian → klik{" "}
            <strong>Stop</strong> (= 1 test case).
            <br />
            Ulangi untuk test case berikutnya, lalu klik{" "}
            <strong>"Kirim ke HavoX App"</strong>.
          </p>
          <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            Menunggu data dari extension...
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Project selector + simpan */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-end gap-4">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                Simpan ke Project
              </label>
              <CustomSelect
                value={selectedProject}
                onChange={setSelectedProject}
                options={[
                  { value: "", label: "Pilih project..." },
                  ...projects.map((p) => ({ value: p.id, label: p.name })),
                ]}
                triggerClassName="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 bg-white"
              />
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-semibold text-emerald-600">
                {readyCount}
              </div>
              <div className="text-xs text-gray-400">
                dari {sessions.length} siap
              </div>
            </div>
            <button
              onClick={saveAll}
              disabled={!selectedProject || readyCount === 0 || saving || saved}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saved ? <Check size={15} /> : <Save size={15} />}
              {saving
                ? "Menyimpan..."
                : saved
                  ? "Tersimpan!"
                  : `Simpan ${readyCount} TC`}
            </button>
          </div>

          {persistenceWarning && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {persistenceWarning}
            </div>
          )}

          {/* Sessions */}
          {sessions.map((session, idx) => {
            const form = forms[session.id] || {
              title: "",
              priority: "medium",
              tester: defaultTester,
              module: "General",
            };
            const isExpanded = expandedId === session.id;
            const hasTitle = form.title.trim().length > 0;
            const tab = activeTab[session.id] || "steps";
            const selTab = seleniumTab[session.id] || "feature";

            const featureCode = generateFeatureFile(
              session.steps,
              form.title || `TC ${idx + 1}`,
              form.module,
            );
            const stepsCode = generateStepsClass(
              session.steps,
              form.title || `TC ${idx + 1}`,
            );
            const pageCode = generatePageClass(
              session.steps,
              form.title || `TC ${idx + 1}`,
            );
            const gherkinCode = generateGherkin(session.steps);

            const copyKey = (sub: number) => session.id * 100 + sub;

            return (
              <div
                key={session.id}
                className={`bg-white border rounded-xl overflow-hidden ${hasTitle ? "border-emerald-200" : "border-gray-200"}`}
              >
                {/* Header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 select-none"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${hasTitle ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${hasTitle ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {form.title || "Belum diberi judul..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {session.stepCount} langkah · {session.timestamp}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSession(session.id);
                    }}
                    className="p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                  <span className="text-xs text-gray-300 ml-1">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Form */}
                    <div className="p-5 grid grid-cols-2 gap-4 border-b border-gray-50">
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Judul Test Case *
                          </label>
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) =>
                              updateForm(session.id, "title", e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder="contoh: Login dengan email valid"
                            autoFocus={idx === 0}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Module
                          </label>
                          <input
                            type="text"
                            value={form.module}
                            onChange={(e) =>
                              updateForm(session.id, "module", e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Login, Dashboard..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 content-start">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Priority
                          </label>
                          <div onClick={(e) => e.stopPropagation()}>
                            <CustomSelect
                              value={form.priority}
                              onChange={(value) =>
                                updateForm(session.id, "priority", value)
                              }
                              options={[
                                { value: "critical", label: "Critical" },
                                { value: "high", label: "High" },
                                { value: "medium", label: "Medium" },
                                { value: "low", label: "Low" },
                              ]}
                              triggerClassName="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Tester
                          </label>
                          <input
                            type="text"
                            value={form.tester}
                            onChange={(e) =>
                              updateForm(session.id, "tester", e.target.value)
                            }
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Nama tester"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Main tabs */}
                    <div className="flex border-b border-gray-100">
                      {(["steps", "gherkin", "selenium"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTab(session.id, t);
                          }}
                          className={`px-5 py-2.5 text-xs font-medium transition-colors ${
                            tab === t
                              ? "text-emerald-600 border-b-2 border-emerald-500 bg-white"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                        >
                          {t === "steps"
                            ? `Steps (${session.steps.length})`
                            : t === "gherkin"
                              ? "Gherkin"
                              : "Selenium Java"}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="p-5">
                      {/* STEPS */}
                      {tab === "steps" && (
                        <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                          {session.steps.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">
                              Tidak ada langkah
                            </p>
                          ) : (
                            session.steps.map((step, i) => {
                              let text = "";
                              if (step.type === "nav")
                                text = `Buka: ${step.url}`;
                              else if (step.type === "click")
                                text = `Klik "${step.target}"${step.id ? ` [id="${step.id}"]` : step.cssSelector ? ` [${step.cssSelector}]` : ""}`;
                              else if (step.type === "type")
                                text = `Isi field "${step.target}" → "${step.value}"${step.id ? ` [id="${step.id}"]` : step.name ? ` [name="${step.name}"]` : ""}`;
                              else if (step.type === "scroll")
                                text = `Scroll ${step.scrollY}px`;
                              else if (step.type === "notification")
                                text = `Notifikasi: "${step.message}"`;
                              return (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2"
                                >
                                  <span className="text-xs text-gray-400 min-w-5 flex-shrink-0 mt-0.5">
                                    {i + 1}.
                                  </span>
                                  <span className="text-xs text-gray-700 flex-1 leading-relaxed">
                                    {text}
                                  </span>
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${STEP_COLORS[step.type] || ""}`}
                                  >
                                    {step.type}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* GHERKIN */}
                      {tab === "gherkin" && (
                        <div>
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => copyCode(copyKey(1), gherkinCode)}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                            >
                              <Copy size={12} />
                              {copied === copyKey(1) ? "Tersalin!" : "Salin"}
                            </button>
                          </div>
                          <pre className="bg-gray-900 text-gray-300 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto max-h-56 overflow-y-auto whitespace-pre-wrap">
                            {gherkinCode}
                          </pre>
                        </div>
                      )}

                      {/* SELENIUM */}
                      {tab === "selenium" && (
                        <div>
                          {/* Sub-tabs */}
                          <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1 w-fit">
                            {(["feature", "steps", "page"] as const).map(
                              (st) => (
                                <button
                                  key={st}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelTab(session.id, st);
                                  }}
                                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                    selTab === st
                                      ? "bg-white text-gray-900 shadow-sm"
                                      : "text-gray-500 hover:text-gray-700"
                                  }`}
                                >
                                  {st === "feature"
                                    ? "📄 Feature"
                                    : st === "steps"
                                      ? "🔧 Steps"
                                      : "📋 Page"}
                                </button>
                              ),
                            )}
                          </div>

                          {/* Copy */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-400">
                              {selTab === "feature"
                                ? "features/*.feature"
                                : selTab === "steps"
                                  ? `steps/${toClassName(form.title || "Test")}Steps.java`
                                  : `pages/${toClassName(form.title || "Test")}Page.java`}
                            </span>
                            <button
                              onClick={() => {
                                const code =
                                  selTab === "feature"
                                    ? featureCode
                                    : selTab === "steps"
                                      ? stepsCode
                                      : pageCode;
                                const key =
                                  selTab === "feature"
                                    ? copyKey(2)
                                    : selTab === "steps"
                                      ? copyKey(3)
                                      : copyKey(4);
                                copyCode(key, code);
                              }}
                              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
                            >
                              <Copy size={12} />
                              {[copyKey(2), copyKey(3), copyKey(4)].includes(
                                copied ?? -1,
                              )
                                ? "Tersalin!"
                                : "Salin"}
                            </button>
                          </div>

                          {/* Code */}
                          <pre className="bg-gray-900 text-gray-300 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap font-mono">
                            {selTab === "feature"
                              ? featureCode
                              : selTab === "steps"
                                ? stepsCode
                                : pageCode}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
