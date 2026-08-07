import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { Profile, Role } from "../lib/roles";

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setRole(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { error: loginError } = await supabase.rpc("handle_login");
      if (loginError) {
        console.error("handle_login RPC failed:", loginError);
        if (!cancelled) {
          setError(`handle_login gagal: ${loginError.message}`);
        }
      }

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*, role:roles(*)")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        console.error("Failed to load profile/role:", fetchError);
        setError(
          (prev) =>
            prev || `Gagal memuat profile: ${fetchError.message}`,
        );
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error(
          "No profile row found for user id:",
          userId,
          "email:",
          userEmail,
        );
        setError(
          (prev) =>
            prev ||
            "Tidak ada baris profiles untuk user ini. handle_login() mungkin belum berhasil membuatnya.",
        );
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const { role: joinedRole, ...profileRow } = data as Profile & {
        role: Role | null;
      };

      if (!joinedRole) {
        console.error(
          "Profile row found but role join is empty. role_id:",
          profileRow.role_id,
        );
        setError(
          (prev) =>
            prev ||
            `Role "${profileRow.role_id}" tidak ditemukan di tabel roles (atau join gagal).`,
        );
      }

      setProfile(profileRow);
      setRole(joinedRole);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, userEmail]);

  return { profile, role, loading, error };
}
