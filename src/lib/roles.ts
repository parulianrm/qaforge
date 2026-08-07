export const PAGE_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "testcases", label: "Test Cases" },
  { key: "defects", label: "Defects" },
  { key: "templates", label: "Templates" },
  { key: "recorder", label: "Recorder" },
  { key: "manage_access", label: "Manage Access" },
  { key: "manage_roles", label: "Manage Roles" },
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]["key"];

export const ROLE_ACCENTS = [
  "indigo",
  "sky",
  "violet",
  "teal",
  "amber",
  "rose",
  "slate",
] as const;

export type RoleAccent = (typeof ROLE_ACCENTS)[number];

export type RolePermissions = Record<PagePermissionKey, boolean>;

export interface Role {
  id: string;
  name: string;
  accent: RoleAccent;
  is_system: boolean;
  description: string | null;
  permissions: RolePermissions;
  created_at: string;
}

export type ProfileStatus = "active" | "disabled" | "pending_approval";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role_id: string;
  status: ProfileStatus;
  provider: string | null;
  last_sign_in_at: string | null;
  created_at: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role_id: string;
  invited_by: string | null;
  created_at: string;
}

export const ROLE_ACCENT_BADGE_CLASSES: Record<RoleAccent, string> = {
  indigo: "bg-indigo-50 text-indigo-700",
  sky: "bg-sky-50 text-sky-700",
  violet: "bg-violet-50 text-violet-700",
  teal: "bg-teal-50 text-teal-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  slate: "bg-slate-100 text-slate-600",
};

export const ROLE_ACCENT_DOT_CLASSES: Record<RoleAccent, string> = {
  indigo: "bg-indigo-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export function hasPagePermission(
  role: Role | null | undefined,
  page: PagePermissionKey,
): boolean {
  return role ? !!role.permissions[page] : false;
}

export function defaultRolePermissions(): RolePermissions {
  return {
    dashboard: true,
    testcases: true,
    defects: true,
    templates: true,
    recorder: true,
    manage_access: false,
    manage_roles: false,
  };
}
