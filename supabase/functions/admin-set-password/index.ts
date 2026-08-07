// HavoX: let an admin (manage_access permission) set a new password directly
// for an email/password account, without going through the reset-email flow.
//
// This MUST run server-side because it needs the service_role key to call
// Supabase's Admin API (auth.admin.updateUserById) — that key can never be
// shipped to the browser. The caller's own JWT (forwarded automatically by
// supabase.functions.invoke from the client) is used to verify they actually
// have manage_access permission before the privileged update runs.
//
// Deploy with: supabase functions deploy admin-set-password

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const { userId, newPassword } = await req.json();
    if (!userId || typeof newPassword !== "string" || newPassword.length < 8) {
      return json(
        { error: "userId dan newPassword (min. 8 karakter) wajib diisi." },
        400,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped as the caller — used only to verify who they are and whether
    // they have manage_access permission, respecting normal RLS.
    const callerClient: SupabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return json({ error: "Tidak terautentikasi." }, 401);
    }

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role:roles(permissions)")
      .eq("id", caller.id)
      .single();

    const permissions = (
      callerProfile as { role: { permissions?: Record<string, boolean> } } | null
    )?.role?.permissions;

    if (!permissions?.manage_access) {
      return json({ error: "Kamu tidak punya izin manage_access." }, 403);
    }

    // Privileged client — only reached after the permission check above.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
