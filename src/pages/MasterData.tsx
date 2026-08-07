import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  ROLE_ACCENTS,
  ROLE_ACCENT_DOT_CLASSES,
  RoleAccent,
} from "../lib/roles";
import { normalizeValue } from "../lib/domain";
import {
  OPTION_CATEGORIES,
  OptionCategory,
  OptionListItem,
  fetchOptionLists,
  optionsFor,
} from "../lib/optionLists";

type OptionForm = {
  label: string;
  value: string;
  accent: RoleAccent;
};

function emptyForm(): OptionForm {
  return { label: "", value: "", accent: "slate" };
}

export default function MasterData() {
  const [items, setItems] = useState<OptionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<OptionCategory>(
    OPTION_CATEGORIES[0].key,
  );

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<OptionListItem | null>(null);
  const [form, setForm] = useState<OptionForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setItems(await fetchOptionLists());
    setLoading(false);
  }

  const rows = useMemo(
    () => optionsFor(items, category),
    [items, category],
  );

  function openCreate() {
    setEditingItem(null);
    setForm(emptyForm());
    setFormError("");
    setShowModal(true);
  }

  function openEdit(item: OptionListItem) {
    setEditingItem(item);
    setForm({ label: item.label, value: item.value, accent: item.accent });
    setFormError("");
    setShowModal(true);
  }

  async function saveItem() {
    const label = form.label.trim();
    if (!label) {
      setFormError("Label wajib diisi.");
      return;
    }
    setSaving(true);
    setFormError("");

    if (editingItem) {
      const { error } = await supabase
        .from("option_lists")
        .update({ label, accent: form.accent })
        .eq("id", editingItem.id);
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
    } else {
      const value = normalizeValue(label);
      const nextSortOrder =
        Math.max(0, ...rows.map((r) => r.sort_order)) + 1;
      const { error } = await supabase.from("option_lists").insert({
        category,
        value,
        label,
        accent: form.accent,
        sort_order: nextSortOrder,
        is_default: false,
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

  async function deleteItem(item: OptionListItem) {
    if (!confirm(`Hapus "${item.label}"? Tindakan ini tidak bisa dibatalkan.`))
      return;
    const { error } = await supabase
      .from("option_lists")
      .delete()
      .eq("id", item.id);
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
            Master Data
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Kelola pilihan Priority dan Status yang dipakai pada halaman Test
            Case dan Defect. Value yang masih dipakai data tidak bisa
            dihapus.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} /> Tambah Nilai
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {OPTION_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              category === c.key
                ? "bg-indigo-50 text-indigo-600"
                : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  Label
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  Value
                </th>
                <th className="w-20 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Belum ada nilai untuk kategori ini.
                  </td>
                </tr>
              )}
              {rows.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${ROLE_ACCENT_DOT_CLASSES[item.accent]}`}
                      />
                      <span className="font-medium text-slate-900">
                        {item.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">
                    {item.value}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                        title="Edit nilai"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        title="Hapus nilai"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[88vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">
                {editingItem ? "Edit Nilai" : "Tambah Nilai Baru"}
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
                  Kategori
                </label>
                <p className="text-sm text-slate-700">
                  {OPTION_CATEGORIES.find((c) => c.key === category)?.label}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Label
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, label: e.target.value }))
                  }
                  placeholder="mis. Urgent"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Value (slug)
                </label>
                <input
                  type="text"
                  disabled
                  value={
                    editingItem
                      ? editingItem.value
                      : normalizeValue(form.label) || "—"
                  }
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-400"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Otomatis dari label, tidak bisa diubah setelah dibuat.
                </p>
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
                onClick={saveItem}
                disabled={saving || !form.label.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
