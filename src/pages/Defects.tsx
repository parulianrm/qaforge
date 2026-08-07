import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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
  labelize,
  labelizeDefectStatus,
  normalizeDefectPriority,
  normalizeDefectStatus,
} from "../lib/domain";
import {
  fetchOptionLists,
  optionsFor,
  OptionListItem,
} from "../lib/optionLists";
import { getUserDisplayName } from "../lib/userProfile";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import {
  hasPagePermission,
  ROLE_ACCENT_BADGE_CLASSES,
  RoleAccent,
} from "../lib/roles";
import { UserEmailAutocomplete } from "../components/UserEmailAutocomplete";
import { CustomSelect } from "../components/CustomSelect";
import { Defect, Project } from "../types";

const PAGE_SIZE = 10;

function accentTextClass(accent: RoleAccent) {
  return (
    ROLE_ACCENT_BADGE_CLASSES[accent]
      .split(" ")
      .find((c) => c.startsWith("text-")) || "text-gray-900"
  );
}

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

function shortenId(id: string, keep = 8) {
  return id.length > keep ? `${id.slice(0, keep)}…` : id;
}

function fileLabelFromUrl(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const host = url.hostname.replace(/^www\./, "");
    const last = segments[segments.length - 1];

    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) {
      return decodeURIComponent(last);
    }

    if (host === "drive.google.com") {
      const dIndex = segments.indexOf("d");
      const id =
        dIndex >= 0
          ? segments[dIndex + 1]
          : segments.find((s) => s.length > 20);
      const kind = segments.includes("folders") ? "Drive Folder" : "Drive File";
      return id ? `${kind} · ${shortenId(id)}` : kind;
    }
    if (host === "docs.google.com") {
      if (segments.includes("spreadsheets")) return "Google Sheet";
      if (segments.includes("presentation")) return "Google Slide";
      if (segments.includes("forms")) return "Google Form";
      return "Google Doc";
    }

    if (host === "github.com") {
      const prIndex = segments.indexOf("pull");
      if (prIndex > 0 && segments[prIndex + 1]) {
        return `${segments[prIndex - 1]} #${segments[prIndex + 1]}`;
      }
    }
    if (segments.includes("merge_requests")) {
      const idx = segments.indexOf("merge_requests");
      const num = segments[idx + 1];
      const project =
        segments[idx - 1] === "-" ? segments[idx - 2] : segments[idx - 1];
      return num ? `${project ? project + " " : ""}!${num}` : "Merge Request";
    }
    const prKey = segments.includes("pull-requests")
      ? "pull-requests"
      : segments.includes("pullrequest")
        ? "pullrequest"
        : null;
    if (prKey) {
      const idx = segments.indexOf(prKey);
      const num = segments[idx + 1];
      const project = segments[idx - 1];
      return num ? `${project ? project + " " : ""}#${num}` : "Pull Request";
    }

    if (segments.length) return segments.slice(-2).join("/");
    return host;
  } catch {
    return value;
  }
}

function LinkChip({
  value,
  icon,
}: {
  value?: string | null;
  icon: React.ReactNode;
}) {
  if (!value) return <span className="text-gray-400">-</span>;
  const isUrl = /^https?:\/\//i.test(value);
  const label = isUrl ? fileLabelFromUrl(value) : value;
  const chip = (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
        isUrl
          ? "border-gray-200 bg-gray-50 text-blue-700 hover:border-blue-200 hover:bg-blue-50"
          : "border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
  if (!isUrl) return chip;
  return (
    <a
      href={value}
      target="_blank"
      rel="noreferrer"
      title={value}
      className="inline-flex max-w-full"
    >
      {chip}
    </a>
  );
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
  handled_by: "",
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
  const { role: systemRole } = useProfile(user);
  const isSystemAdmin = hasPagePermission(systemRole, "manage_access");
  const defaultReporter = getUserDisplayName(user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessGrants, setAccessGrants] = useState<ProjectAccessGrant[]>([]);
  const [accessEmail, setAccessEmail] = useState("");
  const [accessRole, setAccessRole] = useState<AccessRole>("viewer");
  const [knownUsers, setKnownUsers] = useState<
    { email: string; full_name: string | null }[]
  >([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm, reporter: defaultReporter });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [optionItems, setOptionItems] = useState<OptionListItem[]>([]);

  const priorityOptions = useMemo(
    () => optionsFor(optionItems, "defect_priority"),
    [optionItems],
  );
  const statusOptions = useMemo(
    () => optionsFor(optionItems, "defect_status"),
    [optionItems],
  );
  const priorityValues = useMemo(
    () => priorityOptions.map((o) => o.value),
    [priorityOptions],
  );
  const statusValues = useMemo(
    () => statusOptions.map((o) => o.value),
    [statusOptions],
  );
  const defaultPriority =
    priorityOptions.find((o) => o.is_default)?.value ??
    priorityOptions[0]?.value ??
    "medium";
  const defaultStatus =
    statusOptions.find((o) => o.is_default)?.value ??
    statusOptions[0]?.value ??
    "open";

  function badgeColor(options: OptionListItem[], value: string) {
    const option = options.find((o) => o.value === value);
    return option
      ? ROLE_ACCENT_BADGE_CLASSES[option.accent]
      : ROLE_ACCENT_BADGE_CLASSES.slate;
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId),
    [projects, selectedProjectId],
  );
  const projectRole = useMemo(
    () => getLocalProjectRole(selectedProject || null, user, accessGrants),
    [accessGrants, selectedProject, user],
  );
  const editable = canEdit(projectRole) || isSystemAdmin;
  const manageable = canManageAccess(projectRole) || isSystemAdmin;

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    supabase.rpc("directory_users").then(({ data }) => {
      if (data) setKnownUsers(data);
    });
    fetchOptionLists().then(setOptionItems);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setDefects([]);
      setLoading(false);
      return;
    }
    setPage(1);
    setSearch("");
    fetchDefects();
    fetchAccessGrants();
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
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) {
      console.error("Failed to fetch projects:", error.message);
      return;
    }
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
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (selectedProjectId) query = query.eq("project_id", selectedProjectId);
    const { data, error } = await query;
    if (error) {
      console.error("Failed to fetch defects:", error.message);
    } else {
      setDefects(data || []);
    }
    setLoading(false);
  }

  async function fetchAccessGrants() {
    if (!selectedProjectId) {
      setAccessGrants([]);
      return;
    }
    const { data } = await supabase
      .from("project_access")
      .select("*")
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: true });
    setAccessGrants((data || []) as ProjectAccessGrant[]);
  }

  async function saveAccessGrant() {
    if (!selectedProjectId || !accessEmail.trim()) return;
    const email = accessEmail.trim().toLowerCase();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_access").upsert(
      {
        project_id: selectedProjectId,
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
      ...emptyForm,
      project_id: selectedProjectId,
      module: selectedProject?.name || "",
      database_name: "",
      reporter: defaultReporter,
      issue_id: formatIssueId(selectedProject?.name, defects.length + 1),
      priority: defaultPriority,
      status: defaultStatus,
    });
    setEditingId(null);
  }

  function openCreate() {
    if (!editable) return;
    resetForm();
    setSaveError(null);
    setShowModal(true);
  }

  function openEdit(defect: Defect) {
    if (!editable) return;
    setSaveError(null);
    setForm({
      project_id: defect.project_id,
      module: defect.module || "",
      environment: defect.environment || "Development",
      database_name: defect.database_name || "",
      reporter: defect.reporter || defaultReporter,
      reported_at: toInputDate(defect.reported_at || defect.created_at),
      issue_id: defect.issue_id || defect.def_id || "",
      description: defect.description || defect.title || "",
      priority: normalizeDefectPriority(
        defect.priority || defect.severity,
        priorityValues,
      ),
      attachment: defect.attachment || "",
      status: normalizeDefectStatus(defect.status, statusValues),
      handled_by: defect.handled_by || "",
      developer_notes: defect.developer_notes || "",
      merge_request: defect.merge_request || "",
      qa_notes: defect.qa_notes || "",
    });
    setEditingId(defect.id);
    setShowModal(true);
  }

  async function saveDefect() {
    if (!editable) return;
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
      priority: normalizeDefectPriority(form.priority, priorityValues),
      severity: normalizeDefectPriority(form.priority, priorityValues),
      attachment: form.attachment,
      status: normalizeDefectStatus(form.status, statusValues),
      handled_by: form.handled_by,
      developer_notes: form.developer_notes,
      merge_request: form.merge_request,
      qa_notes: form.qa_notes,
    };

    setSaving(true);
    setSaveError(null);
    const { error } = editingId
      ? await supabase.from("defects").update(payload).eq("id", editingId)
      : await supabase.from("defects").insert(payload);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setShowModal(false);
    resetForm();
    fetchDefects();
  }

  async function deleteDefect(id: string) {
    if (!editable) return;
    if (!confirm("Hapus defect ini?")) return;
    await supabase.from("defects").delete().eq("id", id);
    fetchDefects();
  }

  async function updateDefectStatus(id: string, status: string) {
    if (!editable) return;
    const normalized = normalizeDefectStatus(status, statusValues);
    setDefects((prev) =>
      prev.map((defect) =>
        defect.id === id ? { ...defect, status: normalized } : defect,
      ),
    );
    const { error } = await supabase
      .from("defects")
      .update({ status: normalized })
      .eq("id", id);
    if (error) fetchDefects();
  }

  async function updateDefectPriority(id: string, priority: string) {
    if (!editable) return;
    const normalized = normalizeDefectPriority(priority, priorityValues);
    setDefects((prev) =>
      prev.map((defect) =>
        defect.id === id
          ? { ...defect, priority: normalized, severity: normalized }
          : defect,
      ),
    );
    const { error } = await supabase
      .from("defects")
      .update({ priority: normalized, severity: normalized })
      .eq("id", id);
    if (error) fetchDefects();
  }

  const EXCEL_COLUMN_WIDTHS = [
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

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Reported By",
        "Reported At",
        "Issue ID",
        "Description",
        "Priority",
        "Attachment",
        "Status",
        "Handled By",
        "Developer Notes",
        "QA Notes",
        "Merge Request",
      ],
    ]);
    ws["!cols"] = EXCEL_COLUMN_WIDTHS;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedProject?.name || "Defects");
    XLSX.writeFile(
      wb,
      `template-defect-${selectedProject?.name || "havox"}.xlsx`,
    );
  }

  const LABEL_FILL: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9EAD3" },
  };
  const LABEL_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FF274E13" },
  };
  const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFE0E0E0" } },
    left: { style: "thin", color: { argb: "FFE0E0E0" } },
    bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
    right: { style: "thin", color: { argb: "FFE0E0E0" } },
  };
  const PRIORITY_FILLS: Record<string, string> = {
    blocker: "FFB7B7B7",
    high: "FFF4CCCC",
    medium: "FFFCE5CD",
    low: "FFD9EAD3",
  };
  const STATUS_FILLS: Record<string, { bg: string; font: string }> = {
    open: { bg: "FFF3F3F3", font: "FF000000" },
    in_development: { bg: "FF3D85C6", font: "FFFFFFFF" },
    done_development: { bg: "FFB7B7B7", font: "FF000000" },
    on_check: { bg: "FFD9D2E9", font: "FF000000" },
    solved: { bg: "FF38761D", font: "FFFFFFFF" },
    gwind_issue: { bg: "FFF1C232", font: "FF000000" },
    hold: { bg: "FFE06666", font: "FFFFFFFF" },
    re_open: { bg: "FF990000", font: "FFFFFFFF" },
  };
  const DEFECT_HEADERS = [
    "Reported By",
    "Reported At",
    "Issue ID",
    "Description",
    "Priority",
    "Attachment",
    "Status",
    "Handled By",
    "Updated At",
    "Developer Notes",
    "QA Notes",
    "Link Merge Request",
  ];
  const DEFECT_COL_WIDTHS = [20, 14, 12, 58, 14, 30, 24, 18, 14, 34, 34, 42];
  const DEFECT_HEADER_ROW = 8;
  const DEFECT_NOTES = [
    "Mohon untuk melengkapi seluruh field yang sudah disediakan",
    "Isi Bagian Reported By dengan alamat email, lalu klik convert to Smart Chips dan pilih People",
    "Mohon untuk selalu melakukan update terkait issue yang telah diberikan oleh Reporter",
    "Bila ada yang perlu dikonfirmasi terkait issue yang ditemukan, mohon segera menghubungi Reporter",
  ];

  async function downloadDefects() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(selectedProject?.name || "Defects", {
      views: [{ state: "frozen", ySplit: DEFECT_HEADER_ROW }],
    });
    DEFECT_COL_WIDTHS.forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });

    function setLabelCell(cellRef: string, value: string | number) {
      const cell = sheet.getCell(cellRef);
      cell.value = value;
      cell.fill = LABEL_FILL;
      cell.font = LABEL_FONT;
    }

    setLabelCell("A2", "Modul Name");
    sheet.getCell("B2").value = form.module || selectedProject?.name || "";
    setLabelCell("A3", "Environment");
    sheet.getCell("B3").value = form.environment || "Development";
    setLabelCell("A4", "Database");
    sheet.getCell("B4").value = form.database_name || "";
    setLabelCell("A5", "Test Case");
    sheet.getCell("B5").value = "-";
    setLabelCell("A6", "Total Defect");
    sheet.getCell("B6").value = defects.length;
    sheet.getCell("C6").value = "Defect";

    const countFor = (status: string) =>
      defects.filter(
        (d) => normalizeDefectStatus(d.status, statusValues) === status,
      ).length;
    const summaryRows: Array<[number, string, number]> = [
      [2, "Defect Open", countFor("open")],
      [3, "Defect In Development/Fixing", countFor("in_development")],
      [4, "Defect Done Development", countFor("done_development")],
      [5, "Defect Re - Open", countFor("re_open")],
      [6, "Defect Solved", countFor("solved")],
    ];
    summaryRows.forEach(([row, label, count]) => {
      setLabelCell(`E${row}`, label);
      sheet.getCell(`F${row}`).value = count;
    });

    setLabelCell("H2", "Catatan:");
    DEFECT_NOTES.forEach((note, index) => {
      const row = index + 3;
      sheet.mergeCells(`H${row}:L${row}`);
      const cell = sheet.getCell(`H${row}`);
      cell.value = `${index + 1}. ${note}`;
      cell.alignment = { wrapText: true, vertical: "top" };
    });

    const headerRow = sheet.getRow(DEFECT_HEADER_ROW);
    DEFECT_HEADERS.forEach((text, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = text;
      cell.fill = LABEL_FILL;
      cell.font = LABEL_FONT;
      cell.alignment = { vertical: "middle" };
      cell.border = THIN_BORDER;
    });
    headerRow.commit();

    defects.forEach((defect, index) => {
      const row = sheet.getRow(DEFECT_HEADER_ROW + 1 + index);
      const priorityKey = normalizeDefectPriority(
        defect.priority || defect.severity,
        priorityValues,
      );
      const statusKey = normalizeDefectStatus(defect.status, statusValues);

      row.getCell(1).value = defect.reporter || "";
      row.getCell(2).value = formatDisplayDate(
        defect.reported_at || defect.created_at,
      );
      row.getCell(3).value = defect.issue_id || defect.def_id || "";
      row.getCell(4).value = defect.description || defect.title || "";
      row.getCell(4).alignment = { wrapText: true, vertical: "top" };

      const priorityCell = row.getCell(5);
      priorityCell.value = labelize(defect.priority || defect.severity);
      priorityCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: PRIORITY_FILLS[priorityKey] || "FFFFFFFF" },
      };
      priorityCell.alignment = { horizontal: "center" };

      const attachmentCell = row.getCell(6);
      if (defect.attachment && /^https?:\/\//i.test(defect.attachment)) {
        attachmentCell.value = {
          text: fileLabelFromUrl(defect.attachment),
          hyperlink: defect.attachment,
        };
        attachmentCell.font = { color: { argb: "FF1155CC" }, underline: true };
      } else {
        attachmentCell.value = defect.attachment || "";
      }

      const statusCell = row.getCell(7);
      statusCell.value = labelizeDefectStatus(defect.status, statusOptions);
      const statusStyle = STATUS_FILLS[statusKey] || {
        bg: "FFFFFFFF",
        font: "FF000000",
      };
      statusCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: statusStyle.bg },
      };
      statusCell.font = { color: { argb: statusStyle.font }, bold: true };
      statusCell.alignment = { horizontal: "center" };

      row.getCell(8).value = defect.handled_by || "";
      row.getCell(9).value = formatDisplayDate(defect.updated_at);
      row.getCell(10).value = defect.developer_notes || "";
      row.getCell(10).alignment = { wrapText: true, vertical: "top" };
      row.getCell(11).value = defect.qa_notes || "";
      row.getCell(11).alignment = { wrapText: true, vertical: "top" };

      const mrCell = row.getCell(12);
      if (defect.merge_request && /^https?:\/\//i.test(defect.merge_request)) {
        mrCell.value = {
          text: fileLabelFromUrl(defect.merge_request),
          hyperlink: defect.merge_request,
        };
        mrCell.font = { color: { argb: "FF1155CC" }, underline: true };
      } else {
        mrCell.value = defect.merge_request || "";
      }

      for (let col = 1; col <= DEFECT_HEADERS.length; col += 1) {
        row.getCell(col).border = THIN_BORDER;
      }
      row.commit();
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `defects-${selectedProject?.name || "havox"}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function uploadExcel(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editable) return;
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const meta = XLSX.utils.sheet_to_json(ws, {
        header: 1,
      }) as (string | number | undefined)[][];
      const hasMetaRows =
        String(meta[0]?.[0] || "")
          .trim()
          .toLowerCase() === "modul name";
      const moduleName = hasMetaRows
        ? meta[0]?.[1] || selectedProject?.name || ""
        : selectedProject?.name || "";
      const environment = hasMetaRows
        ? meta[1]?.[1] || "Development"
        : "Development";
      const databaseName = hasMetaRows ? meta[2]?.[1] || "" : "";
      const rows = XLSX.utils.sheet_to_json(ws, {
        range: hasMetaRows ? 4 : 0,
      }) as DefectExcelRow[];
      const inserts = rows
        .filter((row) => row["Description"] || row["Issue ID"])
        .map((row, index) => {
          const description = cellText(row["Description"]);
          const priority = normalizeDefectPriority(
            row["Priority"],
            priorityValues,
          );
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
            status: normalizeDefectStatus(row["Status"], statusValues),
            handled_by: cellText(row["Handled By"]),
            developer_notes: cellText(row["Developer Notes"]),
            qa_notes: cellText(row["QA Notes"]),
            merge_request: cellText(
              row["Merge Request"] ?? row["Link Merge Request"],
            ),
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

  const statusCounts = statusOptions.map((option) => ({
    status: option.value,
    label: option.label,
    accent: option.accent,
    count: defects.filter(
      (d) => normalizeDefectStatus(d.status, statusValues) === option.value,
    ).length,
  }));

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
          <CustomSelect
            value={selectedProjectId}
            onChange={setSelectedProjectId}
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
            triggerClassName="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={openCreate}
          disabled={!selectedProjectId || !editable}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
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
            disabled={!editable}
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

      <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
        <ShieldCheck size={15} />
        Akses Anda:{" "}
        {projectRole
          ? labelize(projectRole)
          : isSystemAdmin
            ? "Admin"
            : "No Access"}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {defects.length}
          </p>
        </div>
        {statusCounts.map(({ status, label, accent, count }) => (
          <div
            key={status}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p
              className={`mt-1 text-2xl font-semibold ${accentTextClass(accent)}`}
            >
              {count}
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
            <table className="w-full min-w-330 table-fixed text-sm">
              <colgroup>
                <col className="w-27.5" />
                <col className="w-25" />
                <col className="w-22.5" />
                <col className="w-65" />
                <col className="w-22.5" />
                <col className="w-35" />
                <col className="w-25" />
                <col className="w-27.5" />
                <col className="w-25" />
                <col className="w-42.5" />
                <col className="w-42.5" />
                <col className="w-42.5" />
                <col className="w-17.5" />
              </colgroup>
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
                    "Handled By",
                    "Updated At",
                    "Developer Notes",
                    "QA Notes",
                    "Merge Request",
                    "",
                  ].map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-green-900"
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
                    className="border-b border-gray-100 align-top hover:bg-gray-50"
                  >
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3">
                      {defect.reporter || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {formatDisplayDate(
                        defect.reported_at || defect.created_at,
                      )}
                    </td>
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3 font-mono text-xs text-gray-500">
                      {defect.issue_id || defect.def_id || "-"}
                    </td>
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3 font-medium text-gray-900">
                      {defect.description || defect.title}
                    </td>
                    <td className="px-3 py-3">
                      <CustomSelect
                        value={normalizeDefectPriority(
                          defect.priority || defect.severity,
                          priorityValues,
                        )}
                        onChange={(value) =>
                          updateDefectPriority(defect.id, value)
                        }
                        disabled={!editable}
                        chevronSize={12}
                        options={priorityOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        className="inline-block w-auto"
                        triggerClassName={`whitespace-nowrap rounded-full py-1 pl-2 pr-1.5 text-xs font-semibold cursor-pointer ${badgeColor(
                          priorityOptions,
                          normalizeDefectPriority(
                            defect.priority || defect.severity,
                            priorityValues,
                          ),
                        )}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <LinkChip
                        value={defect.attachment}
                        icon={
                          <Paperclip
                            size={12}
                            className="shrink-0 text-gray-400"
                          />
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <CustomSelect
                        value={normalizeDefectStatus(
                          defect.status,
                          statusValues,
                        )}
                        onChange={(value) =>
                          updateDefectStatus(defect.id, value)
                        }
                        disabled={!editable}
                        chevronSize={12}
                        options={statusOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                        triggerClassName={`cursor-pointer rounded-full py-1 pl-2 pr-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed ${badgeColor(
                          statusOptions,
                          normalizeDefectStatus(defect.status, statusValues),
                        )}`}
                      />
                    </td>
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3 text-gray-600">
                      {defect.handled_by || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-500">
                      {formatDisplayDate(defect.updated_at)}
                    </td>
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3 text-gray-600">
                      {defect.developer_notes || "-"}
                    </td>
                    <td className="whitespace-pre-wrap wrap-break-word px-3 py-3 text-gray-600">
                      {defect.qa_notes || "-"}
                    </td>
                    <td className="px-3 py-3">
                      <LinkChip
                        value={defect.merge_request}
                        icon={
                          <Link2 size={12} className="shrink-0 text-gray-400" />
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEdit(defect)}
                          disabled={!editable}
                          className="p-1.5 text-gray-400 hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Edit defect"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteDefect(defect.id)}
                          disabled={!editable}
                          className="p-1.5 text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                          title="Hapus defect"
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
                  setSaveError(null);
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
                <CustomSelect
                  value={form.project_id}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, project_id: value }))
                  }
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  triggerClassName="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
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
                ["Handled By", "handled_by", "Nama developer/PIC"],
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
                <CustomSelect
                  value={form.priority}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, priority: value }))
                  }
                  options={priorityOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  triggerClassName="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Status
                </label>
                <CustomSelect
                  value={form.status}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value }))
                  }
                  options={statusOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  triggerClassName="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
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
            {saveError && (
              <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                Gagal menyimpan defect: {saveError}
              </div>
            )}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSaveError(null);
                  resetForm();
                }}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={saveDefect}
                disabled={
                  !form.project_id || !form.description.trim() || saving
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
              >
                <Check size={15} />
                {saving
                  ? "Menyimpan..."
                  : editingId
                    ? "Simpan Perubahan"
                    : "Tambah Defect"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
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
                <UserEmailAutocomplete
                  value={accessEmail}
                  onChange={setAccessEmail}
                  users={knownUsers}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
                <CustomSelect
                  value={accessRole}
                  onChange={(value) => setAccessRole(value as AccessRole)}
                  options={ACCESS_ROLES.filter((role) => role !== "owner").map(
                    (role) => ({ value: role, label: labelize(role) }),
                  )}
                  triggerClassName="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                />
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
