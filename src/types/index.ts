import type {
  DefectPriority,
  DefectStatus,
  TestCasePriority,
  TestCaseStatus,
} from "../lib/domain";

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  created_by?: string;
  status?: "active" | "archived" | "ACTIVE" | "ARCHIVED";
  created_at: string;
  updated_at?: string;
  archived_at?: string | null;
}

export interface TestCase {
  id: string;
  project_id: string;
  tc_id: string;
  test_case_code?: string;
  module_id?: string;
  module: string;
  title: string;
  precondition?: string;
  preconditions?: string;
  steps?: string;
  expected_result?: string;
  actual_result?: string;
  priority: TestCasePriority;
  status: TestCaseStatus;
  tester?: string;
  test_type?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface Defect {
  id: string;
  project_id: string;
  issue_id?: string;
  def_id?: string;
  title: string;
  module?: string;
  description?: string;
  priority?:
    DefectPriority | "critical" | "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  attachment?: string;
  developer_notes?: string;
  merge_request?: string;
  qa_notes?: string;
  environment?: string;
  database_name?: string;
  handled_by?: string;
  updated_at?: string;
  severity:
    DefectPriority | "critical" | "CRITICAL" | "MAJOR" | "MINOR" | "TRIVIAL";
  status:
    | DefectStatus
    | "resolved"
    | "OPEN"
    | "IN_PROGRESS"
    | "FIXED"
    | "RETEST"
    | "CLOSED"
    | "REJECTED";
  related_tc_id?: string;
  reporter?: string;
  reported_at?: string;
  created_at: string;
}

export interface RecorderStep {
  type: "click" | "type" | "nav" | "scroll" | "hover";
  target?: string;
  value?: string;
  url?: string;
  timestamp: number;
}

export interface RecorderSession {
  id: string;
  project_id: string;
  name: string;
  url: string;
  steps: RecorderStep[];
  gherkin: string;
  created_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  name: string;
  status:
    | "planned"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "PLANNED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED";
  created_at: string;
}

export interface RecordingSession {
  id: string;
  project_id: string;
  title?: string;
  name?: string;
  url?: string;
  target_url?: string;
  gherkin?: string;
  step_count?: number;
  created_at: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  document_type: "QAD" | string;
  description?: string;
  content_html: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}
