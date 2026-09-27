import { useMemo, useState } from 'react';
import { Printer, CheckCircle2, UserX, Baby, Wallet, BarChart3 } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Segmented,
  PersonCell,
  EmptyState,
  SkeletonRows,
  Alert,
  Badge,
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useApi } from '../../../hooks/useApi';
import { appointmentsApi } from '../../../api/appointments';
import { patientsApi } from '../../../api/patients';
import { usersApi } from '../../../api/users';
import { branchApi } from '../../../api/branches';
import { billingApi } from '../../../api/billing';
import { getDeptName } from '../../../utils/constants';
import { toDateKey, addDays, formatDate, formatCurrency, pct } from '../../../utils/format';
import { cleanName, deptList, needsNotes } from './helpers';

const RANGES = {
  '30d': { label: 'Last 30 days', from: () => addDays(toDateKey(), -29) },
  month: { label: 'This month', from: () => `${toDateKey().slice(0, 7)}-01` },
  '90d': { label: 'Last 90 days', from: () => addDays(toDateKey(), -89) },
};

// Session outcomes use status colours, always shown next to their label
const OUTCOMES = [
  { key: 'completed', label: 'Attended', color: 'var(--success)' },
  { key: 'no_show', label: 'No-show', color: 'var(--warning)' },
  { key: 'cancelled', label: 'Cancelled', color: 'var(--subtle)' },
];

const AGE_GROUPS = [
  ['0–3 yrs', 0, 3],
  ['4–6 yrs', 4, 6],
  ['7–10 yrs', 7, 10],
  ['11+ yrs', 11, 99],
];

// Horizontal magnitude bars — one hue, value as text, exact figure on hover
const BarList = ({ rows, unit = '', empty = 'No data for this period' }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <div className="p-4 text-sm text-muted">{empty}</div>;
  return (
    <div className="card-body space-y-3">
      {rows.map((r) => (
        <div key={r.label} title={`${r.label}: ${r.value}${unit}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
            <span className="text-fg-2 truncate-1">{r.label}</span>
            <span className="text-fg font-medium tnum shrink-0">
              {r.value}
              {unit}
            </span>
          </div>
          <div className="h-2 rounded bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded bg-primary"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const Reports = () => {
  const { user } = useAuth();
  const isOwner = user.role === 'owner';
  const [range, setRange] = useState('30d');
  const [branch, setBranch] = useState('');

  const from = RANGES[range].from();
  const to = toDateKey();

  const { data: branches } = useApi(
    async () => (isOwner ? (await branchApi.getAll()).data : []),
    [isOwner]
  );

  const { data, loading, error } = useApi(async () => {
    const scope = branch ? { branch } : {};
    const [sessions, patients, staff, payments] = await Promise.all([
      appointmentsApi.getAll({ ...scope, from, to }),
      patientsApi.getAll(scope),
      usersApi.getAll({ ...scope, role: 'therapist,teacher' }),
      billingApi.getPayments({ ...scope, status: 'paid', from, to }),
    ]);
    return {
      sessions: sessions.data,
      patients: patients.data,
      staff: staff.data,
      payments: payments.data,
    };
  }, [branch, from, to]);

  const r = useMemo(() => {
    if (!data) return null;
    const past = data.sessions.filter((s) => s.status !== 'scheduled');
    const count = (status) => past.filter((s) => s.status === status).length;
    const completed = count('completed');
    const noShow = count('no_show');
    const cancelled = count('cancelled');
    const active = data.patients.filter((p) => p.status === 'active');

    const byDept = {};
    data.sessions
      .filter((s) => s.status === 'completed')
      .forEach((s) => (byDept[s.department] = (byDept[s.department] || 0) + 1));

    const clinicians = data.staff
      .filter((u) => u.isActive)
      .map((t) => {
        const mine = past.filter((s) => s.therapist?._id === t._id);
        const done = mine.filter((s) => s.status === 'completed');
        const missed = mine.filter((s) => s.status === 'no_show').length;
        return {
          ...t,
          children: active.filter((p) => p.assignedTherapists?.some((a) => a._id === t._id)).length,
          completed: done.length,
          noShow: missed,
          attendance: pct(done.length, done.length + missed),
          undocumented: done.filter(needsNotes).length,
        };
      })
      .sort((a, b) => b.completed - a.completed);

    const ageOf = (p) => p.age ?? 0;
    return {
      completed,
      noShow,
      cancelled,
      totalPast: past.length,
      attendance: pct(completed, completed + noShow),
      activeChildren: active.length,
      newChildren: data.patients.filter((p) => toDateKey(p.createdAt) >= from).length,
      fees: data.payments.reduce((n, p) => n + p.amount, 0),
      byDept: Object.entries(byDept)
        .map(([k, v]) => ({ label: getDeptName(k), value: v }))
        .sort((a, b) => b.value - a.value),
      ages: AGE_GROUPS.map(([label, lo, hi]) => ({
        label,
        value: active.filter((p) => ageOf(p) >= lo && ageOf(p) <= hi).length,
      })),
      programmes: [
        {
          label: 'Therapy clinic',
          value: active.filter((p) => p.categories?.includes('clinic')).length,
        },
        {
          label: 'Special school',
          value: active.filter((p) => p.categories?.includes('school')).length,
        },
        { label: 'Both', value: active.filter((p) => p.categories?.length > 1).length },
      ],
      clinicians,
    };
  }, [data, from]);

  const scopeName = isOwner
    ? branches?.find((b) => b._id === branch)?.name || 'All branches'
    : user.branch?.name;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`${scopeName} · ${formatDate(from)} – ${formatDate(to)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2 no-print">
            {isOwner && (
              <select
                className="select w-auto"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                aria-label="Branch"
              >
                <option value="">All branches</option>
                {(branches || []).map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
            <Segmented
              value={range}
              onChange={setRange}
              options={Object.entries(RANGES).map(([value, { label }]) => ({ value, label }))}
            />
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </button>
          </div>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Sessions attended"
          icon={CheckCircle2}
          accent="var(--success)"
          value={r ? r.completed : '–'}
          hint={r && `${r.totalPast} sessions due in period`}
        />
        <Stat
          label="Attendance rate"
          icon={UserX}
          value={r ? `${r.attendance}%` : '–'}
          hint={r && `${r.noShow} no-shows · ${r.cancelled} cancelled`}
        />
        <Stat
          label="Active children"
          icon={Baby}
          value={r ? r.activeChildren : '–'}
          hint={r && `${r.newChildren} registered in period`}
        />
        <Stat
          label="Fees collected"
          icon={Wallet}
          value={r ? formatCurrency(r.fees) : '–'}
          hint={r && `${data.payments.length} receipts`}
        />
      </div>

      {loading || !r ? (
        <Card>
          <SkeletonRows rows={6} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Session outcomes" description="Sessions whose date has passed" />
              <div className="card-body space-y-4">
                {r.totalPast === 0 ? (
                  <div className="text-sm text-muted">No past sessions in this period.</div>
                ) : (
                  <>
                    <div
                      className="stacked-bar"
                      role="img"
                      aria-label={OUTCOMES.map(
                        (o) => `${o.label} ${r[o.key === 'no_show' ? 'noShow' : o.key]}`
                      ).join(', ')}
                    >
                      {OUTCOMES.map((o) => {
                        const v = r[o.key === 'no_show' ? 'noShow' : o.key];
                        return v ? (
                          <span
                            key={o.key}
                            title={`${o.label}: ${v}`}
                            style={{ width: `${pct(v, r.totalPast)}%`, background: o.color }}
                          />
                        ) : null;
                      })}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {OUTCOMES.map((o) => {
                        const v = r[o.key === 'no_show' ? 'noShow' : o.key];
                        return (
                          <div key={o.key}>
                            <div className="flex items-center gap-1.5 text-sm text-muted">
                              <span
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ background: o.color }}
                              />
                              {o.label}
                            </div>
                            <div className="text-xl font-semibold text-fg tnum">{v}</div>
                            <div className="text-xs text-muted tnum">{pct(v, r.totalPast)}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Sessions by therapy" description="Attended sessions in period" />
              <BarList rows={r.byDept} />
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Therapist activity"
              description="Caseload, attendance and documentation in this period"
            />
            {r.clinicians.length === 0 ? (
              <EmptyState icon={BarChart3} title="No therapists" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Therapist</th>
                      {isOwner && !branch && <th>Branch</th>}
                      <th className="col-right">Children</th>
                      <th className="col-right">Attended</th>
                      <th className="col-right">No-shows</th>
                      <th className="col-right">Attendance</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.clinicians.map((t) => (
                      <tr key={t._id}>
                        <td>
                          <PersonCell
                            name={cleanName(t.name)}
                            sub={deptList(t.departments)}
                            size="sm"
                          />
                        </td>
                        {isOwner && !branch && (
                          <td className="text-sm text-fg-2">{t.branch?.name}</td>
                        )}
                        <td className="col-right tnum">{t.children}</td>
                        <td className="col-right tnum">{t.completed}</td>
                        <td className="col-right tnum">{t.noShow}</td>
                        <td className="col-right tnum">
                          {t.completed + t.noShow ? `${t.attendance}%` : '—'}
                        </td>
                        <td>
                          {t.undocumented ? (
                            <Badge tone="amber" dot>
                              {t.undocumented} to write
                            </Badge>
                          ) : (
                            <Badge tone="green" dot>
                              Up to date
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Children by age" description="Active children" />
              <BarList rows={r.ages} />
            </Card>
            <Card>
              <CardHeader
                title="Children by programme"
                description="Active children — a child can be in both"
              />
              <BarList rows={r.programmes} />
            </Card>
          </div>
        </div>
      )}
    </>
  );
};

export default Reports;
