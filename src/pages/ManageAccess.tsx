import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  ChevronRight,
  X,
  Trash2,
  Users,
  Check,
  KeyRound,
  Lock,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  Role,
  Profile,
  PendingInvite,
  ROLE_ACCENT_BADGE_CLASSES,
} from "../lib/roles";
import { ACCESS_ROLES, AccessRole, ProjectAccessGrant } from "../lib/access";
import { Project } from "../types";
import { CustomSelect } from "../components/CustomSelect";

type AccessRow = {
  kind: "profile" | "invite";
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: "active" | "disabled" | "pending" | "pending_approval";
  provider: string | null;
  lastSeen: string | null;
};

function formatLastSeen(value: string | null): string {
  if (!value) return "Belum pernah login";
  const date = new Date(value);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ManageAccess() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState("user");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [drawerEmail, setDrawerEmail] = useState<string | null>(null);
  const [drawerGrants, setDrawerGrants] = useState<ProjectAccessGrant[]>([]);
  const [addAccessProjectId, setAddAccessProjectId] = useState("");
  const [addAccessRole, setAddAccessRole] = useState<AccessRole>("viewer");

  const [changePasswordFor, setChangePasswordFor] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [rolesRes, profilesRes, invitesRes, projectsRes] = await Promise.all([
      supabase.from("roles").select("*").order("created_at"),
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("pending_invites").select("*").order("created_at"),
      supabase.from("projects").select("*").order("name"),
    ]);
    setRoles((rolesRes.data || []) as Role[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setInvites((invitesRes.data || []) as PendingInvite[]);
    setProjects((projectsRes.data || []) as Project[]);
    setLoading(false);
  }

  function getRole(roleId: string): Role | null {
    return roles.find((r) => r.id === roleId) || null;
  }

  const rows: AccessRow[] = useMemo(() => {
    const profileRows: AccessRow[] = profiles.map((p) => ({
      kind: "profile",
      id: p.id,
      name: p.full_name || p.email.split("@")[0],
      email: p.email,
      roleId: p.role_id,
      status: p.status,
      provider: p.provider,
      lastSeen: p.last_sign_in_at,
    }));
    const inviteRows: AccessRow[] = invites.map((i) => ({
      kind: "invite",
      id: i.id,
      name: i.email.split("@")[0],
      email: i.email,
      roleId: i.role_id,
      status: "pending",
      provider: null,
      lastSeen: null,
    }));
    return [...profileRows, ...inviteRows].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [profiles, invites]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQ =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q);
      const matchesRole = !roleFilter || row.roleId === roleFilter;
      return matchesQ && matchesRole;
    });
  }, [rows, search, roleFilter]);

  const stats = useMemo(() => {
    const adminCapableRoleIds = new Set(
      roles
        .filter(
          (r) => r.permissions.manage_access || r.permissions.manage_roles,
        )
        .map((r) => r.id),
    );
    return {
      total: rows.length,
      admins: rows.filter((row) => adminCapableRoleIds.has(row.roleId)).length,
      active: profiles.filter((p) => p.status === "active").length,
    };
  }, [rows, roles, profiles]);

  async function changeRole(row: AccessRow, roleId: string) {
    if (row.kind === "profile") {
      await supabase
        .from("profiles")
        .update({ role_id: roleId })
        .eq("id", row.id);
      setProfiles((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, role_id: roleId } : p)),
      );
    } else {
      await supabase
        .from("pending_invites")
        .update({ role_id: roleId })
        .eq("id", row.id);
      setInvites((prev) =>
        prev.map((i) => (i.id === row.id ? { ...i, role_id: roleId } : i)),
      );
    }
  }

  async function toggleStatus(row: AccessRow, nextActive: boolean) {
    if (row.kind !== "profile") return;
    const status = nextActive ? "active" : "disabled";
    await supabase.from("profiles").update({ status }).eq("id", row.id);
    setProfiles((prev) =>
      prev.map((p) => (p.id === row.id ? { ...p, status } : p)),
    );
  }

  async function cancelInvite(inviteId: string) {
    if (!confirm("Batalkan undangan ini?")) return;
    await supabase.from("pending_invites").delete().eq("id", inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function approveProfile(profileId: string) {
    await supabase
      .from("profiles")
      .update({ status: "active" })
      .eq("id", profileId);
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, status: "active" } : p)),
    );
  }

  async function rejectProfile(profileId: string, email: string) {
    if (
      !confirm(
        `Tolak pendaftaran ${email}? Akunnya akan berstatus nonaktif dan tidak bisa dipakai sampai kamu aktifkan lagi.`,
      )
    )
      return;
    await supabase
      .from("profiles")
      .update({ status: "disabled" })
      .eq("id", profileId);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId ? { ...p, status: "disabled" } : p,
      ),
    );
  }

  function openChangePassword(id: string, email: string) {
    setChangePasswordFor({ id, email });
    setNewPassword("");
    setConfirmNewPassword("");
    setChangePasswordError("");
  }

  async function submitChangePassword() {
    if (!changePasswordFor) return;
    if (newPassword.length < 8) {
      setChangePasswordError("Password minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangePasswordError("Konfirmasi password tidak cocok.");
      return;
    }
    setChangingPassword(true);
    setChangePasswordError("");
    const { data, error } = await supabase.functions.invoke(
      "admin-set-password",
      { body: { userId: changePasswordFor.id, newPassword } },
    );
    setChangingPassword(false);
    const funcError = (data as { error?: string } | null)?.error;
    if (error || funcError) {
      setChangePasswordError(
        funcError || error?.message || "Gagal mengubah password.",
      );
      return;
    }
    setChangePasswordFor(null);
  }

  async function submitAddUser() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setAddError("Masukkan email yang valid.");
      return;
    }
    setAdding(true);
    setAddError("");
    const { error } = await supabase
      .from("pending_invites")
      .insert({ email, role_id: newRoleId });
    setAdding(false);
    if (error) {
      setAddError(
        error.message.includes("sudah terdaftar")
          ? error.message
          : "Gagal menambah user. Coba lagi.",
      );
      return;
    }
    setShowAddModal(false);
    setNewEmail("");
    setNewRoleId("user");
    fetchAll();
  }

  async function openDrawer(email: string) {
    setDrawerEmail(email);
    setAddAccessProjectId("");
    setAddAccessRole("viewer");
    const { data } = await supabase
      .from("project_access")
      .select("*")
      .ilike("user_email", email)
      .order("created_at");
    setDrawerGrants((data || []) as ProjectAccessGrant[]);
  }
  function closeDrawer() {
    setDrawerEmail(null);
    setDrawerGrants([]);
  }

  async function addDrawerAccess() {
    if (!drawerEmail || !addAccessProjectId) return;
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    await supabase.from("project_access").upsert(
      {
        project_id: addAccessProjectId,
        user_email: drawerEmail,
        role: addAccessRole,
        created_by: currentUser?.id,
      },
      { onConflict: "project_id,user_email" },
    );
    openDrawer(drawerEmail);
  }
  async function updateDrawerAccessRole(grantId: string, role: AccessRole) {
    await supabase.from("project_access").update({ role }).eq("id", grantId);
    setDrawerGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, role } : g)),
    );
  }
  async function removeDrawerAccess(grantId: string) {
    await supabase.from("project_access").delete().eq("id", grantId);
    setDrawerGrants((prev) => prev.filter((g) => g.id !== grantId));
  }

  const drawerAvailableProjects = projects.filter(
    (p) => !drawerGrants.some((g) => g.project_id === p.id),
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Manage Access
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Kelola siapa saja yang bisa login ke QAForge dan role apa yang
            mereka pegang. Definisi role &amp; halaman yang boleh dibuka diatur
            di Manage Roles.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} /> Tambah User
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs text-slate-500">Total user</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs text-slate-500">Bisa kelola akses</p>
          <p className="text-2xl font-semibold text-indigo-600">
            {stats.admins}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs text-slate-500">Aktif sekarang</p>
          <p className="text-2xl font-semibold text-emerald-600">
            {stats.active}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-55 max-w-sm flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <CustomSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: "", label: "Semua role" },
            ...roles.map((r) => ({ value: r.id, label: r.name })),
          ]}
          triggerClassName="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <span className="ml-auto text-xs text-slate-400">
          {filteredRows.length} user
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Tidak ada user yang cocok.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-190 text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Nama
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Akses project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Login terakhir
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const role = getRole(row.roleId);
                  return (
                    <tr
                      key={row.kind + row.id}
                      className={`border-b border-slate-50 last:border-b-0 hover:bg-slate-50 ${
                        row.status === "disabled" ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {row.roleId === "super-admin" ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full py-1 pl-2 pr-1.5 text-xs font-semibold ${
                              role ? ROLE_ACCENT_BADGE_CLASSES[role.accent] : ""
                            }`}
                            title="Role Super Admin tidak bisa diubah"
                          >
                            {role?.name || "Super Admin"}
                            <Lock size={11} className="opacity-70" />
                          </span>
                        ) : (
                          <CustomSelect
                            value={row.roleId}
                            onChange={(value) => changeRole(row, value)}
                            chevronSize={12}
                            options={roles.map((r) => ({
                              value: r.id,
                              label: r.name,
                            }))}
                            triggerClassName={`rounded-full py-1 pl-2 pr-1.5 text-xs font-semibold focus:outline-none ${
                              role ? ROLE_ACCENT_BADGE_CLASSES[role.accent] : ""
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDrawer(row.email)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
                        >
                          <Users size={13} className="text-slate-400" />
                          Lihat akses
                          <ChevronRight size={13} className="text-slate-400" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatLastSeen(row.lastSeen)}
                      </td>
                      <td className="px-4 py-3">
                        {row.kind === "invite" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Menunggu login
                          </span>
                        ) : row.status === "pending_approval" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            Menunggu approval
                          </span>
                        ) : row.roleId === "super-admin" ? (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                            title="Super Admin selalu aktif, tidak bisa dinonaktifkan"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <label className="inline-flex cursor-pointer items-center gap-2">
                            <span className="relative inline-flex h-4.5 w-8 items-center rounded-full bg-slate-300 transition-colors has-checked:bg-emerald-500">
                              <input
                                type="checkbox"
                                checked={row.status === "active"}
                                onChange={(e) =>
                                  toggleStatus(row, e.target.checked)
                                }
                                className="peer sr-only"
                              />
                              <span className="ml-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3.5" />
                            </span>
                            <span className="text-xs text-slate-500">
                              {row.status === "active" ? "Aktif" : "Nonaktif"}
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {row.kind === "invite" && (
                            <button
                              onClick={() => cancelInvite(row.id)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              title="Batalkan undangan"
                            >
                              <X size={14} />
                            </button>
                          )}
                          {row.kind === "profile" &&
                            row.status === "pending_approval" && (
                              <>
                                <button
                                  onClick={() => approveProfile(row.id)}
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                                  title="Setujui user ini"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    rejectProfile(row.id, row.email)
                                  }
                                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                  title="Tolak pendaftaran ini"
                                >
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          {row.kind === "profile" &&
                            row.provider === "email" && (
                              <button
                                onClick={() =>
                                  openChangePassword(row.id, row.email)
                                }
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                title="Ubah password langsung (admin)"
                              >
                                <KeyRound size={14} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Tambah User Baru</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Email
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nama@neuronworks.co.id"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Role
                </label>
                <CustomSelect
                  value={newRoleId}
                  onChange={setNewRoleId}
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  triggerClassName="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  User berstatus "Menunggu login" sampai pertama kali sign-in
                  dengan email ini via Google. Role yang kamu atur sekarang
                  langsung berlaku begitu dia login.
                </p>
              </div>
              {addError && <p className="text-xs text-red-600">{addError}</p>}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={submitAddUser}
                disabled={adding || !newEmail.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {adding ? "Menambah..." : "Tambah User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerEmail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Akses project
                </p>
                <p className="text-xs text-slate-500">{drawerEmail}</p>
              </div>
              <button
                onClick={closeDrawer}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Akses per project
              </p>
              {drawerGrants.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">
                  Belum ada akses ke project manapun.
                </p>
              ) : (
                drawerGrants.map((grant) => {
                  const project = projects.find(
                    (p) => p.id === grant.project_id,
                  );
                  return (
                    <div
                      key={grant.id}
                      className="flex items-center gap-2 border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <span className="flex-1 truncate text-sm font-medium text-slate-800">
                        {project?.name || grant.project_id}
                      </span>
                      <CustomSelect
                        value={grant.role}
                        onChange={(value) =>
                          updateDrawerAccessRole(
                            grant.id,
                            value as AccessRole,
                          )
                        }
                        options={ACCESS_ROLES.filter(
                          (r) => r !== "owner",
                        ).map((r) => ({
                          value: r,
                          label: r === "viewer" ? "Viewer" : "Editor",
                        }))}
                        className="w-auto"
                        triggerClassName="rounded-md border border-slate-200 px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => removeDrawerAccess(grant.id)}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Cabut akses"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}

              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Tambah akses
              </p>
              {drawerAvailableProjects.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Sudah punya akses ke semua project.
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <CustomSelect
                    value={addAccessProjectId}
                    onChange={setAddAccessProjectId}
                    options={[
                      { value: "", label: "Pilih project..." },
                      ...drawerAvailableProjects.map((p) => ({
                        value: p.id,
                        label: p.name,
                      })),
                    ]}
                    className="flex-1"
                    triggerClassName="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <CustomSelect
                    value={addAccessRole}
                    onChange={(value) =>
                      setAddAccessRole(value as AccessRole)
                    }
                    options={[
                      { value: "viewer", label: "Viewer" },
                      { value: "editor", label: "Editor" },
                    ]}
                    className="w-auto"
                    triggerClassName="rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={addDrawerAccess}
                    disabled={!addAccessProjectId}
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    + Tambah
                  </button>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Role di sini mengatur akses per project (viewer/editor/owner)
              &mdash; terpisah dari role sistem di atas.
            </div>
          </div>
        </div>
      )}

      {changePasswordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">Ubah Password</h2>
              <button
                onClick={() => setChangePasswordFor(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-6">
              <p className="text-xs text-slate-500">
                Set password baru untuk{" "}
                <span className="font-medium text-slate-700">
                  {changePasswordFor.email}
                </span>
                . User tidak akan diberi tahu otomatis — sampaikan password
                barunya secara manual.
              </p>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password baru (min. 8 karakter)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Konfirmasi password baru"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
              />
              {changePasswordError && (
                <p className="text-xs text-red-600">{changePasswordError}</p>
              )}
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => setChangePasswordFor(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={submitChangePassword}
                disabled={changingPassword || !newPassword}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {changingPassword ? "Menyimpan..." : "Simpan Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
