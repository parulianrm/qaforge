import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { TestCase, Project } from "../types";
import * as XLSX from "xlsx";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-700",
  fail: "bg-red-100 text-red-700",
  skip: "bg-gray-100 text-gray-600",
  not_run: "bg-gray-100 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  pass: "Pass",
  fail: "Fail",
  skip: "Skip",
  not_run: "Not Run",
};

export default function TestCasePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    tc_id: "",
    module: "",
    title: "",
    precondition: "",
    steps: "",
    expected_result: "",
    actual_result: "",
    priority: "medium",
    status: "not_run",
    tester: "",
  });

  useEffect(() => {
    if (projectId) {
      fetchProject();
      fetchTestCases();
    }
  }, [projectId]);

  async function fetchProject() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();
    if (data) setProject(data);
  }

  async function fetchTestCases() {
    setLoading(true);
    const { data } = await supabase
      .from("test_cases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (data) setTestCases(data);
    setLoading(false);
  }

  function resetForm() {
    setForm({
      tc_id: "",
      module: "",
      title: "",
      precondition: "",
      steps: "",
      expected_result: "",
      actual_result: "",
      priority: "medium",
      status: "not_run",
      tester: "",
    });
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    const nextId = `TC-${String(testCases.length + 1).padStart(3, "0")}`;
    setForm((f) => ({ ...f, tc_id: nextId }));
    setShowModal(true);
  }

  function openEdit(tc: TestCase) {
    setForm({
      tc_id: tc.tc_id,
      module: tc.module,
      title: tc.title,
      precondition: tc.precondition || "",
      steps: tc.steps || "",
      expected_result: tc.expected_result || "",
      actual_result: tc.actual_result || "",
      priority: tc.priority,
      status: tc.status,
      tester: tc.tester || "",
    });
    setEditingId(tc.id);
    setShowModal(true);
  }

  async function saveTestCase() {
    if (!form.title.trim()) return;
    if (editingId) {
      await supabase
        .from("test_cases")
        .update({ ...form })
        .eq("id", editingId);
    } else {
      await supabase
        .from("test_cases")
        .insert({ ...form, project_id: projectId });
    }
    setShowModal(false);
    resetForm();
    fetchTestCases();
  }

  async function deleteTestCase(id: string) {
    if (!confirm("Hapus test case ini?")) return;
    await supabase.from("test_cases").delete().eq("id", id);
    fetchTestCases();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("test_cases").update({ status }).eq("id", id);
    fetchTestCases();
  }

  function downloadTemplate() {
    const template = [
      {
        "TC ID": "TC-001",
        Module: "Login",
        Title: "Login dengan kredensial valid",
        Precondition: "User sudah terdaftar",
        Steps:
          "1. Buka halaman login\n2. Isi email\n3. Isi password\n4. Klik login",
        "Expected Result": "User berhasil masuk ke dashboard",
        "Actual Result": "",
        Priority: "high",
        Status: "not_run",
        Tester: "",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
    XLSX.writeFile(wb, `template-testcase-${project?.name || "qaforge"}.xlsx`);
  }

  function downloadTestCases() {
    if (testCases.length === 0) return;
    const rows = testCases.map((tc) => ({
      "TC ID": tc.tc_id,
      Module: tc.module,
      Title: tc.title,
      Precondition: tc.precondition || "",
      Steps: tc.steps || "",
      "Expected Result": tc.expected_result || "",
      "Actual Result": tc.actual_result || "",
      Priority: tc.priority,
      Status: tc.status,
      Tester: tc.tester || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 40 },
      { wch: 30 },
      { wch: 50 },
      { wch: 40 },
      { wch: 40 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Test Cases");
    XLSX.writeFile(wb, `testcase-${project?.name || "project"}.xlsx`);
  }

  function uploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as any[];
      const inserts = rows.map((row, i) => ({
        project_id: projectId,
        tc_id: row["TC ID"] || `TC-${String(i + 1).padStart(3, "0")}`,
        module: row["Module"] || "",
        title: row["Title"] || "",
        precondition: row["Precondition"] || "",
        steps: row["Steps"] || "",
        expected_result: row["Expected Result"] || "",
        actual_result: row["Actual Result"] || "",
        priority: row["Priority"] || "medium",
        status: row["Status"] || "not_run",
        tester: row["Tester"] || "",
      }));
      await supabase.from("test_cases").insert(inserts);
      fetchTestCases();
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-1">
        <button
          onClick={() => navigate("/projects")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{project?.name}</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-7">{project?.description}</p>

      <div className="flex gap-2 mb-5">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 cursor-pointer transition-colors"
        >
          <Plus size={15} /> Tambah Test Case
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        >
          <Download size={15} /> Unduh Template
        </button>

        <label className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
          <Upload size={15} /> Upload Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={uploadExcel}
            className="hidden"
          />
        </label>
        <button
          onClick={downloadTestCases}
          disabled={testCases.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={15} /> Download Test Cases
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", value: testCases.length, color: "text-gray-900" },
          {
            label: "Pass",
            value: testCases.filter((t) => t.status === "pass").length,
            color: "text-emerald-600",
          },
          {
            label: "Fail",
            value: testCases.filter((t) => t.status === "fail").length,
            color: "text-red-500",
          },
          {
            label: "Not Run",
            value: testCases.filter((t) => t.status === "not_run").length,
            color: "text-gray-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : testCases.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Belum ada test case. Tambah manual atau upload Excel.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-20">
                    TC ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">
                    Module
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Judul
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Cucumber Scenario
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-24">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-24">
                    Tester
                  </th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((tc, i) => (
                  <tr
                    key={tc.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                      i % 2 === 0 ? "" : "bg-gray-50/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {tc.tc_id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{tc.module}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {tc.title}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium whitespace-pre-line">
                      {tc.expected_result}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          PRIORITY_COLORS[tc.priority]
                        }`}
                      >
                        {tc.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={tc.status}
                        onChange={(e) => updateStatus(tc.id, e.target.value)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${
                          STATUS_COLORS[tc.status]
                        }`}
                      >
                        {Object.entries(STATUS_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {tc.tester || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(tc)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteTestCase(tc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editingId ? "Edit Test Case" : "Tambah Test Case"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { label: "TC ID", key: "tc_id", placeholder: "TC-001" },
                { label: "Module", key: "module", placeholder: "Login" },
                { label: "Tester", key: "tester", placeholder: "Nama tester" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={(form as any)[f.key]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, priority: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                >
                  <option value="not_run">Not Run</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="skip">Skip</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Judul Test Case
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Deskripsi singkat test case"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
                />
              </div>
              {[
                {
                  label: "Precondition",
                  key: "precondition",
                  placeholder: "Kondisi sebelum pengujian...",
                },
                {
                  label: "Steps",
                  key: "steps",
                  placeholder: "1. Buka halaman\n2. Klik tombol\n3. ...",
                },
                {
                  label: "Expected Result",
                  key: "expected_result",
                  placeholder: "Hasil yang diharapkan...",
                },
                {
                  label: "Actual Result",
                  key: "actual_result",
                  placeholder: "Hasil aktual saat pengujian...",
                },
              ].map((f) => (
                <div key={f.key} className="col-span-2">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {f.label}
                  </label>
                  <textarea
                    value={(form as any)[f.key]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400 resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={saveTestCase}
                disabled={!form.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium"
              >
                <Check size={15} />
                {editingId ? "Simpan Perubahan" : "Tambah Test Case"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
