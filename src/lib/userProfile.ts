import { User } from "@supabase/supabase-js";

function titleCase(value: string): string {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getUserDisplayName(user?: User | null): string {
  const metadataName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.preferred_username;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const emailName = user?.email?.split("@")[0] || "";
  return titleCase(emailName);
}
