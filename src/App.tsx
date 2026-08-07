import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
} from "react-router-dom";
import {
  Bug,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import "./lib/chart";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useProfile } from "./hooks/useProfile";
import { hasPagePermission, PagePermissionKey, Role } from "./lib/roles";
import Login from "./pages/Login";
import Projects from "./pages/Project";
import TestCase from "./pages/TestCase";
import Recorder from "./pages/Recorder";
import Dashboard from "./pages/Dashboard";
import Defects from "./pages/Defects";
import ManageAccess from "./pages/ManageAccess";
import ManageRoles from "./pages/ManageRoles";

const Templates = lazy(() => import("./pages/Templates"));

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppLayout({
  children,
  requiredPage,
}: {
  children: React.ReactNode;
  requiredPage?: PagePermissionKey;
}) {
  const { user, signOut } = useAuth();
  const { role, profile, loading: roleLoading, error } = useProfile(user);
  const location = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Test Cases", icon: ClipboardList },
    { href: "/defects", label: "Defects", icon: Bug },
    { href: "/templates", label: "Templates", icon: FileText },
    { href: "/recorder", label: "Recorder", icon: Radio },
  ];

  const adminNavItems = [
    {
      href: "/manage-access",
      label: "Manage Access",
      icon: Users,
      permission: "manage_access" as const,
    },
    {
      href: "/manage-roles",
      label: "Manage Roles",
      icon: ShieldCheck,
      permission: "manage_roles" as const,
    },
  ].filter((item) => hasPagePermission(role, item.permission));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center">
            <span className="text-white text-xs font-semibold">QA</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm">QAForge</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </div>
      <div className="flex">
        <aside className="w-48 min-h-screen bg-white border-r border-slate-200 pt-4">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  location.pathname.startsWith(item.href)
                    ? "bg-indigo-50 text-indigo-600 font-medium"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
            {adminNavItems.length > 0 && (
              <>
                <div className="mt-2 mb-1 px-3 pt-2 text-[10.5px] font-medium uppercase tracking-wide text-slate-400 border-t border-slate-100">
                  Administrasi
                </div>
                {adminNavItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                      location.pathname.startsWith(item.href)
                        ? "bg-indigo-50 text-indigo-600 font-medium"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </nav>
        </aside>
        <main className="flex-1">
          {roleLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : profile?.status === "pending_approval" ? (
            <PendingApproval email={profile.email} />
          ) : requiredPage && !hasPagePermission(role, requiredPage) ? (
            <AccessDenied page={requiredPage} role={role} error={error} />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function PrivateRoute({
  children,
  requiredPage,
}: {
  children: React.ReactNode;
  requiredPage?: PagePermissionKey;
}) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout requiredPage={requiredPage}>{children}</AppLayout>;
}

function PendingApproval({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-1 text-lg font-semibold text-slate-900">
          Menunggu persetujuan admin
        </p>
        <p className="text-sm text-slate-500">
          Akun <span className="font-medium text-slate-700">{email}</span>{" "}
          sudah terdaftar, tapi belum diaktifkan oleh admin QAForge. Hubungi
          admin untuk mempercepat persetujuan.
        </p>
      </div>
    </div>
  );
}

function AccessDenied({
  page,
  role,
  error,
}: {
  page: PagePermissionKey;
  role: Role | null;
  error: string | null;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="mb-1 text-lg font-semibold text-slate-900">
          Akses ditolak
        </p>
        <p className="mb-4 text-sm text-slate-500">
          Role kamu tidak punya izin untuk membuka halaman ini.
        </p>
        <div className="mb-4 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs text-slate-600">
          <p>
            <span className="text-slate-400">Halaman:</span> {page}
          </p>
          <p>
            <span className="text-slate-400">Role terbaca:</span>{" "}
            {role ? `${role.name} (id: ${role.id})` : "tidak ada / gagal dimuat"}
          </p>
          <p className="break-all">
            <span className="text-slate-400">Permission role ini:</span>{" "}
            {role ? JSON.stringify(role.permissions) : "-"}
          </p>
          {error && (
            <p className="break-all text-red-600">
              <span className="text-slate-400">Error:</span> {error}
            </p>
          )}
        </div>
        <Link
          to="/projects"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Kembali ke Projects
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/projects" replace /> : <Login />}
        />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <PrivateRoute>
              <Projects />
            </PrivateRoute>
          }
        />
        <Route
          path="/projects/:projectId"
          element={
            <PrivateRoute>
              <TestCase />
            </PrivateRoute>
          }
        />
        <Route
          path="/recorder"
          element={
            <PrivateRoute>
              <Recorder />
            </PrivateRoute>
          }
        />
        <Route
          path="/defects"
          element={
            <PrivateRoute>
              <Defects />
            </PrivateRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <PrivateRoute>
              <Suspense fallback={<PageLoader />}>
                <Templates />
              </Suspense>
            </PrivateRoute>
          }
        />
        <Route
          path="/manage-access"
          element={
            <PrivateRoute requiredPage="manage_access">
              <ManageAccess />
            </PrivateRoute>
          }
        />
        <Route
          path="/manage-roles"
          element={
            <PrivateRoute requiredPage="manage_roles">
              <ManageRoles />
            </PrivateRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={user ? "/projects" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
