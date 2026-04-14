export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
}

export interface TestCase {
  id: string;
  project_id: string;
  tc_id: string;
  module: string;
  title: string;
  precondition?: string;
  steps?: string;
  expected_result?: string;
  actual_result?: string;
  priority: "critical" | "high" | "medium" | "low";
  status: "pass" | "fail" | "skip" | "not_run";
  tester?: string;
  created_at: string;
}

export interface Defect {
  id: string;
  project_id: string;
  def_id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved" | "closed";
  related_tc_id?: string;
  reporter?: string;
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
