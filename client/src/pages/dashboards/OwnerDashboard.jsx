import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Baby,
  CalendarDays,
  Wallet,
  Plus,
  UserPlus,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Badge,
  Progress,
  EmptyState,
  SkeletonRows,
  Alert,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { branchApi } from '../../api/branches';
import { patientsApi } from '../../api/patients';
import { billingApi } from '../../api/billing';
import { getDeptName } from '../../utils/constants';
import { formatCurrency, formatLongDate, greeting, firstName, pct } from '../../utils/format';
import { cleanName } from './shared/helpers';

const OwnerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, loading, error } = useApi(async () => {
    const [overview, stats, billing] = await Promise.all([
      branchApi.getOverview(),
      patientsApi.getStats(),
      billingApi.getSummary(),
    ]);
    return { overview: overview.data, stats: stats.data, billing: billing.data };
  });

  const rows = data?.overview || [];
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  const todayTotal = sum('todaySessions');
  const todayDone = sum('todayCompleted');
  const depts = (data?.stats.byDepartment || []).slice(0, 8);
  const maxDept = Math.max(1, ...depts.map((d) => d.count));

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${greeting()}, ${firstName(cleanName(user.name))} · ${formatLongDate(new Date())}`}
        actions={
          <>
            <Link to="/dashboard/staff?add=1" className="btn btn-secondary">
              <UserPlus size={16} /> Add staff
            </Link>
            <Link to="/dashboard/branches?add=1" className="btn btn-primary">
              <Plus size={16} /> New branch
            </Link>
          </>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Branches"
          icon={Building2}
          value={loading ? '–' : rows.filter((r) => r.branch.isActive).length}
          hint={`${rows.length} in network`}
        />
        <Stat
          label="Active children"
          icon={Baby}
          value={data ? data.stats.active : '–'}
          hint={data && `${data.stats.onHold} on hold · ${data.stats.discharged} discharged`}
        />
        <Stat
          label="Sessions today"
          icon={CalendarDays}
          value={loading ? '–' : todayTotal}
          hint={`${todayDone} attended so far`}
        >
          <Progress value={pct(todayDone, todayTotal)} className="mt-2" />
        </Stat>
        <Stat
          label="Fees this month"
          icon={Wallet}
          accent="var(--success)"
          value={data ? formatCurrency(data.billing.collected.total) : '–'}
          hint={data && `${formatCurrency(data.billing.pending.total)} still due`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Branches"
            description="Today and this month at a glance"
            actions={
              <Link to="/dashboard/branches" className="btn btn-ghost btn-sm">
                Manage <ChevronRight size={14} />
              </Link>
            }
          />
          {loading ? (
            <SkeletonRows rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No branches yet"
              description="Create your first branch to start adding staff and children."
              action={
                <Link to="/dashboard/branches?add=1" className="btn btn-primary btn-sm">
                  <Plus size={15} /> New branch
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th className="col-right">Children</th>
                    <th className="col-right">Therapists</th>
                    <th>Today</th>
                    <th className="col-right">Fees (month)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.branch._id}
                      className="row-link"
                      onClick={() => navigate(`/dashboard/branches?open=${r.branch._id}`)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">{r.branch.name}</span>
                          {!r.branch.isActive && <Badge tone="gray">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-muted">
                          <span className="mono-tag">{r.branch.code}</span> {r.branch.city}
                        </div>
                      </td>
                      <td className="col-right tnum">{r.activePatients}</td>
                      <td className="col-right tnum">
                        {r.clinicians}
                        {r.admins === 0 && <div className="text-xs text-warning">No admin</div>}
                      </td>
                      <td className="min-w-[140px]">
                        <div className="flex items-center gap-2 text-sm tnum">
                          <span className="text-fg">
                            {r.todayCompleted}/{r.todaySessions}
                          </span>
                          <Progress
                            value={pct(r.todayCompleted, r.todaySessions)}
                            className="flex-1"
                          />
                        </div>
                      </td>
                      <td className="col-right tnum">{formatCurrency(r.monthRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Children by therapy"
              description="Active enrolments across the network"
            />
            {loading ? (
              <SkeletonRows rows={4} />
            ) : depts.length === 0 ? (
              <EmptyState icon={BarChart3} title="No enrolments yet" />
            ) : (
              <div className="card-body space-y-3">
                {depts.map((d) => (
                  <div key={d._id} title={`${getDeptName(d._id)}: ${d.count}`}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-fg-2 truncate-1">{getDeptName(d._id)}</span>
                      <span className="text-fg font-medium tnum">{d.count}</span>
                    </div>
                    <div className="h-2 rounded bg-surface-3 overflow-hidden">
                      <div
                        className="h-full rounded bg-primary"
                        style={{ width: `${(d.count / maxDept) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Link
            to="/dashboard/reports"
            className="card flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors"
          >
            <BarChart3 size={18} className="text-primary" />
            <span className="flex-1">
              <span className="block font-medium text-fg">Reports</span>
              <span className="block text-sm text-muted">
                Attendance, therapist activity and fees by branch
              </span>
            </span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        </div>
      </div>
    </>
  );
};

export default OwnerDashboard;
