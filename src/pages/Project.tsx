import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Trash2, Pencil } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { Project, TestCase } from "../types";

interface ProjectSummary {
  testCases: number;
  modules: number;
}

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setProjects(data);
      fetchProjectSummaries(data);
    }
    setLoading(false);
  }

  async function fetchProjectSummaries(projectRows: Project[]) {
    if (projectRows.length === 0) {
      setSummaries({});
      return;
    }
    const ids = projectRows.map((project) => project.id);
    const { data } = await supabase
      .from("test_cases")
      .select("project_id,module")
      .in("project_id", ids);
    const next: Record<string, ProjectSummary> = {};
    projectRows.forEach((project) => {
      const rows = ((data || []) as Pick<TestCase, "project_id" | "module">[]).filter(
        (tc) => tc.project_id === project.id,
      );
      next[project.id] = {
        testCases: rows.length,
        modules: new Set(rows.map((tc) => tc.module).filter(Boolean)).size,
      };
    });
    setSummaries(next);
  }

  function openCreate() {
    setEditingProject(null);
    setName("");
    setDescription("");
    setShowModal(true);
  }

  function openEdit(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || "");
    setShowModal(true);
  }

  async function saveProject() {
    if (!name.trim()) return;
    setCreating(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
    };
    const { error } = editingProject
      ? await supabase.from("projects").update(payload).eq("id", editingProject.id)
      : await createProject(payload);
    if (!error) {
      setName("");
      setDescription("");
      setEditingProject(null);
      setShowModal(false);
      fetchProjects();
    }
    setCreating(false);
  }

  async function createProject(payload: { name: string; description: string }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return supabase.from("projects").insert({
      ...payload,
      owner_id: user?.id,
      created_by: user?.id,
    });
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      !confirm("Hapus project ini? Semua test case di dalamnya akan terhapus.")
    )
      return;
    await supabase.from("projects").delete().eq("id", id);
    fetchProjects();
  }

  function isProjectOwner(project: Project) {
    return project.owner_id === user?.id || project.created_by === user?.id;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola test case per project
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Project Baru
        </button>
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FolderOpen size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            Belum ada project. Buat project pertama Anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <FolderOpen size={18} className="text-indigo-600" />
                </div>
                {isProjectOwner(project) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => openEdit(project, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-600 transition-all"
                      title="Edit project"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => deleteProject(project.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 transition-all"
                      title="Hapus project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-1">
                {project.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2">
                {project.description || "Tidak ada deskripsi"}
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {summaries[project.id]?.modules || 0} module
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5">
                  {summaries[project.id]?.testCases || 0} test case
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Dibuat{" "}
                {new Date(project.created_at).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create Project */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              {editingProject ? "Edit Project" : "Buat Project Baru"}
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Nama Project
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="contoh: QA Mobile App v2"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Deskripsi (opsional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat project ini..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                }}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveProject}
                disabled={creating || !name.trim()}
                className="flex-1 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
              >
                {creating
                  ? "Menyimpan..."
                  : editingProject
                    ? "Simpan Project"
                    : "Buat Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
