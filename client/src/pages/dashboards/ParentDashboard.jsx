import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Phone,
  Home,
  MessageSquareText,
  Receipt,
  ChevronRight,
  Target,
  Baby,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Avatar,
  DeptChip,
  DeptChips,
  Badge,
  EmptyState,
  PageSkeleton,
  Alert,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  toDateKey,
  formatRelativeDay,
  formatDate,
  formatLongDate,
  formatClock,
  slotStart,
  formatCurrency,
  greeting,
  firstName,
} from '../../utils/format';
import { useParentData } from './parent/useParentData';
import ChildSwitcher from './parent/ChildSwitcher';
import { cleanName, deptList } from './shared/helpers';

const ParentDashboard = () => {
  const { user } = useAuth();
  const { loading, error, children, child, selectChild, sessions, payments } = useParentData();

  if (loading) return <PageSkeleton />;

  const today = toDateKey();
  const upcoming = sessions
    .filter((s) => s.status === 'scheduled' && toDateKey(s.date) >= today)
    .sort(
      (a, b) =>
        toDateKey(a.date).localeCompare(toDateKey(b.date)) || a.timeSlot.localeCompare(b.timeSlot)
    );
  const shared = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => toDateKey(b.date).localeCompare(toDateKey(a.date)));
  const latest = shared.find((s) => s.soapNotes?.assessment || s.sessionNotes);
  const homePlan = shared.find((s) => s.homeActivities);
  const due = payments.filter((p) => p.status === 'pending');
  const next = upcoming[0];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName(cleanName(user.name))}`}
        description={formatLongDate(new Date())}
        actions={<ChildSwitcher kids={children} child={child} onSelect={selectChild} />}
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {!child ? (
        <Card>
          <EmptyState
            icon={Baby}
            title="No child linked to your account yet"
            description="Please ask the clinic reception to link your child’s profile to this login."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="p-5 flex flex-wrap items-center gap-4">
              <Avatar name={child.name} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-fg">{child.name}</h2>
                <div className="text-sm text-muted">
                  {child.age} yrs · {child.branch?.name}
                  {child.studentId && (
                    <>
                      {' '}
                      · <span className="mono-tag">{child.studentId}</span>
                    </>
                  )}
                </div>
                <div className="mt-2">
                  <DeptChips depts={child.enrolledDepartments} max={6} />
                </div>
              </div>
              <div className="rounded-lg bg-surface-2 px-4 py-3 min-w-[220px]">
                <div className="section-label mb-1">Next session</div>
                {next ? (
                  <>
                    <div className="font-semibold text-fg">
                      {formatRelativeDay(next.date)}, {formatClock(slotStart(next.timeSlot))}
                    </div>
                    <div className="text-sm text-muted">
                      {deptList([next.department])} with {cleanName(next.therapist?.name)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted">
                    Nothing booked yet — the clinic will schedule the next one.
                  </div>
                )}
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Latest update from the therapist"
                  actions={
                    <Link
                      to={`/dashboard/progress?child=${child._id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      All progress <ChevronRight size={14} />
                    </Link>
                  }
                />
                {latest ? (
                  <div className="card-body space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <DeptChip dept={latest.department} />
                      <span>
                        {formatDate(latest.date)} · {cleanName(latest.therapist?.name)}
                      </span>
                    </div>
                    <p className="text-fg leading-relaxed whitespace-pre-line">
                      {latest.soapNotes?.assessment || latest.sessionNotes}
                    </p>
                    {latest.soapNotes?.plan && (
                      <p className="text-sm text-fg-2">
                        <span className="font-medium text-fg">Next focus: </span>
                        {latest.soapNotes.plan}
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    icon={MessageSquareText}
                    title="No updates yet"
                    description="Therapists share a short summary here after sessions."
                  />
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Practice at home"
                  description={
                    homePlan
                      ? `From ${cleanName(homePlan.therapist?.name)}, ${formatDate(homePlan.date)}`
                      : undefined
                  }
                />
                {homePlan ? (
                  <div className="card-body">
                    <p className="text-fg whitespace-pre-line leading-relaxed">
                      {homePlan.homeActivities}
                    </p>
                    <Link
                      to={`/dashboard/progress?child=${child._id}#home`}
                      className="btn btn-secondary btn-sm mt-4"
                    >
                      <Home size={14} /> Open daily checklist
                    </Link>
                  </div>
                ) : (
                  <EmptyState
                    icon={Home}
                    title="No home activities yet"
                    description="Your therapist will suggest simple activities to practise together."
                  />
                )}
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader title="Upcoming sessions" />
                {upcoming.length === 0 ? (
                  <EmptyState icon={CalendarDays} title="Nothing booked" />
                ) : (
                  upcoming.slice(0, 5).map((s) => (
                    <div key={s._id} className="list-row">
                      <div className="w-24 shrink-0">
                        <div className="text-sm font-medium text-fg">
                          {formatRelativeDay(s.date)}
                        </div>
                        <div className="text-xs text-muted">
                          {formatClock(slotStart(s.timeSlot))} · 45 min
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-fg truncate-1">{deptList([s.department])}</div>
                        <div className="text-xs text-muted truncate-1">
                          {cleanName(s.therapist?.name)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </Card>

              <Card>
                <CardHeader title="Care team" />
                {child.assignedTherapists?.length ? (
                  child.assignedTherapists.map((t) => (
                    <div key={t._id} className="list-row">
                      <Avatar name={t.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-fg truncate-1">
                          {cleanName(t.name)}
                        </div>
                        <div className="text-xs text-muted truncate-1">
                          {deptList(t.departments)}
                        </div>
                      </div>
                      {t.phone && (
                        <a href={`tel:${t.phone}`} className="btn btn-secondary btn-sm">
                          <Phone size={14} /> Call
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted">
                    The clinic will assign therapists soon.
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader title="Fees" />
                {payments.length === 0 ? (
                  <EmptyState icon={Receipt} title="No fee records" />
                ) : (
                  <>
                    {due.length > 0 && (
                      <div className="px-4 pt-3">
                        <Alert
                          tone="warning"
                          title={`${formatCurrency(due.reduce((n, p) => n + p.amount, 0))} due`}
                        >
                          Please pay at reception
                          {due[0].dueDate ? ` by ${formatDate(due[0].dueDate)}` : ''}.
                        </Alert>
                      </div>
                    )}
                    {payments.slice(0, 4).map((p) => (
                      <div key={p._id} className="list-row">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-fg truncate-1">{p.description}</div>
                          <div className="text-xs text-muted">
                            {p.receiptNo} · {formatDate(p.paidAt || p.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-fg tnum">
                            {formatCurrency(p.amount)}
                          </div>
                          {p.status === 'paid' ? (
                            <Badge tone="green">Paid</Badge>
                          ) : (
                            <Badge tone="amber">Due</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </Card>
            </div>
          </div>

          <Link
            to={`/dashboard/progress?child=${child._id}`}
            className="card flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors"
          >
            <Target size={18} className="text-primary" />
            <span className="flex-1 text-fg font-medium">
              See {child.name.split(' ')[0]}’s goals and progress
            </span>
            <ChevronRight size={16} className="text-muted" />
          </Link>
        </div>
      )}
    </>
  );
};

export default ParentDashboard;
