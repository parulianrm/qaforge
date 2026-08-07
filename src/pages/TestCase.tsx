import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Upload,
  Download,
  Pencil,
  Trash2,
  Check,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  ACCESS_ROLES,
  AccessRole,
  ProjectAccessGrant,
  canEdit,
  canManageAccess,
  getLocalProjectRole,
} from "../lib/access";
import {
  TEST_CASE_PRIORITIES,
  TEST_CASE_STATUSES,
  labelize,
  normalizeTestCasePriority,
  normalizeTestCaseStatus,
} from "../lib/domain";
import { formatTestCaseCode } from "../lib/testCaseCode";
import { getUserDisplayName } from "../lib/userProfile";
import { useAuth } from "../hooks/useAuth";
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

const PAGE_SIZE = 10;
type TestCaseForm = {
  tc_id: string;
  module: string;
  title: string;
  precondition: string;
  steps: string;
  expected_result: string;
  actual_result: string;
  priority: string;
  status: string;
  tester: string;
};
type TestCaseExcelRow = Record<string, string | number | undefined>;

function cellText(value: string | number | undefined) {
  return value == null ? "" : String(value);
}

function PaginationControls({
  page,
  total,
  onPageChange,
}: {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TestCasePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultTester = getUserDisplayName(user);

  const [project, setProject] = useState<Project | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    module: "",
    title: "",
    priority: "",
    status: "",
  });
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessGrants, setAccessGrants] = useState<ProjectAccessGrant[]>([]);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<AccessRole>("viewer");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TestCaseForm>({
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
      setPage(1);
      setFilterModule("");
      setFilterTitle("");
      setFilterPriority("");
      setFilterStatus("");
      setAppliedFilters({ module: "", title: "", priority: "", status: "" });
      fetchProject();
      fetchTestCases();
      fetchAccessGrants();
    }
  }, [projectId]);

  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Set(testCases.map((tc) => tc.module).filter(Boolean)),
      ).sort(),
    [testCases],
  );

  const titleOptions = useMemo(
    () =>
      Array.from(
        new Set(testCases.map((tc) => tc.title).filter(Boolean)),
      ).sort(),
    [testCases],
  );

  const hasActiveFilters = Boolean(
    appliedFilters.module ||
    appliedFilters.title ||
    appliedFilters.priority ||
    appliedFilters.status,
  );

  function applyFilters() {
    setAppliedFilters({
      module: filterModule,
      title: filterTitle,
      priority: filterPriority,
      status: filterStatus,
    });
    setPage(1);
  }

  function resetFilters() {
    setFilterModule("");
    setFilterTitle("");
    setFilterPriority("");
    setFilterStatus("");
    setAppliedFilters({ module: "", title: "", priority: "", status: "" });
    setPage(1);
  }

  const filteredTestCases = useMemo(() => {
    const moduleKeyword = appliedFilters.module.trim().toLowerCase();
    const titleKeyword = appliedFilters.title.trim().toLowerCase();

    return testCases.filter((tc) => {
      if (
        moduleKeyword &&
        !(tc.module || "").toLowerCase().includes(moduleKeyword)
      )
        return false;
      if (appliedFilters.priority && tc.priority !== appliedFilters.priority)
        return false;
      if (appliedFilters.status && tc.status !== appliedFilters.status)
        return false;
      if (titleKeyword && !tc.title.toLowerCase().includes(titleKeyword))
        return false;
      return true;
    });
  }, [testCases, appliedFilters]);

  const paginatedTestCases = useMemo(
    () => filteredTestCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredTestCases, page],
  );
  const projectRole = useMemo(
    () => getLocalProjectRole(project, user, accessGrants),
    [accessGrants, project, user],
  );
  const editable = canEdit(projectRole);
  const manageable = canManageAccess(projectRole);

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

  async function fetchAccessGrants() {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_access")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    setAccessGrants((data || []) as ProjectAccessGrant[]);
  }

  async function saveAccessGrant() {
    if (!projectId || !accessEmail.trim()) return;
    const email = accessEmail.trim().toLowerCase();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_access").upsert(
      {
        project_id: projectId,
        user_email: email,
        role: accessRole,
        created_by: currentUser?.id,
      },
      { onConflict: "project_id,user_email" },
    );
    if (!error) {
      setAccessEmail("");
      setAccessRole("viewer");
      fetchAccessGrants();
    }
  }

  async function removeAccessGrant(id: string) {
    await supabase.from("project_access").delete().eq("id", id);
    fetchAccessGrants();
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
      tester: defaultTester,
    });
    setEditingId(null);
  }

  function openCreate() {
    if (!editable) return;
    resetForm();
    const nextId = formatTestCaseCode(project?.name, testCases.length + 1);
    setForm((f) => ({
      ...f,
      tc_id: nextId,
      tester: f.tester || defaultTester,
    }));
    setShowModal(true);
  }

  function openEdit(tc: TestCase) {
    if (!editable) return;
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
    if (!editable) return;
    if (!form.title.trim()) return;
    if (editingId) {
      await supabase
        .from("test_cases")
        .update({
          ...form,
          priority: normalizeTestCasePriority(form.priority),
          status: normalizeTestCaseStatus(form.status),
        })
        .eq("id", editingId);
    } else {
      await supabase.from("test_cases").insert({
        ...form,
        priority: normalizeTestCasePriority(form.priority),
        status: normalizeTestCaseStatus(form.status),
        project_id: projectId,
      });
    }
    setShowModal(false);
    resetForm();
    fetchTestCases();
  }

  async function resequenceTestCaseIds() {
    const { data, error } = await supabase
      .from("test_cases")
      .select("id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    if (error || !data) return;

    await Promise.all(
      data.map((tc, index) =>
        supabase
          .from("test_cases")
          .update({
            tc_id: formatTestCaseCode(project?.name, index + 1),
          })
          .eq("id", tc.id),
      ),
    );
  }

  async function deleteTestCase(id: string) {
    if (!editable) return;
    if (!confirm("Hapus test case ini?")) return;
    const { error } = await supabase.from("test_cases").delete().eq("id", id);
    if (!error) {
      await resequenceTestCaseIds();
    }
    fetchTestCases();
  }

  async function updateStatus(id: string, status: string) {
    if (!editable) return;
    await supabase.from("test_cases").update({ status }).eq("id", id);
    fetchTestCases();
  }

  function downloadTemplate() {
    const template = [
      {
        "TC ID": formatTestCaseCode(project?.name, 1),
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
    XLSX.writeFile(wb, `template-testcase-${project?.name || "havox"}.xlsx`);
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
    if (!editable) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as TestCaseExcelRow[];
      const inserts = rows.map((row, i) => ({
        project_id: projectId,
        tc_id:
          cellText(row["TC ID"]) || formatTestCaseCode(project?.name, i + 1),
        module: cellText(row["Module"]),
        title: cellText(row["Title"]),
        precondition: cellText(row["Precondition"]),
        steps: cellText(row["Steps"]),
        expected_result: cellText(row["Expected Result"]),
        actual_result: cellText(row["Actual Result"]),
        priority: normalizeTestCasePriority(row["Priority"]),
        status: normalizeTestCaseStatus(row["Status"]),
        tester: cellText(row["Tester"]),
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
          className="text-slate-400 hover:text-slate-600"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold text-slate-900">{project?.name}</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6 ml-7">{project?.description}</p>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
        >
          <Plus size={15} /> Tambah Test Case
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <Download size={15} /> Unduh Template
        </button>

        <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
          <Upload size={15} /> Upload Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={uploadExcel}
            disabled={!editable}
            className="hidden"
          />
        </label>
        <button
          onClick={downloadTestCases}
          disabled={testCases.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={15} /> Download Test Cases
        </button>
        <button
          onClick={() => setShowAccessModal(true)}
          disabled={!manageable}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          title={
            manageable
              ? "Kelola akses dokumen"
              : "Hanya owner yang dapat mengelola akses"
          }
        >
          <Users size={15} /> Access
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Filter Test Case
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Module
            </label>
            <input
              type="text"
              list="module-options"
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Cari atau pilih module..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
            <datalist id="module-options">
              {moduleOptions.map((module) => (
                <option key={module} value={module} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Nama Test Case
            </label>
            <input
              type="text"
              list="title-options"
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              placeholder="Cari atau pilih judul test case..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
            <datalist id="title-options">
              {titleOptions.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Priority
            </label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Semua Priority</option>
              {TEST_CASE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {labelize(priority)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Semua Status</option>
              {TEST_CASE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {labelize(status)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={resetFilters}
            disabled={
              !hasActiveFilters &&
              !filterModule &&
              !filterTitle &&
              !filterPriority &&
              !filterStatus
            }
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={applyFilters}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Cari
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
        <ShieldCheck size={15} />
        Akses Anda: {projectRole ? labelize(projectRole) : "No Access"}
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", value: testCases.length, color: "text-slate-900" },
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
            color: "text-slate-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-xl p-4"
          >
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : testCases.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Belum ada test case. Tambah manual atau upload Excel.
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Tidak ada test case yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-20">
                    TC ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-28">
                    Module
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                    Judul
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                    Expected Result
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-24">
                    Priority
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-28">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-24">
                    Tester
                  </th>
                  <th className="px-4 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {paginatedTestCases.map((tc, i) => (
                  <tr
                    key={tc.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                      i % 2 === 0 ? "" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                      {tc.tc_id}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{tc.module}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {tc.title}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium whitespace-pre-line">
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
                        disabled={!editable}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${
                          STATUS_COLORS[tc.status]
                        }`}
                      >
                        {TEST_CASE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {labelize(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {tc.tester || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(tc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteTestCase(tc.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls
              page={page}
              total={filteredTestCases.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">
                {editingId ? "Edit Test Case" : "Tambah Test Case"}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                {
                  label: "TC ID",
                  key: "tc_id",
                  placeholder: formatTestCaseCode(project?.name, 1),
                },
                { label: "Module", key: "module", placeholder: "Login" },
                { label: "Tester", key: "tester", placeholder: "Nama tester" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={form[f.key as keyof TestCaseForm]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, priority: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                >
                  {TEST_CASE_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {labelize(priority)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                >
                  {TEST_CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {labelize(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Judul Test Case
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Deskripsi singkat test case"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
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
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    {f.label}
                  </label>
                  <textarea
                    value={form[f.key as keyof TestCaseForm]}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none"
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
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveTestCase}
                disabled={!form.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
              >
                <Check size={15} />
                {editingId ? "Simpan Perubahan" : "Tambah Test Case"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccessModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                <h2 className="font-semibold text-gray-900">Kelola Access</h2>
              </div>
              <button
                onClick={() => setShowAccessModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                <input
                  type="email"
                  value={accessEmail}
                  onChange={(e) => setAccessEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <select
                  value={accessRole}
                  onChange={(e) => setAccessRole(e.target.value as AccessRole)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {ACCESS_ROLES.filter((role) => role !== "owner").map(
                    (role) => (
                      <option key={role} value={role}>
                        {labelize(role)}
                      </option>
                    ),
                  )}
                </select>
                <button
                  onClick={saveAccessGrant}
                  disabled={!accessEmail.trim()}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  Grant
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-100">
                {accessGrants.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Belum ada user tambahan.
                  </div>
                ) : (
                  accessGrants.map((grant) => (
                    <div
                      key={grant.id}
                      className="flex items-center justify-between border-b border-gray-50 px-4 py-3 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {grant.user_email}
                        </p>
                        <p className="text-xs text-gray-500">
                          {labelize(grant.role)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAccessGrant(grant.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500"
                        title="Hapus akses"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
