import { useEffect, useMemo, useState } from "react";
import JoditEditor from "jodit-react";
import "jodit/es2021/jodit.min.css";
import {
  Copy,
  Download,
  Eye,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Table,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { DocumentTemplate, Project, TestCase } from "../types";
import { labelize } from "../lib/domain";
import { useAuth } from "../hooks/useAuth";

const PLACEHOLDERS = [
  "PROJECT_NO",
  "PROJECT_TITLE",
  "DOCUMENT_DATE",
  "DIVISION",
  "PRODUCT_MODULE",
  "VERSION",
  "TEST_PLAN_LINK",
  "SUPPORTING_DOCUMENTS",
  "BACKGROUND",
  "EXPECTED_RESULT_LIST",
  "SCENARIO_NO",
  "SCENARIO_TITLE",
  "SCENARIO_EXPECTED_RESULT",
  "SCENARIO_RESULT",
  "SCENARIO_NOTE",
  "TEST_CASE_CODE",
  "TEST_CASE_SCENARIO",
  "TEST_CASE_PRECONDITION",
  "TEST_CASE_STEPS",
  "TEST_CASE_EXPECTED_RESULT",
  "TEST_CASE_ACTUAL_RESULT",
  "TEST_CASE_FINAL_RESULT",
  "TEST_CASE_NOTE",
  "NOTES",
  "APPROVAL_TABLE",
  "REVISION_HISTORY",
];

const DEFAULT_TEMPLATE = `
<section class="qad-page">
  <div class="qad-cover">
    <p class="qad-company">PT Pegadaian</p>
    <p class="qad-squad">Squad Human Capital</p>
    <p class="qad-cover-project">\${PROJECT_TITLE}</p>
    <h1>Quality Assurance Document</h1>
    <p>Nomor: \${PROJECT_NO}</p>
    <p>Ver \${VERSION}</p>
    <p>\${DOCUMENT_DATE}</p>
  </div>

  <div class="qad-info-page">
    <h1>Quality Assurance Document (QAD)</h1>
    <table class="qad-meta">
      <tr><td>Project No.</td><td>\${PROJECT_NO}</td></tr>
      <tr><td>Project Title</td><td>\${PROJECT_TITLE}</td></tr>
      <tr><td>Date</td><td>\${DOCUMENT_DATE}</td></tr>
      <tr><td>Division</td><td>\${DIVISION}</td></tr>
      <tr><td>Product/Module</td><td>\${PRODUCT_MODULE}</td></tr>
      <tr><td>Version</td><td>\${VERSION}</td></tr>
      <tr><td>Test Plan Link</td><td>\${TEST_PLAN_LINK}</td></tr>
    </table>

    <p class="qad-supporting-title">Supporting Document(s)</p>
    \${SUPPORTING_DOCUMENTS}

    <h2 class="qad-center-title">DAFTAR ISI</h2>
    <table class="qad-toc-table">
      <tr><td>1. OVERVIEW</td><td>4</td></tr>
      <tr><td class="qad-toc-child">1.1. Background</td><td>4</td></tr>
      <tr><td class="qad-toc-child">1.2. Expected Result</td><td>4</td></tr>
      <tr><td>2. SCENARIO TEST</td><td>7</td></tr>
      <tr><td>3. REPORT</td><td>13</td></tr>
      <tr><td>4. CATATAN</td><td>110</td></tr>
      <tr><td>LEMBAR PERSETUJUAN</td><td>111</td></tr>
      <tr><td>Revision History</td><td>112</td></tr>
    </table>
  </div>

  <h2 class="qad-section-title">1. OVERVIEW</h2>
  <h3>1.1. Background</h3>
  <p class="qad-paragraph">\${BACKGROUND}</p>

  <h3>1.2. Expected Result</h3>
  \${EXPECTED_RESULT_LIST}

  <h2 class="qad-section-title">2. SCENARIO TEST</h2>
  <table class="qad-scenario-table">
    <thead>
      <tr>
        <th>No.</th>
        <th>Scenario</th>
        <th>Expected Result</th>
        <th>Result (Passed, Failed)</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      <!-- SCENARIO_ROW_START -->
      <tr>
        <td>\${SCENARIO_NO}</td>
        <td>\${SCENARIO_TITLE}</td>
        <td>\${SCENARIO_EXPECTED_RESULT}</td>
        <td>\${SCENARIO_RESULT}</td>
        <td>\${SCENARIO_NOTE}</td>
      </tr>
      <!-- SCENARIO_ROW_END -->
    </tbody>
  </table>

  <h2 class="qad-section-title">3. REPORT</h2>
  <!-- TEST_CASE_REPORT_START -->
  <div class="tc-report">
    <p class="tc-report-title">Test Case \${TEST_CASE_CODE}</p>
    <table class="tc-report-table">
      <tr><td>Scenario</td><td>\${TEST_CASE_SCENARIO}</td></tr>
      <tr><td>Precondition(s)</td><td>\${TEST_CASE_PRECONDITION}</td></tr>
      <tr><td>Test Details</td><td>\${TEST_CASE_STEPS}</td></tr>
      <tr><td>Expected Result</td><td>\${TEST_CASE_EXPECTED_RESULT}</td></tr>
      <tr><td>Actual Result</td><td>\${TEST_CASE_ACTUAL_RESULT}</td></tr>
      <tr><td>Final Result</td><td>\${TEST_CASE_FINAL_RESULT}</td></tr>
      <tr><td>Note:</td><td>\${TEST_CASE_NOTE}</td></tr>
    </table>
  </div>
  <!-- TEST_CASE_REPORT_END -->

  <h2 class="qad-section-title">4. CATATAN</h2>
  <p class="qad-paragraph">\${NOTES}</p>

  <h2 class="qad-section-title">LEMBAR PERSETUJUAN</h2>
  \${APPROVAL_TABLE}

  <h2 class="qad-section-title">Revision History</h2>
  \${REVISION_HISTORY}
</section>`;

const SCENARIO_TABLE_SNIPPET = `<table class="qad-scenario-table">
  <thead>
    <tr>
      <th>No.</th>
      <th>Scenario</th>
      <th>Expected Result</th>
      <th>Result (Passed, Failed)</th>
      <th>Note</th>
    </tr>
  </thead>
  <tbody>
    <!-- SCENARIO_ROW_START -->
    <tr>
      <td>\${SCENARIO_NO}</td>
      <td>\${SCENARIO_TITLE}</td>
      <td>\${SCENARIO_EXPECTED_RESULT}</td>
      <td>\${SCENARIO_RESULT}</td>
      <td>\${SCENARIO_NOTE}</td>
    </tr>
    <!-- SCENARIO_ROW_END -->
  </tbody>
</table>`;

const TEST_CASE_REPORT_SNIPPET = `<!-- TEST_CASE_REPORT_START -->
<div class="tc-report">
  <p class="tc-report-title">Test Case \${TEST_CASE_CODE}</p>
  <table class="tc-report-table">
    <tr><td>Scenario</td><td>\${TEST_CASE_SCENARIO}</td></tr>
    <tr><td>Precondition(s)</td><td>\${TEST_CASE_PRECONDITION}</td></tr>
    <tr><td>Test Details</td><td>\${TEST_CASE_STEPS}</td></tr>
    <tr><td>Expected Result</td><td>\${TEST_CASE_EXPECTED_RESULT}</td></tr>
    <tr><td>Actual Result</td><td>\${TEST_CASE_ACTUAL_RESULT}</td></tr>
    <tr><td>Final Result</td><td>\${TEST_CASE_FINAL_RESULT}</td></tr>
    <tr><td>Note:</td><td>\${TEST_CASE_NOTE}</td></tr>
  </table>
</div>
<!-- TEST_CASE_REPORT_END -->`;

const APPROVAL_TABLE_SNIPPET = `<table class="qad-signature-table">
  <thead>
    <tr>
      <th>Role</th>
      <th>Name / Position</th>
      <th>Signature / Date</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>Prepared by</td><td>QA Engineer</td><td></td></tr>
    <tr><td>Reviewed by</td><td>QA Lead</td><td></td></tr>
    <tr><td>Approved by</td><td>Project Owner</td><td></td></tr>
  </tbody>
</table>`;

const REVISION_HISTORY_SNIPPET = `<table>
  <thead>
    <tr>
      <th>Version</th>
      <th>Date</th>
      <th>Description</th>
      <th>Author</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>1.0</td><td>\${DOCUMENT_DATE}</td><td>Initial document</td><td>QA</td></tr>
  </tbody>
</table>`;

const PRINT_STYLE = `
  body { margin: 0; background: #f3f4f6; font-family: Arial, Helvetica, sans-serif; color: #111827; }
  .qad-page { width: 210mm; min-height: 297mm; margin: 24px auto; padding: 20mm 19mm; background: white; box-shadow: 0 8px 30px rgba(15,23,42,.12); box-sizing: border-box; font-size: 11px; line-height: 1.45; }
  .qad-cover { min-height: 250mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
  .qad-company { font-size: 18px; font-weight: 700; margin: 0 0 10px; }
  .qad-squad { font-size: 12px; margin: 0 0 42px; }
  .qad-cover-project { max-width: 135mm; font-size: 14px; font-weight: 700; margin: 0 0 18px; }
  .qad-cover h1 { font-size: 24px; margin: 12px 0 22px; }
  .qad-cover p { margin: 4px 0; }
  .qad-info-page { min-height: 250mm; page-break-after: always; }
  .qad-info-page h1 { text-align: center; font-size: 18px; margin: 0 0 18px; }
  .qad-center-title { text-align: center; margin-top: 34px; }
  .qad-section-title { font-size: 16px; margin: 24px 0 12px; page-break-after: avoid; }
  h1 { font-size: 20px; margin: 12px 0; }
  h2 { font-size: 15px; margin: 22px 0 10px; }
  h3 { font-size: 12px; margin: 16px 0 8px; }
  .qad-paragraph { text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 18px; }
  td, th { border: 1px solid #9ca3af; padding: 6px 7px; vertical-align: top; }
  th { background: #f3f4f6; text-align: left; font-weight: 700; }
  .qad-meta td:first-child { width: 145px; font-weight: 700; background: #f9fafb; }
  .qad-supporting-title { font-weight: 700; margin: 18px 0 6px; }
  .qad-checklist { list-style: none; padding-left: 0; margin: 0 0 16px; }
  .qad-checklist li { margin: 4px 0; }
  .qad-checklist li:before { content: "✔"; margin-right: 8px; }
  .qad-toc-table td { border: 0; border-bottom: 1px dotted #9ca3af; padding: 5px 0; }
  .qad-toc-table td:last-child { width: 42px; text-align: right; }
  .qad-toc-child { padding-left: 18px !important; }
  .qad-scenario-table th:nth-child(1), .qad-scenario-table td:nth-child(1) { width: 34px; text-align: center; }
  .qad-scenario-table th:nth-child(4), .qad-scenario-table td:nth-child(4) { width: 88px; text-align: center; }
  .qad-scenario-table th:nth-child(5), .qad-scenario-table td:nth-child(5) { width: 88px; }
  .tc-report { page-break-inside: avoid; margin-bottom: 18px; }
  .tc-report-title { font-size: 13px; font-weight: 700; margin: 18px 0 8px; }
  .tc-report-table td:first-child { width: 128px; font-weight: 700; background: #f9fafb; }
  .qad-signature-table td { height: 72px; }
  @media print {
    body { background: white; }
    .qad-page { margin: 0; box-shadow: none; width: auto; min-height: auto; }
  }
`;

function getManualQadMetaDefaults() {
  return {
    DOCUMENT_DATE: todayId(),
    DIVISION: "Human Capital Service",
    PRODUCT_MODULE: "HCMS 4.0",
    VERSION: "1.0",
    SUPPORTING_DOCUMENTS:
      "Project Plan\nG-Canvas\nSoftware Development Document (SDD)\nOther ..............",
    BACKGROUND:
      "Jumlah karyawan PT Pegadaian sampai saat ini kurang lebih dari 14.000 karyawan yang terdiri dari karyawan Perjanjian Kontrak Waktu Tidak Tertentu (PKWTT) dan karyawan Perjanjian Kontrak Waktu Tertentu (PKWT). Arah strategis PT Pegadaian saat ini menuju arah digitalisasi bisnis perusahaan yang mana salah satu inisiatif dalam transformasi perusahaan yakni Groom Talent. Untuk mendukung arah strategis perusahaan perlu disiapkan suatu sarana pendukung sistem aplikasi pengelolaan karyawan yang modern, digital dan terintegrasi dengan Enterprise Resources Plan (ERP) serta mampu menjawab semua kebutuhan dari sisi Karyawan.",
    APPROVAL_TABLE:
      "Prepared by|QA Engineer|\nReviewed by|QA Lead|\nApproved by|Project Owner|",
    REVISION_HISTORY: `1.0|${todayId()}|Initial document|QA`,
  };
}

function todayId() {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value?: string) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlLines(value?: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function buildExpectedResultList(testCases: TestCase[]) {
  const rows = testCases
    .filter((tc) => tc.expected_result)
    .map((tc) => `<li>${htmlLines(tc.expected_result)}</li>`)
    .join("");
  return rows ? `<ol>${rows}</ol>` : "<p>-</p>";
}

function replaceTokens(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (html, [key, value]) => html.split(`\${${key}}`).join(value),
    template,
  );
}

function renderRepeatBlock(
  template: string,
  startMarker: string,
  endMarker: string,
  rows: Record<string, string>[],
  emptyHtml: string,
) {
  const start = template.indexOf(startMarker);
  const end = template.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) return template;

  const blockStart = start + startMarker.length;
  const rowTemplate = template.slice(blockStart, end);
  const renderedRows =
    rows.length > 0
      ? rows.map((row) => replaceTokens(rowTemplate, row)).join("")
      : emptyHtml;

  return `${template.slice(0, start)}${renderedRows}${template.slice(end + endMarker.length)}`;
}

function scenarioRows(testCases: TestCase[]) {
  return testCases.map((tc, index) => ({
    SCENARIO_NO: String(index + 1),
    SCENARIO_TITLE: escapeHtml(tc.title),
    SCENARIO_EXPECTED_RESULT: htmlLines(tc.expected_result),
    SCENARIO_RESULT: labelize(tc.status),
    SCENARIO_NOTE: escapeHtml(tc.tester || ""),
  }));
}

function testCaseReportRows(testCases: TestCase[]) {
  return testCases.map((tc) => ({
    TEST_CASE_CODE: escapeHtml(tc.tc_id || tc.test_case_code || "-"),
    TEST_CASE_SCENARIO: escapeHtml(tc.title),
    TEST_CASE_PRECONDITION: htmlLines(tc.precondition || tc.preconditions),
    TEST_CASE_STEPS: htmlLines(tc.steps),
    TEST_CASE_EXPECTED_RESULT: htmlLines(tc.expected_result),
    TEST_CASE_ACTUAL_RESULT: htmlLines(tc.actual_result),
    TEST_CASE_FINAL_RESULT: labelize(tc.status),
    TEST_CASE_NOTE: escapeHtml(tc.tester ? `Tester: ${tc.tester}` : ""),
  }));
}

function buildSupportingDocuments(value?: string) {
  const items =
    value
      ?.split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean) || [
      "Project Plan",
      "G-Canvas",
      "Software Development Document (SDD)",
      "Other ..............",
    ];
  return `<ul class="qad-checklist">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function buildApprovalTable(value?: string) {
  const rows =
    value
      ?.split(/\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split("|").map((cell) => cell.trim())) || [];
  const data =
    rows.length > 0
      ? rows
      : [
        ["Prepared by", "QA Engineer", ""],
        ["Reviewed by", "QA Lead", ""],
        ["Approved by", "Project Owner", ""],
      ];

  return `
    <table>
      <thead>
        <tr><th>Role</th><th>Name / Position</th><th>Signature / Date</th></tr>
      </thead>
      <tbody>
        ${data
      .map(
        ([role, name, signature]) =>
          `<tr><td>${escapeHtml(role)}</td><td>${escapeHtml(name)}</td><td>${escapeHtml(signature)}</td></tr>`,
      )
      .join("")}
      </tbody>
    </table>`;
}

function buildRevisionHistory(value?: string) {
  const rows =
    value
      ?.split(/\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) => row.split("|").map((cell) => cell.trim())) || [];
  const data =
    rows.length > 0
      ? rows
      : [["1.0", todayId(), "Initial document", "QA"]];

  return `
    <table>
      <thead>
        <tr><th>Version</th><th>Date</th><th>Description</th><th>Author</th></tr>
      </thead>
      <tbody>
        ${data
      .map(
        ([version, date, description, author]) =>
          `<tr><td>${escapeHtml(version)}</td><td>${escapeHtml(date)}</td><td>${escapeHtml(description)}</td><td>${escapeHtml(author)}</td></tr>`,
      )
      .join("")}
      </tbody>
    </table>`;
}

function renderTemplate(
  template: string,
  project: Project | undefined,
  testCases: TestCase[],
  meta: Record<string, string>,
) {
  const repeatedHtml = renderRepeatBlock(
    renderRepeatBlock(
      template,
      "<!-- SCENARIO_ROW_START -->",
      "<!-- SCENARIO_ROW_END -->",
      scenarioRows(testCases),
      `<tr><td colspan="5">Belum ada test case.</td></tr>`,
    ),
    "<!-- TEST_CASE_REPORT_START -->",
    "<!-- TEST_CASE_REPORT_END -->",
    testCaseReportRows(testCases),
    "<p>Belum ada test case.</p>",
  );

  const values: Record<string, string> = {
    PROJECT_NO: meta.PROJECT_NO || project?.id?.slice(0, 8).toUpperCase() || "-",
    PROJECT_TITLE: meta.PROJECT_TITLE || project?.name || "-",
    DOCUMENT_DATE: meta.DOCUMENT_DATE || todayId(),
    DIVISION: meta.DIVISION || "Quality Assurance",
    PRODUCT_MODULE: meta.PRODUCT_MODULE || project?.name || "-",
    VERSION: meta.VERSION || "1.0",
    TEST_PLAN_LINK: meta.TEST_PLAN_LINK || "-",
    SUPPORTING_DOCUMENTS: buildSupportingDocuments(meta.SUPPORTING_DOCUMENTS),
    BACKGROUND:
      meta.BACKGROUND ||
      "Dokumen ini disusun sebagai hasil kegiatan quality assurance berdasarkan test case yang telah dibuat dan dieksekusi.",
    EXPECTED_RESULT_LIST: buildExpectedResultList(testCases),
    NOTES: meta.NOTES || "-",
    APPROVAL_TABLE: buildApprovalTable(meta.APPROVAL_TABLE),
    REVISION_HISTORY: buildRevisionHistory(meta.REVISION_HISTORY),
  };

  return replaceTokens(repeatedHtml, values);
}

function downloadHtml(filename: string, body: string) {
  const blob = new Blob(
    [
      `<!doctype html><html><head><meta charset="utf-8"><title>${filename}</title><style>${PRINT_STYLE}</style></head><body>${body}</body></html>`,
    ],
    { type: "text/html;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [name, setName] = useState("QAD Default Template");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState(DEFAULT_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<Record<string, string>>(
    getManualQadMetaDefaults,
  );

  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );
  const renderedHtml = useMemo(
    () => renderTemplate(content, selectedProject, testCases, meta),
    [content, meta, selectedProject, testCases],
  );

  const editorConfig = useMemo(
    () => ({
      height: 560,
      toolbarSticky: true,
      uploader: { insertImageAsBase64URI: true },
      buttons:
        "bold,italic,underline,strikethrough,eraser,ul,ol,font,fontsize,paragraph,brush,table,link,image,hr,align,undo,redo,source,fullsize,preview,print",
    }),
    [],
  );

  useEffect(() => {
    fetchTemplates();
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) fetchTestCases(selectedProjectId);
    else setTestCases([]);
  }, [selectedProjectId]);

  async function fetchTemplates() {
    const { data } = await supabase
      .from("document_templates")
      .select("*")
      .eq("document_type", "QAD")
      .order("created_at", { ascending: false });
    const rows = (data || []) as DocumentTemplate[];
    setTemplates(rows);
    if (rows[0]) loadTemplate(rows[0]);
  }

  async function fetchProjects() {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data || []) as Project[];
    setProjects(rows);
    if (rows[0]) setSelectedProjectId(rows[0].id);
  }

  async function fetchTestCases(projectId: string) {
    const { data } = await supabase
      .from("test_cases")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    setTestCases((data || []) as TestCase[]);
  }

  function loadTemplate(template: DocumentTemplate) {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setDescription(template.description || "");
    setContent(template.content_html || DEFAULT_TEMPLATE);
  }

  function createNewTemplate() {
    setSelectedTemplateId("");
    setName("QAD Manual Template");
    setDescription("Template mengikuti format QAD manual");
    setContent(DEFAULT_TEMPLATE);
    setMeta(getManualQadMetaDefaults());
  }

  function applyManualQadTemplate() {
    setName(name.trim() || "QAD Manual Template");
    setDescription("Template mengikuti format QAD manual");
    setContent(DEFAULT_TEMPLATE);
    setMeta((prev) => ({ ...getManualQadMetaDefaults(), ...prev }));
  }

  async function saveTemplate() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      document_type: "QAD",
      description: description.trim(),
      content_html: content,
      created_by: user?.id,
    };
    const { data, error } = selectedTemplateId
      ? await supabase
        .from("document_templates")
        .update(payload)
        .eq("id", selectedTemplateId)
        .select("*")
        .single()
      : await supabase
        .from("document_templates")
        .insert(payload)
        .select("*")
        .single();
    if (!error && data) {
      loadTemplate(data as DocumentTemplate);
      fetchTemplates();
    }
    setSaving(false);
  }

  async function deleteTemplate() {
    if (!selectedTemplateId || !confirm("Hapus template ini?")) return;
    await supabase
      .from("document_templates")
      .delete()
      .eq("id", selectedTemplateId);
    createNewTemplate();
    fetchTemplates();
  }

  function copyPlaceholder(value: string) {
    navigator.clipboard.writeText(`\${${value}}`);
  }

  function copySnippet(value: string) {
    navigator.clipboard.writeText(value);
  }

  function insertSnippet(value: string) {
    setContent((current) => `${current}\n\n${value}`);
  }

  function openPrintPreview() {
    const popup = window.open("", "_blank");
    if (!popup) return;
    popup.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>QAD Preview</title><style>${PRINT_STYLE}</style></head><body>${renderedHtml}</body></html>`,
    );
    popup.document.close();
    popup.focus();
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              QAD Template Master
            </h1>
            <p className="text-sm text-gray-500">
              Kelola template dokumen QAD dan generate dari test case project.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={createNewTemplate}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Plus size={15} /> Template Baru
          </button>
          <button
            onClick={applyManualQadTemplate}
            className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50"
          >
            <RotateCcw size={15} /> Gunakan Format QAD Manual
          </button>
          <button
            onClick={saveTemplate}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            <Save size={15} /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            onClick={deleteTemplate}
            disabled={!selectedTemplateId}
            className="flex items-center gap-2 rounded-lg border border-red-100 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 size={15} /> Hapus
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => {
                const template = templates.find((row) => row.id === e.target.value);
                if (template) loadTemplate(template);
              }}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Template baru</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Project Source
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Pilih project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-400">
              {testCases.length} test case akan masuk ke QAD.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
              Placeholder
            </p>
            <div className="flex flex-wrap gap-2">
              {PLACEHOLDERS.map((placeholder) => (
                <button
                  key={placeholder}
                  onClick={() => copyPlaceholder(placeholder)}
                  className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                  title="Copy placeholder"
                >
                  ${`{${placeholder}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Dynamic Tables
            </p>
            <p className="mb-3 text-xs leading-relaxed text-gray-500">
              Header, kolom, dan style tabel boleh diubah. Bagian di antara
              marker akan diulang otomatis per test case.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => copySnippet(SCENARIO_TABLE_SNIPPET)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Copy Scenario Table Block
              </button>
              <button
                onClick={() => copySnippet(TEST_CASE_REPORT_SNIPPET)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Copy Report Detail Block
              </button>
              <button
                onClick={() => copySnippet(APPROVAL_TABLE_SNIPPET)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Copy Approval Table
              </button>
              <button
                onClick={() => copySnippet(REVISION_HISTORY_SNIPPET)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Copy Revision Table
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
              Metadata
            </p>
            {[
              ["PROJECT_NO", "Nomor project/dokumen"],
              ["PROJECT_TITLE", "Judul dokumen"],
              ["DOCUMENT_DATE", "Tanggal dokumen"],
              ["DIVISION", "Divisi"],
              ["PRODUCT_MODULE", "Product/module"],
              ["VERSION", "Versi"],
              ["TEST_PLAN_LINK", "Link test plan"],
            ].map(([key, placeholder]) => (
              <input
                key={key}
                value={meta[key] || ""}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-emerald-400 focus:outline-none"
              />
            ))}
            {[
              ["BACKGROUND", "Background dokumen"],
              [
                "SUPPORTING_DOCUMENTS",
                "Supporting documents, pisahkan dengan enter",
              ],
              ["NOTES", "Catatan tambahan"],
              [
                "APPROVAL_TABLE",
                "Format: Role|Name / Position|Signature / Date",
              ],
              [
                "REVISION_HISTORY",
                "Format: Version|Date|Description|Author",
              ],
            ].map(([key, placeholder]) => (
              <textarea
                key={key}
                value={meta[key] || ""}
                onChange={(e) =>
                  setMeta((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={placeholder}
                rows={key === "BACKGROUND" ? 5 : 3}
                className="mb-2 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-emerald-400 focus:outline-none"
              />
            ))}
          </div>
        </aside>

        <main className="space-y-5">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:border-emerald-400 focus:outline-none"
                placeholder="Nama template"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                placeholder="Deskripsi"
              />
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => insertSnippet(SCENARIO_TABLE_SNIPPET)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                type="button"
              >
                <Table size={14} /> Insert Scenario Table
              </button>
              <button
                onClick={() => insertSnippet(TEST_CASE_REPORT_SNIPPET)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                type="button"
              >
                <Table size={14} /> Insert Report Detail
              </button>
              <button
                onClick={() => insertSnippet(APPROVAL_TABLE_SNIPPET)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                type="button"
              >
                <Table size={14} /> Insert Approval
              </button>
              <button
                onClick={() => insertSnippet(REVISION_HISTORY_SNIPPET)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                type="button"
              >
                <Table size={14} /> Insert Revision
              </button>
            </div>
            <JoditEditor
              value={content}
              config={editorConfig}
              onChange={(nextContent) => setContent(nextContent)}
              onBlur={(nextContent) => setContent(nextContent)}
            />
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Preview QAD
                </h2>
                <p className="text-xs text-gray-500">
                  Preview memakai data project dan test case yang dipilih.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={openPrintPreview}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Eye size={15} /> Print Preview
                </button>
                <button
                  onClick={() => downloadHtml("qad-preview.html", renderedHtml)}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Download size={15} /> Export HTML
                </button>
              </div>
            </div>
            <div className="max-h-[780px] overflow-auto rounded-lg bg-slate-100 p-6">
              <style>{PRINT_STYLE}</style>
              <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            </div>
          </section>

          <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-800">
            <div className="flex items-start gap-2">
              <Copy size={15} className="mt-0.5" />
              <p>
                Untuk menyisipkan data otomatis, copy placeholder dari panel kiri
                lalu paste ke editor. Placeholder tabel seperti{" "}
                <span className="font-mono">${"{SCENARIO_TEST_TABLE}"}</span>{" "}
                akan diganti dari data test case saat preview/export.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
