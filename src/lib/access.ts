import { User } from "@supabase/supabase-js";
import { Project } from "../types";

export const ACCESS_ROLES = ["viewer", "editor", "owner"] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export interface ProjectAccessGrant {
  id: string;
  project_id: string;
  user_email: string;
  role: AccessRole;
  created_at: string;
}

const ROLE_RANK: Record<AccessRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export function canEdit(role: AccessRole | null) {
  return role ? ROLE_RANK[role] >= ROLE_RANK.editor : false;
}

export function canManageAccess(role: AccessRole | null) {
  return role === "owner";
}

export function getLocalProjectRole(
  project: Project | null,
  user: User | null,
  grants: ProjectAccessGrant[],
): AccessRole | null {
  if (!project || !user) return null;
  if (project.owner_id === user.id || project.created_by === user.id) {
    return "owner";
  }

  const userEmail = user.email?.trim().toLowerCase();
  if (!userEmail) return null;

  return (
    grants.find((grant) => grant.user_email.trim().toLowerCase() === userEmail)
      ?.role || null
  );
}
