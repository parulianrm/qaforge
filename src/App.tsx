import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import Projects from "./pages/Project";
import TestCase from "./pages/TestCase";
import Recorder from "./pages/Recorder";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/projects", label: "Test Cases" },
    { href: "/recorder", label: "Recorder" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-6">
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
            Keluar
          </button>
        </div>
      </div>
      <div className="flex">
        <aside className="w-48 min-h-screen bg-white border-r border-gray-200 pt-4">
          <nav className="flex flex-col gap-1 px-3">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  location.pathname.startsWith(item.href)
                    ? "bg-emerald-50 text-emerald-600 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function DashboardPage() {
  return (
    <div className="p-8 text-gray-500 text-sm">Dashboard — coming soon</div>
  );
}
function RecorderPage() {
  return (
    <div className="p-8 text-gray-500 text-sm">Recorder — coming soon</div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
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
              <DashboardPage />
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
          path="*"
          element={<Navigate to={user ? "/projects" : "/login"} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
