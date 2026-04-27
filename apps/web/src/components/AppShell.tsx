import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, FileClock, FileSearch, ScrollText, ShieldCheck, LogOut, ChartNoAxesCombined, ListChecks } from 'lucide-react';
import { useOperatorSession } from '../session/OperatorSessionContext';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/proposals', label: 'Proposals', icon: FileSearch },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/ledger/entries', label: 'Posted Entries', icon: ScrollText },
  { to: '/reports', label: 'Reports', icon: ChartNoAxesCombined },
  { to: '/schedules', label: 'Schedules', icon: ListChecks },
  { to: '/audit', label: 'Audit', icon: FileClock }
];

export function AppShell() {
  const { session, clearSession } = useOperatorSession();

  return (
    <div className="grain min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-4 md:px-6 lg:flex-row">
        <aside className="rounded-[2rem] border border-black/8 bg-ink px-5 py-6 text-paper shadow-panel lg:w-72">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-paper/55">Operator Console</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-paper">Accounting control plane</h1>
            <p className="mt-3 text-sm text-paper/70">
              Review agent-assisted work, resolve approvals, and inspect posted ledger truth.
            </p>
          </div>

          <nav className="mt-8 flex flex-col gap-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                    isActive ? 'bg-paper text-ink' : 'text-paper/75 hover:bg-white/10 hover:text-paper'
                  )
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-paper/70">
            <p className="uppercase tracking-[0.16em] text-paper/45">Context</p>
            <p className="mt-3 break-all">{session?.organizationId}</p>
            <p className="mt-2 break-all">API: {session?.apiBaseUrl}</p>
          </div>

          <Button variant="ghost" className="mt-6 w-full justify-start text-paper/85 hover:bg-white/10" onClick={clearSession}>
            <LogOut size={16} className="mr-2" />
            Clear session
          </Button>
        </aside>

        <main className="flex-1">
          <div className="mb-6 rounded-[2rem] border border-black/8 bg-white/55 px-5 py-4 shadow-panel backdrop-blur-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-black/45">Live operator session</p>
                <p className="mt-1 text-sm text-black/65">
                  Organization <span className="font-semibold text-ink">{session?.organizationId}</span>
                  {session?.periodId ? <> · Period <span className="font-semibold text-ink">{session.periodId}</span></> : null}
                </p>
              </div>
              <p className="max-w-xl text-sm text-black/60">
                This UI reads and mutates the same approval-gated backend workflow the agent tools use. Human review remains authoritative.
              </p>
            </div>
          </div>

          <Outlet />
        </main>
      </div>
    </div>
  );
}
