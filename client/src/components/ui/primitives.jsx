import { Search, X, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { initials, hueFromString } from '../../utils/format';
import { APPOINTMENT_STATUSES, PATIENT_STATUSES, getDeptColor, getDeptName } from '../../utils/constants';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ─── Identity ─────────────────────────────────────────────────────────── */
export const Avatar = ({ name = '', size = 'md', square = false, className }) => (
  <span
    className={cx('avatar', size !== 'md' && `avatar-${size}`, square && 'avatar-square', className)}
    style={{ '--h': hueFromString(name) }}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
);

export const PersonCell = ({ name, sub, size = 'md', onClick, children }) => (
  <div className="flex items-center gap-3 min-w-0">
    <Avatar name={name} size={size} />
    <div className="min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {onClick ? (
          <button type="button" onClick={onClick} className="font-medium text-fg truncate-1 hover:underline underline-offset-2 text-left">
            {name}
          </button>
        ) : (
          <span className="font-medium text-fg truncate-1">{name}</span>
        )}
        {children}
      </div>
      {sub && <div className="text-xs text-muted truncate-1">{sub}</div>}
    </div>
  </div>
);

/* ─── Badges & chips ──────────────────────────────────────────────────── */
export const Badge = ({ tone = 'gray', dot = false, children, className, ...rest }) => (
  <span className={cx('badge', `badge-${tone}`, dot && 'badge-dot', className)} {...rest}>
    {children}
  </span>
);

export const AppointmentStatus = ({ status }) => {
  const meta = APPOINTMENT_STATUSES[status] || { label: status, tone: 'gray' };
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
};

export const PatientStatus = ({ status }) => {
  const meta = PATIENT_STATUSES[status] || { label: status, tone: 'gray' };
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
};

export const DeptChip = ({ dept, label }) => (
  <span className="chip" title={getDeptName(dept)}>
    <span className="chip-dot" style={{ background: getDeptColor(dept) }} />
    {label || getDeptName(dept)}
  </span>
);

export const DeptChips = ({ depts = [], max = 3 }) => {
  if (!depts.length) return <span className="text-muted">—</span>;
  const shown = depts.slice(0, max);
  const rest = depts.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((d) => <DeptChip key={d} dept={d} />)}
      {rest > 0 && (
        <span className="chip text-muted" title={depts.slice(max).map(getDeptName).join(', ')}>+{rest}</span>
      )}
    </div>
  );
};

export const Kbd = ({ children }) => <kbd className="kbd">{children}</kbd>;

/* ─── Feedback ────────────────────────────────────────────────────────── */
export const Spinner = ({ className }) => <span className={cx('spinner inline-block', className)} aria-label="Loading" />;

export const Skeleton = ({ className, style }) => <div className={cx('skeleton', className)} style={style} />;

export const SkeletonRows = ({ rows = 5, className }) => (
  <div className={cx('p-4 space-y-3', className)}>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          <Skeleton className="h-2.5 w-1/4" />
        </div>
      </div>
    ))}
  </div>
);

export const PageSkeleton = () => (
  <div>
    <div className="page-header">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-80" />
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card stat space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
    <div className="card"><SkeletonRows rows={6} /></div>
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div className={cx('empty', className)}>
    {Icon && <div className="empty-icon"><Icon size={18} /></div>}
    <div className="empty-title">{title}</div>
    {description && <div className="empty-desc">{description}</div>}
    {action && <div className="empty-action">{action}</div>}
  </div>
);

const ALERT_ICONS = { danger: CircleAlert, info: Info, warning: TriangleAlert };

export const Alert = ({ tone = 'info', title, children, className }) => {
  const Icon = ALERT_ICONS[tone] || Info;
  return (
    <div className={cx('alert', `alert-${tone}`, className)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={16} />
      <div className="min-w-0">
        {title && <div className="font-medium text-fg">{title}</div>}
        {children}
      </div>
    </div>
  );
};

export const Progress = ({ value = 0, color, className }) => (
  <div className={cx('progress', className)}>
    <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
  </div>
);

/* ─── Layout ──────────────────────────────────────────────────────────── */
export const PageHeader = ({ title, description, actions, children }) => (
  <div className="page-header">
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-desc">{description}</p>}
      {children}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const Card = ({ className, children, ...rest }) => (
  <div className={cx('card', className)} {...rest}>{children}</div>
);

export const CardHeader = ({ title, description, actions, noBorder }) => (
  <div className={cx('card-header', noBorder && 'no-border')}>
    <div className="min-w-0">
      <div className="card-title">{title}</div>
      {description && <div className="card-desc">{description}</div>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const Stat = ({ label, value, hint, icon: Icon, accent, children }) => (
  <div className="card stat">
    <div className="stat-label">
      {Icon && <Icon size={14} style={accent ? { color: accent } : undefined} />}
      {label}
    </div>
    <div className="stat-value">{value}</div>
    {hint && <div className="stat-hint">{hint}</div>}
    {children}
  </div>
);

/* ─── Form controls ───────────────────────────────────────────────────── */
export const Field = ({ label, hint, error, optional, htmlFor, children, className }) => (
  <div className={cx('field', className)}>
    {label && (
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="optional">Optional</span>}
      </label>
    )}
    {children}
    {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
  </div>
);

export const SearchInput = ({ value, onChange, placeholder = 'Search…', className, autoFocus }) => (
  <div className={cx('input-wrap', className)}>
    <span className="input-icon"><Search size={15} /></span>
    <input
      type="search"
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
    />
    {value && (
      <span className="input-trailing">
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      </span>
    )}
  </div>
);

export const Segmented = ({ value, onChange, options, className }) => (
  <div className={cx('segmented', className)} role="tablist">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        role="tab"
        aria-selected={value === o.value}
        className={value === o.value ? 'active' : ''}
        onClick={() => onChange(o.value)}
      >
        {o.icon && <o.icon size={14} />}
        {o.label}
      </button>
    ))}
  </div>
);

export const Tabs = ({ value, onChange, tabs, className }) => (
  <div className={cx('tabs', className)} role="tablist">
    {tabs.map((t) => (
      <button
        key={t.value}
        type="button"
        role="tab"
        aria-selected={value === t.value}
        className={cx('tab', value === t.value && 'active')}
        onClick={() => onChange(t.value)}
      >
        {t.icon && <t.icon size={15} />}
        {t.label}
        {t.count !== undefined && <span className="tab-count">{t.count}</span>}
      </button>
    ))}
  </div>
);

export const Switch = ({ checked, onChange, label, id }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className="switch"
    onClick={() => onChange(!checked)}
  />
);
