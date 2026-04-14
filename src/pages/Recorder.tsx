import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Save, RefreshCw, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Project, RecorderStep } from "../types";

function generateGherkin(steps: RecorderStep[]): string {
  if (steps.length === 0) return "";

  const lines: string[] = ["Scenario: Skenario hasil rekaman QA"];

  steps.forEach((step, i) => {
    let keyword = "And";
    let text = "";

    if (i === 0) keyword = "Given";

    if (step.type === "nav") {
      if (i === 0) keyword = "Given";
      else keyword = "And";
      text = `buka halaman "${step.url}"`;
    } else if (step.type === "click") {
      keyword = i === 0 ? "Given" : "When";
      text = `klik tombol "${step.target}"`;
    } else if (step.type === "type") {
      keyword = "And";
      text = `isi field "${step.target}" dengan "${step.value}"`;
    } else if (step.type === "scroll") {
      keyword = "And";
      text = `scroll halaman ke posisi ${step.scrollY}px`;
    }

    lines.push(`    ${keyword} ${text}`);
  });

  return lines.join("\n");
}

function stepsToTestCaseFields(steps: RecorderStep[], gherkin: string) {
  const navStep = steps.find((s) => s.type === "nav");
  const module = navStep?.url
    ? new URL(navStep.url).pathname.split("/").filter(Boolean)[0] || "General"
    : "General";

  const stepsText = steps
    .map((s, i) => {
      if (s.type === "nav") return `${i + 1}. Buka halaman ${s.url}`;
      if (s.type === "click") return `${i + 1}. Klik tombol, "${s.target}"`;
      if (s.type === "type")
        return `${i + 1}. Isi field "${s.target}" dengan "${s.value}"`;
      if (s.type === "scroll") return `${i + 1}. Scroll ke ${s.scrollY}px`;
      return "";
    })
    .join("\n");

  return { module, steps: stepsText, gherkin };
}

export default function Recorder() {
  const [searchParams] = useSearchParams();
  const [steps, setSteps] = useState<RecorderStep[]>([]);
  const [gherkin, setGherkin] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tcTitle, setTcTitle] = useState("");
  const [tcPriority, setTcPriority] = useState("medium");
  const [tester, setTester] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "gherkin">("steps");

  useEffect(() => {
    fetchProjects();

    const raw = searchParams.get("steps");
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        setSteps(parsed);
        setGherkin(generateGherkin(parsed));
      } catch (e) {
        console.error("Failed to parse steps", e);
      }
    }

    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["qaforge_steps"], (data) => {
        if (data.qaforge_steps?.length && !raw) {
          setSteps(data.qaforge_steps);
          setGherkin(generateGherkin(data.qaforge_steps));
        }
      });
    }
  }, []);

  async function fetchProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setProjects(data);
  }

  async function saveToTestCase() {
    if (!selectedProject || !tcTitle.trim()) return;
    setSaving(true);

    const {
      module,
      steps: stepsText,
      gherkin: gherkinText,
    } = stepsToTestCaseFields(steps, gherkin);

    // Hitung TC ID berikutnya
    const { data: existing } = await supabase
      .from("test_cases")
      .select("id")
      .eq("project_id", selectedProject);
    const nextId = `TC-${String((existing?.length || 0) + 1).padStart(3, "0")}`;

    const { error } = await supabase.from("test_cases").insert({
      project_id: selectedProject,
      tc_id: nextId,
      module: module,
      title: tcTitle,
      steps: stepsText,
      expected_result: gherkinText,
      priority: tcPriority,
      status: "not_run",
      tester: tester,
    });

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const STEP_COLORS: Record<string, string> = {
    nav: "bg-emerald-100 text-emerald-700",
    click: "bg-blue-100 text-blue-700",
    type: "bg-purple-100 text-purple-700",
    scroll: "bg-amber-100 text-amber-700",
  };

  function stepText(step: RecorderStep) {
    if (step.type === "nav") return `Buka halaman: ${step.url}`;
    if (step.type === "click") return `Klik "${step.target}"`;
    if (step.type === "type")
      return `Isi "${step.target}" dengan "${step.value}"`;
    if (step.type === "scroll") return `Scroll ke ${step.scrollY}px`;
    return "";
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Web Recorder</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Hasil rekaman dari Chrome Extension — simpan langsung sebagai test
          case
        </p>
      </div>

      {steps.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={20} className="text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Belum ada data rekaman
          </p>
          <p className="text-xs text-gray-400">
            Gunakan Chrome Extension QAForge Recorder, rekam pengujian, lalu
            klik "Kirim ke QAForge App"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Kiri — Steps & Gherkin */}
          <div className="flex flex-col gap-4">
            {/* Tab switcher */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("steps")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "steps"
                      ? "bg-white text-gray-900 border-b-2 border-emerald-500"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Steps ({steps.length})
                </button>
                <button
                  onClick={() => setActiveTab("gherkin")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === "gherkin"
                      ? "bg-white text-gray-900 border-b-2 border-emerald-500"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Gherkin
                </button>
              </div>

              {activeTab === "steps" ? (
                <div className="p-4 flex flex-col gap-2 max-h-96 overflow-y-auto">
                  {steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-xs text-gray-400 min-w-5 mt-0.5">
                        {i + 1}.
                      </span>
                      <span className="text-sm text-gray-700 flex-1">
                        {stepText(step)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          STEP_COLORS[step.type]
                        }`}
                      >
                        {step.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4">
                  <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs leading-relaxed overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {gherkin}
                  </pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(gherkin)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Salin ke clipboard
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kanan — Simpan ke Test Case */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Simpan sebagai Test Case
            </h2>

            <div className="flex flex-col gap-3">
              {/* Pilih Project */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Project
                </label>
                <div className="relative">
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 appearance-none bg-white"
                  >
                    <option value="">Pilih project...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Judul Test Case */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Judul Test Case
                </label>
                <input
                  type="text"
                  value={tcTitle}
                  onChange={(e) => setTcTitle(e.target.value)}
                  placeholder="contoh: Login dengan kredensial valid"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Priority
                </label>
                <div className="relative">
                  <select
                    value={tcPriority}
                    onChange={(e) => setTcPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 appearance-none bg-white"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Tester */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Tester
                </label>
                <input
                  type="text"
                  value={tester}
                  onChange={(e) => setTester(e.target.value)}
                  placeholder="Nama tester"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                />
              </div>

              {/* Preview info */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Total steps</span>
                  <span className="font-medium text-gray-700">
                    {steps.length} langkah
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Steps akan disimpan di</span>
                  <span className="font-medium text-gray-700">
                    kolom "Steps"
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Gherkin akan disimpan di</span>
                  <span className="font-medium text-gray-700">
                    kolom "Expected Result"
                  </span>
                </div>
              </div>

              {/* Tombol simpan */}
              <button
                onClick={saveToTestCase}
                disabled={!selectedProject || !tcTitle.trim() || saving}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={15} />
                {saving
                  ? "Menyimpan..."
                  : saved
                  ? "Tersimpan!"
                  : "Simpan ke Test Case"}
              </button>

              {saved && (
                <p className="text-xs text-emerald-600 text-center">
                  Test case berhasil disimpan. Cek di menu Test Cases.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
