import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl py-2.5 px-3.5 text-xs font-semibold transition-all duration-200 ${
      isActive
        ? "bg-brand text-white shadow-md shadow-brand/15 font-bold"
        : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
    }`;

  // Fallback for avatar initials
  const getInitials = (name: string) => {
    if (!name) return "EE";
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-ink-200 bg-white h-full">
      {/* Brand logo section */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-ink-150 h-[72px]">
        <img src="/5y.webp" alt="5yinc logo" className="h-12 w-12 shrink-0 object-contain rounded" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xs font-black tracking-tight text-ink-900 leading-none whitespace-nowrap">Company Directory</p>
        </div>
      </div>

      {/* Main Navigation menu list */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-1 overflow-y-auto">
        <NavLink to="/" className={linkClass} end>
          <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="truncate">Company Tree</span>
        </NavLink>

        <NavLink to="/department" className={linkClass}>
          <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="truncate">Department Tree</span>
        </NavLink>

        <NavLink to="/role-mapping" className={linkClass}>
          <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="truncate">Company Careers</span>
        </NavLink>
      </nav>

      {/* Admin Console and User profile section at the bottom */}
      <div className="border-t border-ink-150 px-3 py-4 flex flex-col gap-3">
        {(!user || user.isAdmin) && (
          <NavLink to="/admin" className={linkClass}>
            <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">Admin</span>
          </NavLink>
        )}

        {user && (
          <div className="flex items-center gap-2.5 bg-ink-50/50 rounded-xl p-2 border border-ink-150/40">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="h-8 w-8 rounded-full object-cover border border-ink-200 shrink-0"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white bg-indigo-600 shrink-0">
                {getInitials(user.fullName)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-ink-900 truncate leading-tight">{user.fullName}</p>
              <p className="text-[8px] font-bold text-ink-400 truncate leading-none mt-0.5">{user.title}</p>
            </div>
            <button
              onClick={() => logout()}
              className="flex items-center justify-center text-ink-400 hover:text-rose-600 hover:bg-rose-50/70 border border-transparent hover:border-rose-150 transition-all shrink-0 p-1.5 rounded-xl"
              title="Log Out"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
