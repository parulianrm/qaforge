import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  PAGE_PERMISSIONS,
  PagePermissionKey,
  Profile,
  PendingInvite,
  Role,
  RoleAccent,
  ROLE_ACCENTS,
  ROLE_ACCENT_DOT_CLASSES,
  RolePermissions,
  defaultRolePermissions,
} from "../lib/roles";

const LOCKED_PERMISSIONS_FOR_SUPER_ADMIN: PagePermissionKey[] = [
  "manage_access",
  "manage_roles",
];

type RoleForm = {
  name: string;
  accent: RoleAccent;
  description: string;
  permissions: RolePermissions;
};

function emptyForm(): RoleForm {
  return {
    name: "",
    accent: "indigo",
    description: "",
    permissions: defaultRolePermissions(),
  };
}

export default function ManageRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [rolesRes, profilesRes, invitesRes] = await Promise.all([
      supabase.from("roles").select("*").order("created_at"),
      supabase.from("profiles").select("id, role_id"),
      supabase.from("pending_invites").select("id, role_id"),
    ]);
    setRoles((rolesRes.data || []) as Role[]);
    setProfiles((profilesRes.data || []) as Profile[]);
    setInvites((invitesRes.data || []) as PendingInvite[]);
    setLoading(false);
  }

  const userCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach((p) => {
      counts[p.role_id] = (counts[p.role_id] || 0) + 1;
    });
    invites.forEach((i) => {
      counts[i.role_id] = (counts[i.role_id] || 0) + 1;
    });
    return counts;
  }, [profiles, invites]);

  function openCreate() {
    setEditingRole(null);
    setForm(emptyForm());
    setFormError("");
    setShowModal(true);
  }

  function openEdit(role: Role) {
    setEditingRole(role);
    setForm({
      name: role.name,
      accent: role.accent,
      description: role.description || "",
      permissions: { ...role.permissions },
    });
    setFormError("");
    setShowModal(true);
  }

  function togglePermission(key: PagePermissionKey) {
    if (
      editingRole?.id === "super-admin" &&
      LOCKED_PERMISSIONS_FOR_SUPER_ADMIN.includes(key)
    ) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  }

  async function saveRole() {
    const name = form.name.trim();
    if (!name) {
      setFormError("Nama role wajib diisi.");
      return;
    }
    setSaving(true);
    setFormError("");

    if (editingRole) {
      const payload: Partial<Role> = {
        description: form.description.trim() || null,
        accent: form.accent,
        permissions: form.permissions,
      };
      if (!editingRole.is_system) payload.name = name;
      const { error } = await supabase
        .from("roles")
        .update(payload)
        .eq("id", editingRole.id);
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("roles").insert({
        name,
        accent: form.accent,
        description: form.description.trim() || null,
        permissions: form.permissions,
        is_system: false,
      });
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    }
    setShowModal(false);
    fetchAll();
  }

  async function deleteRole(role: Role) {
    if (role.is_system) return;
    if (!confirm(`Hapus role "${role.name}"? Tindakan ini tidak bisa dibatalkan.`))
      return;
    const { error } = await supabase.from("roles").delete().eq("id", role.id);
    if (error) {
      alert(error.message);
      return;
    }
    fetchAll();
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Manage Roles
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Definisikan role dan halaman apa saja yang boleh dibuka tiap
            role. Ini mengatur akses ke menu/halaman &mdash; terpisah dari
            role akses per project (Owner/Editor/Viewer) yang diatur di
            drawer "Akses project" pada Manage Access.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} /> Buat Role
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-235 text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Deskripsi
                  </th>
                  {PAGE_PERMISSIONS.map((p) => (
                    <th
                      key={p.key}
                      className="whitespace-nowrap px-3 py-3 text-center text-xs font-medium text-slate-500"
                    >
                      {p.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-500">
                    User
                  </th>
                  <th className="w-20 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const userCount = userCountByRole[role.id] || 0;
                  const canDelete = !role.is_system && userCount === 0;
                  return (
                    <tr
                      key={role.id}
                      className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${ROLE_ACCENT_DOT_CLASSES[role.accent]}`}
                          />
                          <span className="font-medium text-slate-900">
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Sistem
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-60 px-4 py-3 text-xs text-slate-500">
                        {role.description || "—"}
                      </td>
                      {PAGE_PERMISSIONS.map((p) => (
                        <td key={p.key} className="px-3 py-3 text-center">
                          {role.permissions[p.key] ? (
                            <Check
                              size={15}
                              className="mx-auto text-emerald-600"
                            />
                          ) : (
                            <Minus
                              size={15}
                              className="mx-auto text-slate-300"
                            />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-medium text-slate-600">
                        {userCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(role)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                            title="Edit role"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteRole(role)}
                            disabled={!canDelete}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title={
                              canDelete
                                ? "Hapus role"
                                : role.is_system
                                  ? "Role sistem tidak bisa dihapus"
                                  : "Masih dipakai user, tidak bisa dihapus"
                            }
                          >
                            <Trash2 size={13} />
                          </button>
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

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                {editingRole ? "Edit Role" : "Buat Role Baru"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Nama role
                </label>
                <input
                  type="text"
                  value={form.name}
                  disabled={!!editingRole?.is_system}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="mis. QA Lead"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Warna
                </label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_ACCENTS.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      title={accent}
                      onClick={() => setForm((p) => ({ ...p, accent }))}
                      className={`h-6 w-6 rounded-full ${ROLE_ACCENT_DOT_CLASSES[accent]} ${
                        form.accent === accent
                          ? "ring-2 ring-slate-900 ring-offset-2"
                          : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Deskripsi (opsional)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Ringkas, kegunaan role ini"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-slate-600">
                  Halaman yang boleh dibuka
                </label>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {PAGE_PERMISSIONS.map((p) => {
                    const locked =
                      editingRole?.id === "super-admin" &&
                      LOCKED_PERMISSIONS_FOR_SUPER_ADMIN.includes(p.key);
                    const checked = form.permissions[p.key];
                    return (
                      <div
                        key={p.key}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-sm text-slate-700">
                          {p.label}
                          {locked && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                              wajib aktif
                            </span>
                          )}
                        </span>
                        <label
                          className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors ${
                            checked ? "bg-emerald-500" : "bg-slate-300"
                          } ${locked ? "opacity-50" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={locked}
                            onChange={() => togglePermission(p.key)}
                            className="sr-only"
                          />
                          <span
                            className={`ml-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                              checked ? "translate-x-3.5" : ""
                            }`}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
              {formError && <p className="text-xs text-red-600">{formError}</p>}
            </div>
            <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveRole}
                disabled={saving || !form.name.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
