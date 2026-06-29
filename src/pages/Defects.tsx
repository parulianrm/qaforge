import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";
import {
  DEFECT_PRIORITIES,
  DEFECT_STATUSES,
  labelize,
  normalizeDefectPriority,
  normalizeDefectStatus,
} from "../lib/domain";
import { getUserDisplayName } from "../lib/userProfile";
import { useAuth } from "../hooks/useAuth";
import { Defect, Project } from "../types";

const PRIORITY_OPTIONS = DEFECT_PRIORITIES;
const STATUS_OPTIONS = DEFECT_STATUSES;
const PAGE_SIZE = 10;

const PRIORITY_COLORS: Record<string, string> = {
  blocker: "bg-slate-200 text-slate-700",
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-50 text-red-700",
  in_progress: "bg-blue-50 text-blue-700",
  solved: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

function formatIssueId(projectName: string | undefined, sequence: number) {
  const words =
    projectName
      ?.replace(/[^a-zA-Z0-9\s]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean) || [];
  const prefix =
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
      : (words[0] || "DEF").slice(0, 2).toUpperCase();

  return `${prefix || "DF"}-${String(sequence).padStart(3, "0")}`;
}

function toInputDate(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function parseExcelDate(value: unknown) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const text = String(value).trim();
  const parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts)
    return `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  return toInputDate(text);
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function cellText(value: string | number | undefined) {
  return value == null ? "" : String(value);
}

const emptyForm = {
  project_id: "",
  module: "",
  environment: "Development",
  database_name: "",
  reporter: "",
  reported_at: new Date().toISOString().slice(0, 10),
  issue_id: "",
  description: "",
  priority: "medium",
  attachment: "",
  status: "open",
  developer_notes: "",
  merge_request: "",
  qa_notes: "",
};
type DefectForm = typeof emptyForm;
type DefectExcelRow = Record<string, string | number | undefined>;

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

export default function DefectsPage() {
  const { user } = useAuth();
  const defaultReporter = getUserDisplayName(user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, reporter: defaultReporter });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setPage(1);
    setSearch("");
    fetchDefects();
  }, [selectedProjectId]);

  const filteredDefects = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return defects;
    return defects.filter((defect) =>
      [
        defect.issue_id,
        defect.def_id,
        defect.title,
        defect.description,
        defect.module,
        defect.reporter,
        defect.priority,
        defect.severity,
        defect.status,
        defect.attachment,
        defect.developer_notes,
        defect.merge_request,
        defect.qa_notes,
        defect.environment,
        defect.database_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [defects, search]);

  const paginatedDefects = useMemo(
    () => filteredDefects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDefects, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  async function fetchProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    const projectRows = data || [];
    setProjects(projectRows);
    if (!selectedProjectId && projectRows[0]) {
      setSelectedProjectId(projectRows[0].id);
    }
  }

  async function fetchDefects() {
    setLoading(true);
    let query = supabase
      .from("defects")
      .select("*")
      .order("reported_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (selectedProjectId) query = query.eq("project_id", selectedProjectId);
    const { data } = await query;
    setDefects(data || []);
    setLoading(false);
  }

  function resetForm() {
    setForm({
      ...emptyForm,
      project_id: selectedProjectId,
      module: selectedProject?.name || "",
      database_name: "",
      reporter: defaultReporter,
      issue_id: formatIssueId(selectedProject?.name, defects.length + 1),
    });
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(defect: Defect) {
    setForm({
      project_id: defect.project_id,
      module: defect.module || "",
      environment: defect.environment || "Development",
      database_name: defect.database_name || "",
      reporter: defect.reporter || defaultReporter,
      reported_at: toInputDate(defect.reported_at || defect.created_at),
      issue_id: defect.issue_id || defect.def_id || "",
      description: defect.description || defect.title || "",
      priority: normalizeDefectPriority(defect.priority || defect.severity),
      attachment: defect.attachment || "",
      status: normalizeDefectStatus(defect.status),
      developer_notes: defect.developer_notes || "",
      merge_request: defect.merge_request || "",
      qa_notes: defect.qa_notes || "",
    });
    setEditingId(defect.id);
    setShowModal(true);
  }

  async function saveDefect() {
    if (!form.project_id || !form.description.trim()) return;
    const payload = {
      project_id: form.project_id,
      module: form.module,
      environment: form.environment,
      database_name: form.database_name,
      reporter: form.reporter,
      reported_at: form.reported_at,
      issue_id: form.issue_id,
      title: form.description.split("\n")[0].slice(0, 120),
      description: form.description,
      priority: normalizeDefectPriority(form.priority),
      severity: normalizeDefectPriority(form.priority),
      attachment: form.attachment,
      status: normalizeDefectStatus(form.status),
      developer_notes: form.developer_notes,
      merge_request: form.merge_request,
      qa_notes: form.qa_notes,
    };

    if (editingId) {
      await supabase.from("defects").update(payload).eq("id", editingId);
    } else {
      await supabase.from("defects").insert(payload);
    }
    setShowModal(false);
    resetForm();
    fetchDefects();
  }

  async function deleteDefect(id: string) {
    if (!confirm("Hapus defect ini?")) return;
    await supabase.from("defects").delete().eq("id", id);
    fetchDefects();
  }

  function getExcelRows(rows: Defect[]) {
    return rows.map((defect) => ({
      "Reported By": defect.reporter || "",
      "Reported At": formatDisplayDate(defect.reported_at || defect.created_at),
      "Issue ID": defect.issue_id || defect.def_id || "",
      Description: defect.description || defect.title || "",
      Priority: labelize(defect.priority || defect.severity),
      Attachment: defect.attachment || "",
      Status: labelize(defect.status),
      "Developer Notes": defect.developer_notes || "",
      "Merge Request": defect.merge_request || "",
      "QA Notes": defect.qa_notes || "",
    }));
  }

  function buildWorkbook(rows: Record<string, string>[]) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Modul Name", form.module || selectedProject?.name || ""],
      ["Environment", form.environment || "Development"],
      ["Database", form.database_name || ""],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, rows, { origin: "A5" });
    ws["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 58 },
      { wch: 14 },
      { wch: 28 },
      { wch: 16 },
      { wch: 34 },
      { wch: 42 },
      { wch: 42 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedProject?.name || "Defects");
    return wb;
  }

  function downloadTemplate() {
    const rows = [
      {
        "Reported By": defaultReporter,
        "Reported At": formatDisplayDate(new Date().toISOString()),
        "Issue ID": formatIssueId(selectedProject?.name, 1),
        Description: `${selectedProject?.name || "Module"} > Deskripsi defect`,
        Priority: "High",
        Attachment: "nama-attachment",
        Status: "Open",
        "Developer Notes": "",
        "Merge Request": "",
        "QA Notes": "",
      },
    ];
    XLSX.writeFile(
      buildWorkbook(rows),
      `template-defect-${selectedProject?.name || "havox"}.xlsx`,
    );
  }

  function downloadDefects() {
    XLSX.writeFile(
      buildWorkbook(getExcelRows(defects)),
      `defects-${selectedProject?.name || "havox"}.xlsx`,
    );
  }

  function uploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const meta = XLSX.utils.sheet_to_json(ws, {
        header: 1,
      }) as (string | number | undefined)[][];
      const moduleName = meta[0]?.[1] || selectedProject?.name || "";
      const environment = meta[1]?.[1] || "Development";
      const databaseName = meta[2]?.[1] || "";
      const rows = XLSX.utils.sheet_to_json(ws, {
        range: 4,
      }) as DefectExcelRow[];
      const inserts = rows
        .filter((row) => row["Description"] || row["Issue ID"])
        .map((row, index) => {
          const description = cellText(row["Description"]);
          const priority = normalizeDefectPriority(row["Priority"]);
          return {
            project_id: selectedProjectId,
            module: moduleName,
            environment,
            database_name: databaseName,
            reporter: cellText(row["Reported By"]) || defaultReporter,
            reported_at: parseExcelDate(row["Reported At"]),
            issue_id:
              cellText(row["Issue ID"]) ||
              formatIssueId(selectedProject?.name, defects.length + index + 1),
            title:
              description.split("\n")[0].slice(0, 120) || "Untitled defect",
            description,
            priority,
            severity: priority,
            attachment: cellText(row["Attachment"]),
            status: normalizeDefectStatus(row["Status"]),
            developer_notes: cellText(row["Developer Notes"]),
            merge_request: cellText(row["Merge Request"]),
            qa_notes: cellText(row["QA Notes"]),
          };
        });
      if (inserts.length > 0) {
        await supabase.from("defects").insert(inserts);
        fetchDefects();
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  const totalOpen = defects.filter((d) =>
    ["open", "in_progress"].includes(normalizeDefectStatus(d.status)),
  ).length;
  const totalSolved = defects.filter((d) =>
    ["solved", "closed"].includes(normalizeDefectStatus(d.status)),
  ).length;
  const totalBlocker = defects.filter(
    (d) => normalizeDefectPriority(d.priority || d.severity) === "blocker",
  ).length;

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Defect Logging
              </h1>
              <p className="text-sm text-gray-500">
                Catat, import, dan export defect per project.
              </p>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-80">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Project
          </label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={openCreate}
          disabled={!selectedProjectId}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          <Plus size={15} /> Tambah Defect
        </button>
        <button
          onClick={downloadTemplate}
          disabled={!selectedProjectId}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={15} /> Unduh Template
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50">
          <Upload size={15} /> Upload Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={uploadExcel}
            className="hidden"
          />
        </label>
        <button
          onClick={downloadDefects}
          disabled={defects.length === 0}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
        >
          <Download size={15} /> Download Defects
        </button>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari issue ID, deskripsi, reporter, status..."
          className="min-w-72 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          { label: "Total", value: defects.length, color: "text-gray-900" },
          { label: "Open", value: totalOpen, color: "text-red-500" },
          {
            label: "Solved/Closed",
            value: totalSolved,
            color: "text-emerald-600",
          },
          { label: "Blocker", value: totalBlocker, color: "text-slate-700" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${item.color}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : defects.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Belum ada defect untuk project ini.
          </div>
        ) : filteredDefects.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Tidak ada defect yang cocok dengan pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-green-100">
                  {[
                    "Reported By",
                    "Reported At",
                    "Issue ID",
                    "Description",
                    "Priority",
                    "Attachment",
                    "Status",
                    "Developer Notes",
                    "Merge Request",
                    "QA Notes",
                    "",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-3 py-3 text-left text-xs font-semibold text-green-900"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedDefects.map((defect) => (
                  <tr
                    key={defect.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-3">{defect.reporter || "-"}</td>
                    <td className="px-3 py-3">
                      {formatDisplayDate(
                        defect.reported_at || defect.created_at,
                      )}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">
                      {defect.issue_id || defect.def_id || "-"}
                    </td>
                    <td className="max-w-md px-3 py-3 font-medium text-gray-900">
                      {defect.description || defect.title}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_COLORS[normalizeDefectPriority(defect.priority || defect.severity)] || "bg-gray-100 text-gray-600"}`}
                      >
                        {labelize(defect.priority || defect.severity)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {defect.attachment || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[normalizeDefectStatus(defect.status)] || "bg-gray-100 text-gray-600"}`}
                      >
                        {labelize(defect.status)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {defect.developer_notes || "-"}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-blue-600">
                      {defect.merge_request || "-"}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-gray-600">
                      {defect.qa_notes || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(defect)}
                          className="p-1.5 text-gray-400 hover:text-blue-500"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteDefect(defect.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500"
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
              total={filteredDefects.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">
                {editingId ? "Edit Defect" : "Tambah Defect"}
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
            <div className="grid grid-cols-2 gap-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Project
                </label>
                <select
                  value={form.project_id}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, project_id: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              {[
                ["Modul Name", "module", "Reimbursement"],
                ["Environment", "environment", "Development"],
                ["Database", "database_name", "hcms4_db"],
                ["Reported By", "reporter", "Nama reporter"],
                ["Reported At", "reported_at", ""],
                [
                  "Issue ID",
                  "issue_id",
                  formatIssueId(selectedProject?.name, 1),
                ],
                ["Attachment", "attachment", "failed-upload-file"],
                ["Merge Request", "merge_request", "https://..."],
              ].map(([label, key, placeholder]) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {label}
                  </label>
                  <input
                    type={key === "reported_at" ? "date" : "text"}
                    value={form[key as keyof DefectForm]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, priority: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
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
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {labelize(status)}
                    </option>
                  ))}
                </select>
              </div>
              {[
                ["Description", "description", "Module > deskripsi defect"],
                ["Developer Notes", "developer_notes", "Catatan developer..."],
                ["QA Notes", "qa_notes", "Catatan QA..."],
              ].map(([label, key, placeholder]) => (
                <div key={key} className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {label}
                  </label>
                  <textarea
                    value={form[key as keyof DefectForm]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder={placeholder}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
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
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={saveDefect}
                disabled={!form.project_id || !form.description.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Check size={15} />
                {editingId ? "Simpan Perubahan" : "Tambah Defect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
