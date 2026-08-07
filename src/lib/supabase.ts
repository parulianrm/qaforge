import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For one-off auth calls (self-registration) whose resulting session must
// never persist or reach the app's shared auth listener — e.g. signUp()
// would otherwise flip the shared session live for a moment, which the
// router picks up as "logged in" and redirects into the app before we
// deliberately sign back out.
export const supabaseIsolated = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
