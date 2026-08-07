# HavoX Core MVP

## 1. Purpose

Dokumen ini menjadi panduan awal untuk membangun **HavoX Core MVP**.

HavoX adalah **End-to-End Quality Intelligence Platform** yang membantu Quality Assurance dalam mengelola project, test case, manual testing, recorder UI, evidence, defect, dan report.

Untuk MVP awal, fokus utama HavoX adalah:

1. Dashboard QA.
2. Penyimpanan data project.
3. Manajemen test case dasar.
4. Manual test execution foundation.
5. Chrome Recorder untuk UI testing.
6. Penyimpanan hasil recorder.
7. Generate Gherkin dan Selenium Java template dari recorder.

Tagline produk:

> Detect Risk Before It Becomes Havoc.

---

## 2. MVP Scope

### In Scope

Fitur yang masuk ke HavoX Core MVP:

- Authentication menggunakan Supabase Auth.
- Dashboard ringkasan project dan aktivitas testing.
- Project Management.
- Module Management.
- Test Case Management.
- Test Run dasar.
- Manual Execution dasar.
- Evidence foundation.
- Defect foundation.
- Chrome Recorder.
- Recording Session Management.
- Recording Step Management.
- Generate Gherkin dari recorder.
- Generate Selenium Java template dari recorder.
- Basic Report.

### Out of Scope untuk MVP Awal

Fitur berikut belum masuk MVP awal:

- AI Requirement Analysis.
- AI Defect Analysis.
- AI Risk Analysis.
- API Testing Center.
- Newman Runner.
- Jenkins trigger otomatis.
- Release Readiness Score.
- Enterprise Role-Based Access.
- Approval workflow.
- Historical Defect Prediction.

Fitur tersebut akan masuk pada fase berikutnya setelah data QA sudah stabil.

---

## 3. Product Direction

HavoX tidak boleh dibangun sebagai chatbot testing.

HavoX harus dibangun sebagai **QA workflow platform** yang memiliki intelligence layer di masa depan.

Urutan sehat pengembangan:

```text
Data QA
↓
Manual Testing Workflow
↓
Evidence & Defect
↓
Recorder
↓
Automation Handoff
↓
API Testing
↓
AI Intelligence
↓
Risk & Release Readiness
```

AI hanya akan menjadi kuat jika HavoX sudah memiliki data yang rapi:

- Project.
- Module.
- Test Case.
- Test Run.
- Evidence.
- Defect.
- Recording Session.
- Recording Step.

---

## 4. Target Users

### QA Manual

HavoX membantu QA Manual untuk:

- Membuat dan menjalankan test case.
- Melakukan manual test execution.
- Memberikan status PASS, FAIL, BLOCKED, atau NOT RUN.
- Mengupload evidence.
- Mencatat defect.
- Menggunakan recorder untuk testing UI.
- Membuat report hasil testing.

### QA Automation

HavoX membantu QA Automation untuk:

- Mengambil hasil recorder.
- Mengubah recorder menjadi Gherkin.
- Menghasilkan Selenium Java template.
- Mengambil locator candidate.
- Menyalin template ke project Selenium runner.
- Mempersiapkan automation candidate.

### QA Analyst

HavoX membantu QA Analyst untuk:

- Melihat progress testing.
- Melihat module yang berisiko.
- Melihat defect matrix.
- Melihat test execution report.
- Mempersiapkan regression scope pada fase berikutnya.

---

## 5. Current Tech Stack

### HavoX App

```text
React 18
TypeScript
Vite
Tailwind CSS
Supabase Auth
Supabase PostgreSQL
Supabase Storage
Chart.js
XLSX
```

### HavoX Recorder

```text
Chrome Extension Manifest V3
Content Script
Popup Script
DOM Event Listener
Mutation Observer
Local Storage / Message Passing
```

### HavoX Runner

Runner dibuat sebagai project terpisah.

```text
Java
Maven
Selenium
Cucumber
TestNG
WebDriverManager
```

Runner tidak digabungkan ke HavoX App.

---

## 6. Recommended Repository Structure

### HavoX App

```text
havox-app/
├── chrome-extension/
├── docs/
│   ├── 00_PROJECT_VISION.md
│   ├── 01_HAVOX_CONTEXT.md
│   ├── 02_ARCHITECTURE.md
│   ├── 03_DATABASE.md
│   ├── 04_ROADMAP.md
│   ├── 05_HAVOX_CORE_MVP.md
│   └── CODEX_RULES.md
├── src/
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── app-modules/
│   │   ├── test-cases/
│   │   ├── test-runs/
│   │   ├── defects/
│   │   ├── recorder/
│   │   └── reports/
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── layouts/
│   │   └── utils/
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── chart.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── vite.config.ts
└── README.md
```

### HavoX Runner

```text
havox-runner/
├── src/
│   └── test/
│       ├── java/
│       │   ├── pages/
│       │   ├── steps/
│       │   ├── hooks/
│       │   ├── runner/
│       │   └── utils/
│       └── resources/
│           └── features/
├── reports/
├── pom.xml
└── README.md
```

---

## 7. Dashboard MVP

Dashboard harus menjadi halaman awal untuk membaca kondisi QA secara cepat.

### Dashboard Metrics

Minimal tampilkan:

- Total Projects.
- Total Modules.
- Total Test Cases.
- Total Test Runs.
- Total PASS.
- Total FAIL.
- Total BLOCKED.
- Total NOT RUN.
- Open Defects.
- Critical Defects.
- Recent Projects.
- Recent Test Runs.
- Recent Recording Sessions.
- Recent Defects.

### Dashboard Cards

Contoh card:

```text
Total Projects
Total Test Cases
Execution Progress
Pass Rate
Open Defects
Critical Defects
Recording Sessions
```

### Dashboard Charts

Untuk MVP, cukup gunakan chart sederhana:

1. Test execution by status.
2. Defect by severity.
3. Test case by priority.
4. Recent test run progress.

### Dashboard Rules

- Dashboard tidak boleh berisi logic yang terlalu berat di component.
- Gunakan custom hook untuk mengambil data.
- Jika query Supabase mulai kompleks, buat utility/service function.
- Semua angka dashboard harus dihitung dari data nyata di database.

---

## 8. Project Management

Project adalah container utama untuk seluruh aktivitas QA.

### Project Fields

```text
id
name
description
status
created_by
created_at
updated_at
```

### Project Status

```text
ACTIVE
INACTIVE
ARCHIVED
```

### Project Features

- List projects.
- Create project.
- Edit project.
- Delete/archive project.
- View project detail.
- Show related modules.
- Show related test cases.
- Show related test runs.
- Show related recording sessions.

### Project Page Route

```text
/projects
/projects/:projectId
/projects/:projectId/edit
```

---

## 9. Module Management

Module digunakan untuk mengelompokkan test case dan defect.

Contoh module:

```text
Login
Dashboard
Attendance
Leave Request
Approval
Report
User Management
```

### Module Fields

```text
id
project_id
name
description
risk_level
created_at
updated_at
```

### Risk Level

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Module Features

- Create module inside project.
- Edit module.
- Delete module.
- View module test cases.
- View module defects.
- View module recording sessions.

---

## 10. Test Case Management

Test case adalah rencana pengujian.

Test case tidak boleh dicampur dengan hasil eksekusi.

Hasil eksekusi disimpan di `test_run_items`.

### Test Case Fields

```text
id
project_id
module_id
test_case_code
title
preconditions
steps
expected_result
priority
test_type
status
created_by
created_at
updated_at
```

### Priority

```text
LOW
MEDIUM
HIGH
CRITICAL
```

### Test Type

```text
UI
API
POSITIVE
NEGATIVE
BOUNDARY
SMOKE
REGRESSION
SECURITY
INTEGRATION
```

### Test Case Status

```text
DRAFT
READY
NEED_REVIEW
DEPRECATED
```

### Test Case Features

- List test cases.
- Create test case.
- Edit test case.
- Delete/deprecate test case.
- Import Excel.
- Export Excel.
- Filter by project.
- Filter by module.
- Filter by priority.
- Filter by type.
- Filter by status.

---

## 11. Test Run

Test run adalah sesi eksekusi test case.

Contoh:

```text
Sprint 12 Regression
Smoke Test Release 1.0.0
UAT ESS Leave
```

### Test Run Fields

```text
id
project_id
name
description
environment
status
start_date
end_date
created_by
created_at
updated_at
```

### Environment

```text
DEV
STAGING
UAT
PRODUCTION
LOCAL
```

### Test Run Status

```text
PLANNED
IN_PROGRESS
COMPLETED
CANCELLED
```

### Test Run Features

- Create test run.
- Select test cases for test run.
- Start test run.
- Complete test run.
- View execution progress.
- View failed test cases.
- View linked defects.
- Export test run report.

---

## 12. Test Run Items

Test run item adalah hasil eksekusi satu test case dalam satu test run.

### Test Run Item Fields

```text
id
test_run_id
test_case_id
execution_status
actual_result
notes
executed_by
executed_at
created_at
updated_at
```

### Execution Status

```text
NOT_RUN
PASS
FAIL
BLOCKED
SKIPPED
```

### Rules

- Default status adalah NOT_RUN.
- Jika status FAIL, user harus mengisi actual result.
- Jika status FAIL, user disarankan membuat defect.
- Evidence dapat dilampirkan pada test run item.
- Satu test run item dapat memiliki banyak evidence.
- Satu test run item dapat memiliki satu atau lebih defect.

---

## 13. Evidence Management

Evidence adalah bukti hasil testing.

Evidence dapat terhubung ke:

- Test Run Item.
- Defect.
- Recording Step.

### Evidence Fields

```text
id
project_id
test_run_item_id
defect_id
recording_step_id
file_url
file_name
file_type
description
uploaded_by
created_at
```

### Evidence Type

```text
SCREENSHOT
VIDEO
LOG
DOCUMENT
API_RESPONSE
OTHER
```

### Rules

- Evidence disimpan di Supabase Storage.
- Database hanya menyimpan metadata evidence.
- Evidence wajib untuk defect dengan severity Critical atau Major.
- Evidence sangat disarankan untuk test case dengan status FAIL.

---

## 14. Defect Management

Defect adalah catatan kecacatan sistem yang ditemukan saat testing.

### Defect Fields

```text
id
project_id
module_id
test_run_item_id
title
description
expected_result
actual_result
severity
priority
status
reported_by
assigned_to
created_at
updated_at
```

### Severity

```text
CRITICAL
MAJOR
MINOR
TRIVIAL
```

### Priority

```text
HIGH
MEDIUM
LOW
```

### Defect Status

```text
OPEN
IN_PROGRESS
FIXED
RETEST
CLOSED
REJECTED
```

### Defect Features

- Create defect from failed test run item.
- Create defect manually.
- Link defect to project.
- Link defect to module.
- Link defect to evidence.
- Filter by severity.
- Filter by priority.
- Filter by status.
- View defect matrix.

---

## 15. Chrome Recorder MVP

Recorder digunakan untuk merekam aktivitas manual UI testing.

Recorder tidak boleh langsung menghasilkan automation final.

Recorder menghasilkan candidate test case dan automation template.

### Recorder Flow

```text
QA membuka web target
↓
QA klik Start Recorder di Chrome Extension
↓
QA melakukan aktivitas testing
↓
Recorder mencatat action
↓
QA klik Stop Recorder
↓
Recorder membuat recording session
↓
Data dikirim ke HavoX App
↓
QA review session
↓
QA melengkapi title, project, module, priority
↓
QA menyimpan sebagai recording session
↓
QA dapat convert ke test case
↓
QA dapat generate Gherkin
↓
QA dapat generate Selenium Java template
```

### Recorded Actions

Minimal recorder mencatat:

```text
NAVIGATE
CLICK
INPUT
SELECT
SCROLL
ASSERT_TEXT
NOTIFICATION
```

### Recording Session Fields

```text
id
project_id
module_id
title
description
target_url
browser
status
created_by
created_at
updated_at
```

### Recording Session Status

```text
RECORDED
REVIEWED
CONVERTED_TO_TEST_CASE
DISCARDED
```

### Recording Step Fields

```text
id
recording_session_id
step_order
action_type
target_text
locator_css
locator_xpath
value
url
screenshot_url
timestamp
created_at
```

### Locator Candidate Priority

Recorder harus mencoba menyimpan locator dengan prioritas berikut:

1. data-testid
2. aria-label
3. name
4. id
5. role + text
6. css selector
7. xpath

### Recorder Rules

- Jangan hanya menyimpan XPath.
- Simpan beberapa locator candidate jika memungkinkan.
- Simpan text element jika tersedia.
- Simpan URL saat action dilakukan.
- Simpan timestamp.
- Simpan screenshot jika memungkinkan.
- Step harus bisa diedit sebelum dikonversi menjadi test case.
- Recording session harus bisa dihapus atau diarsipkan.

---

## 16. Gherkin Generator MVP

Gherkin generator dapat menggunakan data dari:

- Test case.
- Recording session.

### Output Format

```gherkin
Feature: [Module Name]

  Scenario: [Scenario Title]
    Given user is on [page or url]
    When user [action]
    And user [action]
    Then system should [expected result]
```

### Rules

- Gunakan bahasa yang readable.
- Jangan memasukkan locator teknis ke dalam Gherkin.
- Locator teknis masuk ke Selenium template, bukan Gherkin.
- Jika expected result tidak tersedia, beri placeholder.
- QA harus bisa edit hasil generator.

---

## 17. Selenium Java Template Generator MVP

Selenium generator menghasilkan template awal.

Template bukan automation final.

QA Automation tetap harus review.

### Output

Minimal generate:

1. Feature file.
2. Step definition candidate.
3. Page object candidate.
4. Locator candidate.
5. Notes untuk QA Automation.

### Selenium Rules

- Gunakan Java.
- Gunakan Selenium.
- Gunakan Cucumber.
- Gunakan TestNG.
- Gunakan Page Object Model.
- Gunakan BasePage jika tersedia.
- Hindari Thread.sleep.
- Gunakan explicit wait.
- Locator harus mudah diganti.
- Generated code harus readable.

### Example Output Structure

```text
generated/
├── features/
│   └── login.feature
├── steps/
│   └── LoginSteps.java
└── pages/
    └── LoginPage.java
```

---

## 18. Basic Report MVP

Report MVP menampilkan data dasar.

### Report Types

1. Project Summary Report.
2. Test Run Report.
3. Defect Summary Report.
4. Recorder Session Report.

### Report Metrics

```text
Total Test Cases
Total Executed
Total PASS
Total FAIL
Total BLOCKED
Pass Rate
Fail Rate
Open Defects
Critical Defects
Defect by Module
Defect by Severity
Evidence Count
Recording Session Count
```

### Export

Untuk MVP:

- Export Excel.
- Export JSON.
- PDF dapat masuk fase berikutnya.

---

## 19. Supabase Database Draft

Gunakan ini sebagai draft awal. Sesuaikan dengan struktur project existing.

```sql
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_modules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  risk_level text not null default 'MEDIUM',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module_id uuid references app_modules(id) on delete set null,
  test_case_code text,
  title text not null,
  preconditions text,
  steps jsonb,
  expected_result text,
  priority text not null default 'MEDIUM',
  test_type text not null default 'UI',
  status text not null default 'DRAFT',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  environment text not null default 'STAGING',
  status text not null default 'PLANNED',
  start_date date,
  end_date date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_run_items (
  id uuid primary key default gen_random_uuid(),
  test_run_id uuid not null references test_runs(id) on delete cascade,
  test_case_id uuid not null references test_cases(id) on delete cascade,
  execution_status text not null default 'NOT_RUN',
  actual_result text,
  notes text,
  executed_by uuid,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  module_id uuid references app_modules(id) on delete set null,
  test_run_item_id uuid references test_run_items(id) on delete set null,
  title text not null,
  description text,
  expected_result text,
  actual_result text,
  severity text not null default 'MINOR',
  priority text not null default 'MEDIUM',
  status text not null default 'OPEN',
  reported_by uuid,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recording_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  module_id uuid references app_modules(id) on delete set null,
  title text not null,
  description text,
  target_url text,
  browser text,
  status text not null default 'RECORDED',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recording_steps (
  id uuid primary key default gen_random_uuid(),
  recording_session_id uuid not null references recording_sessions(id) on delete cascade,
  step_order integer not null,
  action_type text not null,
  target_text text,
  locator_css text,
  locator_xpath text,
  value text,
  url text,
  screenshot_url text,
  timestamp timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists evidences (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  test_run_item_id uuid references test_run_items(id) on delete set null,
  defect_id uuid references defects(id) on delete set null,
  recording_step_id uuid references recording_steps(id) on delete set null,
  file_url text not null,
  file_name text,
  file_type text not null default 'OTHER',
  description text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
```

---

## 20. TypeScript Interface Draft

```ts
export type ProjectStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TestCasePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TestCaseStatus = 'DRAFT' | 'READY' | 'NEED_REVIEW' | 'DEPRECATED';
export type ExecutionStatus = 'NOT_RUN' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
export type DefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'TRIVIAL';
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'RETEST' | 'CLOSED' | 'REJECTED';
export type RecordingStatus = 'RECORDED' | 'REVIEWED' | 'CONVERTED_TO_TEST_CASE' | 'DISCARDED';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AppModule {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
}

export interface TestCaseStep {
  order: number;
  action: string;
  expected?: string;
}

export interface TestCase {
  id: string;
  project_id: string;
  module_id?: string;
  test_case_code?: string;
  title: string;
  preconditions?: string;
  steps?: TestCaseStep[];
  expected_result?: string;
  priority: TestCasePriority;
  test_type: string;
  status: TestCaseStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 21. Implementation Order for Codex

Codex harus mengerjakan MVP dengan urutan berikut:

### Step 1 - Docs & Naming

- Pastikan nama produk menggunakan HavoX.
- Tambahkan file ini sebagai `docs/05_HAVOX_CORE_MVP.md`.
- Update README jika diperlukan.

### Step 2 - Database

- Buat migration SQL Supabase.
- Tambahkan tabel MVP.
- Pastikan relationship antar tabel benar.

### Step 3 - Types

- Update `src/types/index.ts`.
- Tambahkan interface untuk semua entity MVP.

### Step 4 - Project & Module

- Pastikan project management bekerja.
- Tambahkan module management.

### Step 5 - Dashboard

- Buat dashboard metric berdasarkan database.
- Tampilkan recent projects, test cases, test runs, defects, dan recorder sessions.

### Step 6 - Test Runs

- Buat test run page.
- Bisa membuat test run.
- Bisa menambahkan test case ke test run.
- Bisa execute test case.

### Step 7 - Evidence & Defect

- Bisa upload evidence.
- Bisa membuat defect dari failed test.
- Bisa melihat defect matrix sederhana.

### Step 8 - Recorder Persistence

- Pastikan recorder session tersimpan ke database.
- Pastikan recorder steps tersimpan ke database.
- Buat halaman review recording session.

### Step 9 - Generator

- Generate Gherkin dari recording steps.
- Generate Selenium Java template dari recording steps.
- Output dapat dicopy oleh QA Automation.

### Step 10 - Basic Report

- Buat report sederhana dari test run.
- Tambahkan export Excel/JSON jika memungkinkan.

---

## 22. Codex Prompt to Start

Gunakan prompt ini di Codex:

```text
Read README.md and all files inside /docs.

Focus on docs/05_HAVOX_CORE_MVP.md.

Act as a Principal Software Architect and Senior Fullstack Engineer for HavoX.

Your task:
1. Analyze the current React + TypeScript + Vite + Supabase project.
2. Compare the current implementation with HavoX Core MVP requirements.
3. Identify missing database tables, TypeScript types, pages, hooks, and components.
4. Create an implementation plan.
5. Start implementing in small safe steps.
6. Do not rewrite the whole project.
7. Preserve existing features.
8. Prioritize Dashboard, Project Management, and Recorder persistence first.
```

---

## 23. MVP Success Criteria

HavoX Core MVP dianggap berhasil jika:

```text
1. User bisa login.
2. User bisa membuat project.
3. User bisa membuat module.
4. User bisa membuat test case.
5. User bisa membuat test run.
6. User bisa menjalankan manual test.
7. User bisa upload evidence.
8. User bisa membuat defect dari failed test.
9. User bisa merekam UI test lewat Chrome Extension.
10. Recorder session tersimpan ke database.
11. Recorder steps tersimpan ke database.
12. User bisa generate Gherkin dari recorder.
13. User bisa generate Selenium Java template dari recorder.
14. Dashboard menampilkan metric dasar.
15. Basic report dapat dilihat.
```

---

## 24. Important Notes

- Jangan gabungkan Selenium runner ke HavoX App.
- HavoX App hanya menghasilkan template dan data.
- HavoX Runner tetap project terpisah.
- AI belum masuk MVP awal.
- API testing belum masuk MVP awal.
- Fokus utama MVP adalah data, workflow, recorder, dan report.
- Semua fitur harus dibuat modular agar mudah dikembangkan ke AI Intelligence Layer.
