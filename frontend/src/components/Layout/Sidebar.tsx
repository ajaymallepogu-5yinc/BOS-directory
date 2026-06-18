import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl py-2.5 px-3.5 text-xs font-semibold transition-all duration-200 ${
      isActive
        ? "bg-brand text-white shadow-md shadow-brand/15 font-bold"
        : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
    }`;

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-ink-200 bg-white h-full">
      {/* Brand logo section */}
      <div className="flex items-center gap-2.5 px-5 py-4.5 border-b border-ink-150 h-[65px]">
        <img src="/logo.png" alt="BOS Framework logo" className="h-7 w-7 shrink-0 object-contain rounded" />
        <div className="min-w-0">
          <p className="font-display text-xs font-extrabold leading-tight text-ink-900 truncate">BOS Framework</p>
          <p className="text-[9px] leading-tight text-ink-400 truncate">Company directory</p>
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

        <NavLink to="/jira" className={linkClass}>
          <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="truncate">Jira Board</span>
        </NavLink>
      </nav>

      {/* Admin Console at the bottom */}
      <div className="px-3 py-4">
        <NavLink to="/admin" className={linkClass}>
          <svg className="h-5 w-5 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">Admin</span>
        </NavLink>
      </div>
    </aside>
  );
}
