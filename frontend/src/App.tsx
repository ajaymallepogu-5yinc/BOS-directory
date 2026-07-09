import { Route, BrowserRouter, Routes, Navigate, Outlet } from "react-router-dom";
import Sidebar from "./components/Layout/Sidebar";
import AdminPage from "./pages/AdminPage";
import CompanyTreePage from "./pages/CompanyTreePage";
import DepartmentTreePage from "./pages/DepartmentTreePage";
import RoleMappingPage from "./pages/RoleMappingPage";
import LoginPage from "./pages/LoginPage";
import ProjectsPage from "./pages/ProjectsPage";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Layout wrapper to protect authenticated pages
function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <span className="text-[10px] font-bold tracking-wide uppercase text-slate-500 animate-pulse">
            Loading Directory...
          </span>
        </div>
      </div>
    );
  }

  // Redirect to login if session doesn't exist
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Render the core layout with Sidebar
  return (
    <div className="flex h-screen flex-row bg-ink-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

// Guard limiting a route to admins; non-admins are bounced to the company tree
function AdminRoute() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Secure application layout */}
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<CompanyTreePage />} />
            <Route path="/department" element={<DepartmentTreePage />} />
            <Route path="/role-mapping" element={<RoleMappingPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>

          {/* Fallback redirect to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
