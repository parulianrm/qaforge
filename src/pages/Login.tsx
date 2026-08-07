import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase, supabaseIsolated } from "../lib/supabase";

type Mode = "signin" | "signup";

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"amber" | "emerald">("amber");

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  }

  async function submitSignIn() {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email atau password salah."
          : authError.message,
      );
    }
    // On success, the auth state change is picked up by useAuth() and the
    // router redirects away from /login automatically.
  }

  async function submitSignUp() {
    // Use the isolated client so this signup's session never reaches the
    // app's shared auth listener — signUp() still creates the real
    // auth.users row regardless of which client instance calls it.
    const { data, error: authError } = await supabaseIsolated.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!data.session) {
      // Supabase's "Confirm email" is still ON for this project — signUp()
      // creates the auth user but withholds a session until the email link
      // is clicked.
      setNoticeTone("amber");
      setNotice(
        data.user?.identities?.length === 0
          ? "Email ini sudah terdaftar. Coba menu Masuk, atau minta admin ubah password kamu."
          : "Akun dibuat, tapi Supabase masih meminta konfirmasi email. Cek inbox kamu, atau minta admin menonaktifkan \"Confirm email\" di Supabase supaya pendaftaran langsung aktif tanpa email.",
      );
      return;
    }

    // Provision their profiles row right away (status: pending_approval) so
    // admins see them in Manage Access immediately, without ever exposing
    // this session to the app's own auth state.
    await supabaseIsolated.rpc("handle_login");
    await supabaseIsolated.auth.signOut();

    setNoticeTone("emerald");
    setNotice(
      "Pendaftaran berhasil! Akun kamu menunggu persetujuan admin sebelum bisa dipakai. Coba masuk lagi setelah disetujui.",
    );
    setPassword("");
    setConfirmPassword("");
  }

  async function submitEmailPassword() {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setSubmitting(true);
    if (mode === "signup") {
      await submitSignUp();
    } else {
      await submitSignIn();
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-10 w-full max-w-sm text-center shadow-sm">
        {/* Logo */}
        <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-semibold text-lg">QA</span>
        </div>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          {mode === "signin" ? "Masuk ke QAForge" : "Daftar ke QAForge"}
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Platform manajemen pengujian untuk tim QA profesional
        </p>

        {/* Google Button */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <LogIn size={16} className="text-gray-500" />
          Lanjutkan dengan Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">atau pakai email</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Email / password form */}
        <div className="flex flex-col gap-3 text-left">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
          />
          {mode === "signup" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Konfirmasi password"
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
            />
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {notice && (
            <p
              className={`text-xs ${
                noticeTone === "emerald" ? "text-emerald-600" : "text-amber-600"
              }`}
            >
              {notice}
            </p>
          )}

          {mode === "signup" && !notice && (
            <p className="text-xs text-slate-400">
              Akun baru menunggu persetujuan admin sebelum bisa dipakai.
            </p>
          )}

          <button
            onClick={submitEmailPassword}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {mode === "signin" ? "Masuk" : "Daftar"}
          </button>

          <button
            onClick={() =>
              switchMode(mode === "signin" ? "signup" : "signin")
            }
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            {mode === "signin"
              ? "Belum punya akun? Daftar di sini"
              : "Sudah punya akun? Masuk di sini"}
          </button>
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Dengan masuk, Anda menyetujui Syarat Layanan dan Kebijakan Privasi
          HavoX.
        </p>
      </div>
    </div>
  );
}
