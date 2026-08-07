# HavoX

**HavoX** adalah **End-to-End Quality Intelligence Platform** untuk membantu tim Quality Assurance mengelola proses pengujian dari project, test case, manual execution, evidence, defect, recorder UI, hingga automation handoff.

HavoX dirancang untuk membantu QA menemukan risiko dan defect lebih dini sebelum menjadi masalah saat release.

> **Detect Risk Before It Becomes Havoc.**

---

## Product Vision

HavoX bukan hanya test management tool dan bukan sekadar AI testing chatbot.

HavoX adalah platform kerja QA yang membantu:

- QA Manual menjalankan test case, mencatat evidence, dan membuat defect.
- QA Automation mengubah hasil recorder menjadi Gherkin dan template Selenium Java.
- QA Analyst melihat progress testing, defect matrix, dan risk area.
- Tim QA membangun fondasi data testing yang rapi sebelum masuk ke AI intelligence layer.

Dalam jangka panjang, HavoX akan berkembang menjadi platform yang mampu membantu proses:

```text
BRD / FSD / User Story
↓
Requirement Analysis
↓
Test Scenario
↓
Test Case
↓
Manual Testing
↓
Recorder UI Testing
↓
Evidence
↓
Defect
↓
Automation Candidate
↓
API Testing
↓
Risk Analysis
↓
Regression
↓
Release Readiness
↓
QA Report
```

---

## Current Phase

Saat ini HavoX berada pada fase:

```text
HavoX Core MVP
```

Fokus utama Core MVP:

1. Dashboard QA.
2. Project Management.
3. Module Management.
4. Test Case Management.
5. Test Run dan Manual Execution.
6. Evidence Management.
7. Defect Management.
8. Chrome Recorder untuk UI testing.
9. Recording Session dan Recording Steps.
10. Generate Gherkin dari recorder.
11. Generate Selenium Java template dari recorder.
12. Basic Report.

Fitur AI, API Testing Center, Jenkins trigger otomatis, dan Release Readiness Score belum menjadi fokus MVP awal.

---

## Tech Stack

### HavoX App

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- XLSX untuk import/export test case
- Chart.js untuk visualisasi dashboard

### HavoX Recorder

- Chrome Extension Manifest V3
- Content Script
- Popup Script
- DOM Event Listener
- Mutation Observer
- Chrome Extension Messaging

### HavoX Runner

Runner Selenium dibuat sebagai project terpisah agar tidak membebani aplikasi utama.

- Java
- Maven
- Selenium
- Cucumber
- TestNG
- WebDriverManager

---

## Core Features

### Authentication

- Login menggunakan Google melalui Supabase Auth.

### Dashboard

Dashboard menampilkan ringkasan kondisi QA:

- Total Project.
- Total Module.
- Total Test Case.
- Total Test Run.
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

### Project Management

HavoX dapat digunakan untuk mengelola project QA.

Fitur:

- Membuat project.
- Mengubah project.
- Menghapus atau mengarsipkan project.
- Melihat detail project.
- Melihat module, test case, test run, defect, dan recorder session per project.

### Module Management

Module digunakan untuk mengelompokkan area testing dalam satu project.

Contoh module:

- Login
- Dashboard
- Attendance
- Leave Request
- Approval
- Report
- User Management

### Test Case Management

HavoX mengelola test case sebagai rencana pengujian.

Test case dapat berisi:

- Project.
- Module.
- Test Case Code.
- Title.
- Preconditions.
- Steps.
- Expected Result.
- Priority.
- Test Type.
- Status.

Status test case:

- DRAFT
- READY
- NEED_REVIEW
- DEPRECATED

### Import dan Export Excel

HavoX mendukung:

- Import test case dari Excel.
- Export template test case.
- Export data test case.

### Test Run

Test Run adalah sesi eksekusi test case.

Contoh:

- Sprint 12 Regression.
- Smoke Test Release 1.0.0.
- UAT ESS Leave.
- SIT Attendance Module.

Status test run:

- PLANNED
- IN_PROGRESS
- COMPLETED
- CANCELLED

### Manual Execution

Dalam Test Run, QA dapat menjalankan test case dan memberikan status:

- NOT_RUN
- PASS
- FAIL
- BLOCKED
- SKIPPED

Jika test case gagal, QA dapat mengisi actual result dan membuat defect.

### Evidence Management

Evidence adalah bukti hasil testing.

Evidence dapat berupa:

- Screenshot.
- Video.
- Log.
- Document.
- API Response.
- Attachment lainnya.

Evidence dapat dihubungkan ke:

- Test Run Item.
- Defect.
- Recording Step.

### Defect Management

Defect digunakan untuk mencatat kecacatan sistem yang ditemukan saat testing.

Severity:

- CRITICAL
- MAJOR
- MINOR
- TRIVIAL

Priority:

- HIGH
- MEDIUM
- LOW

Status defect:

- OPEN
- IN_PROGRESS
- FIXED
- RETEST
- CLOSED
- REJECTED

### Chrome Recorder

HavoX Recorder digunakan untuk merekam aktivitas UI testing.

Recorder dapat mencatat:

- Navigation.
- Click.
- Input.
- Select.
- Scroll.
- Notification.
- URL.
- Target text.
- Locator candidate.
- Screenshot jika tersedia.

Recorder tidak langsung menghasilkan automation final.

Flow recorder:

```text
Start Recording
↓
QA melakukan manual UI testing
↓
Stop Recording
↓
Recording Session tersimpan
↓
QA review hasil recorder
↓
Convert to Test Case
↓
Generate Gherkin
↓
Generate Selenium Java Template
```

### Gherkin Generator

HavoX dapat menghasilkan Gherkin scenario dari test case atau recording session.

Contoh format:

```gherkin
Feature: Login

  Scenario: User login with valid credential
    Given user is on login page
    When user inputs valid username
    And user inputs valid password
    And user clicks login button
    Then system should redirect user to dashboard
```

### Selenium Java Template Generator

HavoX dapat menghasilkan template automation awal untuk Selenium Java.

Output yang diharapkan:

- Feature file.
- Step definition candidate.
- Page object candidate.
- Locator candidate.
- Notes untuk QA Automation.

Generated template bukan automation final. QA Automation tetap perlu review sebelum dimasukkan ke HavoX Runner.

---

## Project Structure

```text
havox-app/
├── chrome-extension/      # Source Chrome Extension HavoX Recorder
├── docs/                  # Product context, architecture, roadmap, Codex rules
├── src/
│   ├── modules/           # Feature-based modules
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── app-modules/
│   │   ├── test-cases/
│   │   ├── test-runs/
│   │   ├── defects/
│   │   ├── recorder/
│   │   └── reports/
│   ├── shared/            # Shared components, hooks, layouts, utilities
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Supabase, Chart.js, external library configs
│   ├── pages/             # Existing page structure if still used
│   ├── types/             # TypeScript interfaces and types
│   ├── App.tsx            # Routing and main layout
│   └── main.tsx           # React entry point
├── package.json
├── vite.config.ts
└── README.md
```

> Catatan: jika project saat ini masih menggunakan struktur `pages/`, refactor ke `modules/` dapat dilakukan bertahap. Jangan rewrite seluruh project sekaligus.

---

## Related Repositories

HavoX App tidak menjalankan Selenium secara langsung.

Automation runner dipisah ke project lain:

```text
havox-runner/
├── src/test/java/
│   ├── pages/
│   ├── steps/
│   ├── hooks/
│   ├── runner/
│   └── utils/
├── src/test/resources/features/
├── reports/
├── pom.xml
└── README.md
```

Flow awal automation:

```text
HavoX App
↓
Generate Gherkin / Selenium Template
↓
QA Automation copy ke HavoX Runner
↓
Run manual atau melalui Jenkins
↓
Result dapat diimport kembali ke HavoX pada fase berikutnya
```

---

## Database Tables

HavoX Core MVP menggunakan Supabase PostgreSQL.

Tabel utama:

- `projects`
- `app_modules`
- `test_cases`
- `test_runs`
- `test_run_items`
- `defects`
- `evidences`
- `recording_sessions`
- `recording_steps`

Konsep penting:

```text
test_cases = rencana pengujian
test_run_items = hasil eksekusi test case
```

Jangan mencampur status eksekusi ke tabel `test_cases`.

---

## Environment Variables

Buat file `.env` di root project:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Prerequisites

- Node.js
- npm
- Project Supabase
- Google OAuth aktif di Supabase Auth
- Chrome atau browser Chromium untuk menggunakan HavoX Recorder

---

## Installation

Install dependency:

```bash
npm install
```

Jalankan development server:

```bash
npm run dev
```

Secara default aplikasi berjalan di:

```text
http://localhost:5173
```

---

## Build

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

## Chrome Extension Recorder

Untuk menjalankan extension:

1. Buka `chrome://extensions`.
2. Aktifkan **Developer mode**.
3. Klik **Load unpacked**.
4. Pilih folder `chrome-extension`.
5. Jalankan HavoX App di `http://localhost:5173`.
6. Gunakan popup HavoX Recorder untuk Start dan Stop.
7. Kirim hasil rekaman ke halaman Recorder di HavoX App.

Recorder saat ini diarahkan ke:

```text
http://localhost:5173/recorder
```

---

## Recorder Flow

```text
User menekan Start di Chrome Extension
↓
Content script merekam navigation, click, input, scroll, dan notification
↓
User menekan Stop
↓
Recorder menyimpan satu session sebagai kandidat test case
↓
Popup extension mengirim session ke halaman Recorder aplikasi
↓
User melengkapi title, project, module, priority, dan tester
↓
User menyimpan recording session ke Supabase
↓
User dapat generate Gherkin atau Selenium Java template
```

---

## Documentation

Dokumentasi utama berada di folder:

```text
docs/
```

File penting:

- `00_PROJECT_VISION.md`
- `01_HAVOX_CONTEXT.md`
- `02_ARCHITECTURE.md`
- `03_DATABASE.md`
- `04_ROADMAP.md`
- `05_HAVOX_CORE_MVP.md`
- `CODEX_RULES.md`

Jika menggunakan Codex, Cursor, Continue, atau AI coding assistant, selalu minta AI membaca folder `docs/` terlebih dahulu.

Contoh prompt:

```text
Read README.md and all files inside /docs.

Focus on docs/05_HAVOX_CORE_MVP.md.

Act as a Principal Software Architect and Senior Fullstack Engineer for HavoX.

Analyze the current React + TypeScript + Vite + Supabase project.

Compare the current implementation with HavoX Core MVP requirements.

Start implementing Dashboard, Project Management, and Recorder persistence first.

Do not rewrite the whole project.
Preserve existing features.
Implement in small safe steps.
```

---

## MVP Success Criteria

HavoX Core MVP dianggap berhasil jika:

1. User bisa login.
2. User bisa membuat project.
3. User bisa membuat module.
4. User bisa membuat test case.
5. User bisa import/export test case.
6. User bisa membuat test run.
7. User bisa menjalankan manual test.
8. User bisa mengubah status execution menjadi PASS, FAIL, BLOCKED, atau SKIPPED.
9. User bisa upload evidence.
10. User bisa membuat defect dari failed test.
11. User bisa merekam UI test lewat Chrome Extension.
12. Recording session tersimpan ke database.
13. Recording steps tersimpan ke database.
14. User bisa generate Gherkin dari recorder.
15. User bisa generate Selenium Java template dari recorder.
16. Dashboard menampilkan metric dasar.
17. Basic report dapat dilihat.

---

## Future Roadmap

### Phase 4 - Automation Bridge

- Export `.feature`.
- Export Selenium Java template.
- Import automation result.
- Jenkins integration.
- Automation coverage dashboard.
- Failed automation analysis.

### Phase 5 - API Testing Center

- Upload Postman Collection.
- Upload Swagger/OpenAPI.
- Generate API test matrix.
- Newman/API Runner integration.
- API coverage report.
- API defect matrix.

### Phase 6 - AI Intelligence Layer

- Requirement Agent.
- Test Case Agent.
- Defect Agent.
- Risk Agent.
- Automation Agent.
- API Agent.
- Report Agent.

### Phase 7 - Release Intelligence

- Risk Matrix.
- Defect Matrix.
- Requirement Coverage Matrix.
- Automation Coverage Matrix.
- API Coverage Matrix.
- Regression Recommendation.
- Release Readiness Score.
- Executive QA Report.

---

## Development Rules

- Jangan rewrite seluruh project sekaligus.
- Preserve fitur existing.
- Implementasi dilakukan bertahap.
- Gunakan TypeScript type yang jelas.
- Pisahkan business logic dari UI component.
- Gunakan reusable hooks dan service functions.
- Simpan data utama di Supabase.
- Simpan evidence file di Supabase Storage.
- Jangan gabungkan Selenium Runner ke HavoX App.
- Recorder output harus human-reviewable.
- Generated Selenium template harus dianggap candidate, bukan final automation.

---

## License

Internal project / personal development.
