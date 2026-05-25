import { NavLink } from 'react-router-dom';
import {
  SquaresIcon,
  CartIcon,
  CubeIcon,
  ArchiveIcon,
  BanknoteIcon,
  ChartBarIcon,
  SignOutIcon,
  ChevronLeftIcon,
} from './Icons.jsx';

const links = [
  { to: '/app',           label: 'Dashboard', end: true, Icon: SquaresIcon },
  { to: '/app/orders',    label: 'Orders',              Icon: CartIcon },
  { to: '/app/products',  label: 'Products',            Icon: CubeIcon },
  { to: '/app/inventory', label: 'Inventory',           Icon: ArchiveIcon },
  { to: '/app/expenses',  label: 'Expenses',            Icon: BanknoteIcon },
  { to: '/app/reports',   label: 'Reports',             Icon: ChartBarIcon },
];

export default function NavBar({ collapsed, onToggle, onSignOut, animClass = '' }) {
  return (
    <nav
      aria-label="Primary"
      className={`fixed top-6 left-5 bottom-6 surface-shell border border-divider/60 shadow-lifted rounded-2xl flex flex-col transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] z-30 overflow-hidden ${collapsed ? 'w-16' : 'w-60'} ${animClass}`}
    >
      {/* Nav links */}
      <div className="flex-1 flex flex-col gap-0.5 px-2 pt-4 pb-3">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            title={collapsed ? l.label : undefined}
            aria-label={collapsed ? l.label : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-accent/[0.08] text-accent'
                  : 'text-ink-secondary hover:text-ink hover:bg-elevated/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && !collapsed && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" aria-hidden="true" />
                )}
                <span className="flex-shrink-0"><l.Icon /></span>
                <span className={`whitespace-nowrap transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>{l.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Sign out — back to landing */}
      {onSignOut && (
        <div className="px-2">
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="btn-press flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] text-ink-tertiary hover:text-ink-secondary hover:bg-elevated/40 transition-all duration-150"
            title={collapsed ? 'Back to landing' : undefined}
          >
            <SignOutIcon />
            <span className={`whitespace-nowrap transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Sign out</span>
          </button>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="px-2 pb-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="btn-press flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] text-ink-tertiary hover:text-ink-secondary hover:bg-elevated/40 transition-all duration-150"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeftIcon className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          <span className={`whitespace-nowrap transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>Collapse</span>
        </button>
      </div>
    </nav>
  );
}
