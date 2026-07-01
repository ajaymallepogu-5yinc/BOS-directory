import { Route, BrowserRouter, Routes } from "react-router-dom";
import Sidebar from "./components/Layout/Sidebar";
import AdminPage from "./pages/AdminPage";
import CompanyTreePage from "./pages/CompanyTreePage";
import DepartmentTreePage from "./pages/DepartmentTreePage";
import RoleMappingPage from "./pages/RoleMappingPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen flex-row bg-ink-50">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<CompanyTreePage />} />
            <Route path="/department" element={<DepartmentTreePage />} />
            <Route path="/role-mapping" element={<RoleMappingPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
