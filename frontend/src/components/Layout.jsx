import { useState } from "react";

export default function Layout({ children, activePage, onNavigate }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: "dashboard", label: "Dashboard",  icon: GridIcon },
    { id: "alerts",    label: "Alerts",      icon: AlertIcon },
    { id: "permits",   label: "Permits",     icon: ClipboardIcon },
    { id: "timeline",  label: "Timeline",    icon: ChartIcon },
  ];

  return (
    <div className="flex h-screen bg-[#060b18] text-slate-200">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? "w-52" : "w-14"
        } flex flex-col border-r border-white/[0.06] bg-[#080e1e] transition-all duration-200`}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-white/[0.06] px-4">
          {sidebarOpen && (
            <span className="text-sm font-bold tracking-wide text-slate-100">
              SentriX
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`rounded-md p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-300 ${
              sidebarOpen ? "ml-auto" : "mx-auto"
            }`}
            aria-label="Toggle sidebar"
          >
            <MenuIcon />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/[0.08] text-slate-100"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`h-4 w-4 flex-shrink-0 transition ${
                    isActive
                      ? "text-slate-200"
                      : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                {sidebarOpen && item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-4 py-3">
          {sidebarOpen && (
            <p className="text-[10px] uppercase tracking-widest text-slate-600">
              Compound Risk Intelligence
            </p>
          )}
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#080e1e]/60 px-6 backdrop-blur-md">
          <h1 className="text-xs font-semibold tracking-wide text-slate-300">
            Compound Risk Intelligence Platform
          </h1>
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              Synthetic Data / Prototype
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-hidden p-3">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Inline SVG icons ────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function GridIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function ClipboardIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function ChartIcon({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm6-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v10.125c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 019 19.875V9.75zm6-4.125c0-.621.504-1.125 1.125-1.125h2.25C18.996 4.5 19.5 5.004 19.5 5.625v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V5.625z" />
    </svg>
  );
}
