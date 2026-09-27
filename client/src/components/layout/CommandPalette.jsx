import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, Moon, Sun, LogOut, ArrowRight, CalendarPlus, UserPlus, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { patientsApi } from '../../api/patients';
import { useDebounced } from '../../hooks/useApi';
import { flatNav } from '../../utils/constants';
import { toDateKey } from '../../utils/format';
import { useLayer, Avatar, Kbd, Spinner, cx } from '../ui';

const CAN_SEARCH_PATIENTS = ['admin', 'therapist', 'teacher'];

const CommandPalette = ({ onClose }) => {
  useLayer(onClose);
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [patients, setPatients] = useState([]);
  const [searching, setSearching] = useState(false);
  const listRef = useRef(null);
  const debounced = useDebounced(query, 250);
  const canSearch = CAN_SEARCH_PATIENTS.includes(user?.role);

  useEffect(() => {
    if (!canSearch || debounced.trim().length < 2) {
      setPatients([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    patientsApi
      .getAll({ search: debounced.trim() })
      .then((res) => !cancelled && setPatients(res.data.slice(0, 6)))
      .catch(() => !cancelled && setPatients([]))
      .finally(() => !cancelled && setSearching(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, canSearch]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = flatNav(user?.role)
      .filter((n) => !q || n.label.toLowerCase().includes(q))
      .map((n) => ({
        id: `page-${n.path}`,
        icon: n.icon,
        label: n.label,
        hint: 'Page',
        run: () => navigate(n.path),
      }));

    const people = patients.map((p) => ({
      id: `patient-${p._id}`,
      avatar: p.name,
      label: p.name,
      sub: [p.studentId, p.diagnosis].filter(Boolean).join(' · '),
      run: () => navigate(`/dashboard/patients?open=${p._id}`),
    }));

    const role = user?.role;
    const actions = [
      role === 'admin' && {
        id: 'book',
        icon: CalendarPlus,
        label: "Book a session for today",
        run: () => navigate(`/dashboard/schedule?date=${toDateKey()}&book=1`),
      },
      (role === 'admin' || role === 'owner') && {
        id: 'add-staff',
        icon: UserPlus,
        label: 'Add staff member',
        run: () => navigate('/dashboard/staff?add=1'),
      },
      role === 'owner' && {
        id: 'add-branch',
        icon: Building2,
        label: 'Create branch',
        run: () => navigate('/dashboard/branches?add=1'),
      },
      {
        id: 'theme',
        icon: theme === 'dark' ? Sun : Moon,
        label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        run: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'logout',
        icon: LogOut,
        label: 'Sign out',
        run: () => {
          logout();
          navigate('/login');
        },
      },
    ].filter((a) => a && (!q || a.label.toLowerCase().includes(q)));

    return [
      { label: 'Pages', items: pages },
      { label: 'Patients', items: people },
      { label: 'Actions', items: actions },
    ].filter((g) => g.items.length > 0);
  }, [query, patients, user?.role, theme, navigate, setTheme, logout]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => setActive(0), [query, patients]);

  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const runItem = (item) => {
    onClose();
    item?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runItem(flat[active]);
    }
  };

  let index = -1;

  return createPortal(
    <div className="modal-backdrop" style={{ paddingTop: '12vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={canSearch ? 'Search patients or jump to a page…' : 'Jump to a page…'}
            aria-label="Search"
          />
          {searching && <Spinner />}
          <Kbd>Esc</Kbd>
        </div>

        <div className="cmdk-list" ref={listRef} role="listbox">
          {flat.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              {searching ? 'Searching…' : `No results for “${query}”`}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <div className="cmdk-group-label">{g.label}</div>
                {g.items.map((item) => {
                  index += 1;
                  const i = index;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      className={cx('cmdk-item', i === active && 'is-active')}
                      onMouseMove={() => setActive(i)}
                      onClick={() => runItem(item)}
                    >
                      {item.avatar ? <Avatar name={item.avatar} size="sm" /> : Icon && <Icon size={16} />}
                      <span className="flex-1 min-w-0">
                        <span className="block truncate-1">{item.label}</span>
                        {item.sub && <span className="block text-xs text-muted truncate-1">{item.sub}</span>}
                      </span>
                      {i === active ? <CornerDownLeft size={14} /> : item.hint && <span className="text-xs text-subtle">{item.hint}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
          {canSearch && query.trim().length > 0 && query.trim().length < 2 && (
            <div className="px-3 py-2 text-xs text-subtle flex items-center gap-1">
              <ArrowRight size={12} /> Type at least 2 characters to search patients
            </div>
          )}
        </div>

        <div className="cmdk-footer">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> Navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> Open</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
