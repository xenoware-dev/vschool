import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  PanelLeft,
  Menu as MenuIcon,
  Search,
  Sun,
  Moon,
  Monitor,
  LogOut,
  ChevronsUpDown,
  ChevronRight,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { NAV_ITEMS, ROLES, flatNav } from '../utils/constants';
import BrandMark from './BrandMark';
import CommandPalette from './layout/CommandPalette';
import { Avatar, Kbd, Menu, cx } from './ui';

const ShellContext = createContext(false);
const COLLAPSE_KEY = 'vschool_sidebar_collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * App shell. Used as a layout route (renders <Outlet/>). A page that still wraps
 * itself in <DashboardLayout> inside the shell just renders its children.
 */
const DashboardLayout = ({ children }) => {
  const insideShell = useContext(ShellContext);
  if (insideShell) return <>{children}</>;
  return (
    <ShellContext.Provider value>
      <AppShell>{children ?? <Outlet />}</AppShell>
    </ShellContext.Provider>
  );
};

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const { preference, setTheme, theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const sections = NAV_ITEMS[user?.role] || [];
  const roleInfo = ROLES[user?.role];
  const current = flatNav(user?.role).find((n) =>
    n.path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(n.path)
  );
  const workspaceSub = user?.branch?.name || (user?.role === 'owner' ? 'All branches' : roleInfo?.label);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const themeItem = (value, label, icon) => ({
    label,
    icon,
    hint: preference === value ? <Check size={14} /> : null,
    onClick: () => setTheme(value),
  });

  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <aside className={cx('sidebar', collapsed && 'is-collapsed', mobileOpen && 'is-mobile-open')} aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="workspace-btn" title={collapsed ? `Absolute · ${workspaceSub}` : undefined}>
            <BrandMark size={28} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="workspace-name">Absolute</div>
                <div className="workspace-sub">{workspaceSub}</div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {sections.map((group) => (
            <div key={group.section} className="nav-section">
              <div className="nav-section-label">{group.section}</div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/dashboard'}
                    className={({ isActive }) => cx('nav-link', isActive && 'active')}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={17} strokeWidth={1.9} />
                    {!collapsed && <span className="truncate-1">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Menu
            align="start"
            width={232}
            block
            trigger={
              <button type="button" className="user-btn" aria-label="Account menu">
                <Avatar name={user?.name} size="sm" />
                {!collapsed && (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-fg truncate-1">{user?.name}</div>
                      <div className="text-xs text-muted truncate-1">{roleInfo?.label}</div>
                    </div>
                    <ChevronsUpDown size={14} className="text-subtle shrink-0" />
                  </>
                )}
              </button>
            }
            items={[
              { heading: user?.email },
              themeItem('light', 'Light', Sun),
              themeItem('dark', 'Dark', Moon),
              themeItem('system', 'System', Monitor),
              'separator',
              { label: 'Sign out', icon: LogOut, onClick: handleLogout, danger: true },
            ]}
          />
        </div>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────── */}
      <div className="main-area">
        <header className="topbar no-print">
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <MenuIcon size={17} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm hidden lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft size={17} />
          </button>

          <div className="h-4 w-px bg-line hidden lg:block" />

          <nav className="breadcrumb" aria-label="Breadcrumb">
            <span className="truncate-1 hidden sm:inline">{workspaceSub}</span>
            <ChevronRight size={14} className="text-subtle shrink-0 hidden sm:inline" />
            <strong>{current?.label || 'Dashboard'}</strong>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <Search size={15} />
              <span className="flex-1 text-left hidden md:inline">Search…</span>
              <span className="hidden md:flex items-center gap-0.5">
                <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <main className="page-scroll">
          <div className="page">{children}</div>
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
};

export default DashboardLayout;
