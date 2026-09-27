import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  UserPlus,
  CalendarDays,
  CheckCircle2,
  Clock,
  Wallet,
  Check,
  UserX,
  MoreHorizontal,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Users,
  KeyRound,
  ChevronRight,
  Sun,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Segmented,
  AppointmentStatus,
  DeptChip,
  Menu,
  EmptyState,
  SkeletonRows,
  Progress,
  Avatar,
  Alert,
  useToast,
  cx,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { appointmentsApi } from '../../api/appointments';
import { patientsApi } from '../../api/patients';
import { usersApi } from '../../api/users';
import { billingApi } from '../../api/billing';
import { TIME_SLOTS } from '../../utils/constants';
import {
  formatLongDate,
  formatClock,
  slotStart,
  slotEnd,
  isSlotNow,
  isSlotPast,
  sortBySlot,
  formatCurrency,
  greeting,
  firstName,
  pct,
  toDateKey,
} from '../../utils/format';
import BookSessionModal from './shared/BookSessionModal';
import PatientFormModal from './shared/PatientFormModal';
import PatientDrawer from './shared/PatientDrawer';
import { apiError, cleanName, plural } from './shared/helpers';

const AdminDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [openPatient, setOpenPatient] = useState(null);

  const { data, loading, error, reload } = useApi(async () => {
    const [today, patients, therapists, billing] = await Promise.all([
      appointmentsApi.getToday(),
      patientsApi.getAll({ status: 'active' }),
      usersApi.getTherapists(),
      billingApi.getSummary(),
    ]);
    return {
      today: today.data,
      patients: patients.data,
      therapists: therapists.data,
      billing: billing.data,
    };
  });

  const sessions = useMemo(() => [...(data?.today || [])].sort(sortBySlot), [data]);
  const done = sessions.filter((s) => s.status === 'completed').length;
  const upcoming = sessions.filter(
    (s) => s.status === 'scheduled' && !isSlotPast(s.timeSlot)
  ).length;
  const overdue = sessions.filter((s) => s.status === 'scheduled' && isSlotPast(s.timeSlot));
  const live = sessions.filter((s) => s.status !== 'cancelled');

  const shown = sessions.filter((s) =>
    filter === 'todo'
      ? s.status === 'scheduled'
      : filter === 'done'
        ? s.status !== 'scheduled'
        : true
  );

  const setStatus = async (appt, status) => {
    try {
      await appointmentsApi.update(appt._id, { status });
      const words = {
        completed: 'marked attended',
        no_show: 'marked no-show',
        cancelled: 'cancelled',
        scheduled: 'restored',
      };
      toast({ title: `${appt.patient?.name} ${words[status]}` });
      reload();
    } catch (err) {
      toast({ title: 'Could not update session', description: apiError(err), tone: 'error' });
    }
  };

  const noTeam = (data?.patients || []).filter((p) => !p.assignedTherapists?.length);
  const noPortal = (data?.patients || []).filter((p) => !p.parent);
  const attention = [
    overdue.length > 0 && {
      icon: Clock,
      tone: 'var(--warning)',
      text: `${plural(overdue.length, 'session')} not checked in yet`,
      action: () => setFilter('todo'),
    },
    noTeam.length > 0 && {
      icon: Users,
      tone: 'var(--danger)',
      text: `${plural(noTeam.length, 'child', 'children')} without a care team`,
      to: '/dashboard/patients?filter=no-team',
    },
    noPortal.length > 0 && {
      icon: KeyRound,
      tone: 'var(--primary)',
      text: `${plural(noPortal.length, 'family', 'families')} without parent login`,
      to: '/dashboard/patients?filter=no-portal',
    },
    data?.billing?.pending.count > 0 && {
      icon: Wallet,
      tone: 'var(--warning)',
      text: `${formatCurrency(data.billing.pending.total)} in fees due (${data.billing.pending.count})`,
      to: '/dashboard/billing',
    },
  ].filter(Boolean);

  const load = (data?.therapists || [])
    .map((t) => ({ ...t, booked: live.filter((s) => s.therapist?._id === t._id).length }))
    .sort((a, b) => b.booked - a.booked);

  return (
    <>
      <PageHeader
        title="Today"
        description={`${greeting()}, ${firstName(cleanName(user.name))} · ${formatLongDate(new Date())} · ${user.branch?.name || ''}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModal('register')}
            >
              <UserPlus size={16} /> Register child
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal('book')}>
              <CalendarPlus size={16} /> Book session
            </button>
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
          label="Sessions today"
          icon={CalendarDays}
          value={loading ? '–' : live.length}
          hint={`${sessions.length - live.length} cancelled`}
        />
        <Stat
          label="Attended"
          icon={CheckCircle2}
          accent="var(--success)"
          value={loading ? '–' : done}
          hint={`${pct(done, live.length)}% of today`}
        >
          <Progress value={pct(done, live.length)} color="var(--success)" className="mt-2" />
        </Stat>
        <Stat
          label="Still to come"
          icon={Clock}
          value={loading ? '–' : upcoming}
          hint={overdue.length ? `${plural(overdue.length, 'check-in')} overdue` : 'All on track'}
        />
        <Stat
          label="Fees due"
          icon={Wallet}
          accent="var(--warning)"
          value={loading ? '–' : formatCurrency(data?.billing?.pending.total)}
          hint={data ? `Collected this month ${formatCurrency(data.billing.collected.total)}` : ''}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Today’s sessions"
            description="Mark attendance as children arrive"
            actions={
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All ${sessions.length}` },
                  { value: 'todo', label: 'To do' },
                  { value: 'done', label: 'Done' },
                ]}
              />
            }
          />
          {loading ? (
            <SkeletonRows rows={5} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={Sun}
              title={sessions.length ? 'Nothing here' : 'No sessions today'}
              description={
                sessions.length ? 'Try another filter.' : 'Book a session to fill today’s schedule.'
              }
              action={
                !sessions.length && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setModal('book')}
                  >
                    <CalendarPlus size={15} /> Book session
                  </button>
                )
              }
            />
          ) : (
            <div>
              {shown.map((s) => {
                const now = isSlotNow(s.timeSlot) && s.status === 'scheduled';
                const late = s.status === 'scheduled' && isSlotPast(s.timeSlot);
                return (
                  <div key={s._id} className={cx('agenda-item', now && 'is-now')}>
                    <div className="agenda-time">
                      {formatClock(slotStart(s.timeSlot))}
                      <span>{formatClock(slotEnd(s.timeSlot))}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="font-medium text-fg hover:underline underline-offset-2 truncate-1"
                            onClick={() => setOpenPatient(s.patient?._id)}
                          >
                            {s.patient?.name}
                          </button>
                          {now ? (
                            <span className="badge badge-blue badge-dot">In session</span>
                          ) : late ? (
                            <span className="badge badge-amber badge-dot">Check in</span>
                          ) : (
                            <AppointmentStatus status={s.status} />
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <DeptChip dept={s.department} />
                          <span className="truncate-1">with {cleanName(s.therapist?.name)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {s.status === 'scheduled' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setStatus(s, 'completed')}
                            >
                              <Check size={14} /> Attended
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setStatus(s, 'no_show')}
                            >
                              <UserX size={14} /> No-show
                            </button>
                          </>
                        )}
                        <Menu
                          trigger={
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon btn-sm"
                              aria-label="More"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          }
                          items={
                            s.status === 'scheduled'
                              ? [
                                  {
                                    label: 'Cancel session',
                                    icon: XCircle,
                                    danger: true,
                                    onClick: () => setStatus(s, 'cancelled'),
                                  },
                                ]
                              : [
                                  {
                                    label: 'Undo — back to scheduled',
                                    icon: RotateCcw,
                                    onClick: () => setStatus(s, 'scheduled'),
                                  },
                                ]
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Needs attention" />
            {loading ? (
              <SkeletonRows rows={3} />
            ) : attention.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All clear"
                description="Nothing needs follow-up right now."
              />
            ) : (
              <div>
                {attention.map((a) => {
                  const Row = a.to ? Link : 'button';
                  return (
                    <Row
                      key={a.text}
                      to={a.to}
                      type={a.to ? undefined : 'button'}
                      onClick={a.action}
                      className="list-row is-interactive w-full text-left"
                    >
                      <a.icon size={16} style={{ color: a.tone }} className="shrink-0" />
                      <span className="flex-1 text-sm text-fg">{a.text}</span>
                      <ChevronRight size={15} className="text-subtle" />
                    </Row>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Therapists today"
              actions={
                <Link to="/dashboard/schedule" className="btn btn-ghost btn-sm">
                  Schedule <ChevronRight size={14} />
                </Link>
              }
            />
            {loading ? (
              <SkeletonRows rows={3} />
            ) : load.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No active therapists"
                description="Add staff to start booking."
              />
            ) : (
              <div>
                {load.map((t) => (
                  <div key={t._id} className="list-row">
                    <Avatar name={t.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-fg truncate-1">{cleanName(t.name)}</span>
                        <span className="text-muted tnum shrink-0">
                          {t.booked}/{TIME_SLOTS.length}
                        </span>
                      </div>
                      <Progress value={pct(t.booked, TIME_SLOTS.length)} className="mt-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {modal === 'book' && (
        <BookSessionModal
          patients={data?.patients || []}
          initial={{ date: toDateKey() }}
          onClose={() => setModal(null)}
          onBooked={reload}
        />
      )}
      {modal === 'register' && <PatientFormModal onClose={() => setModal(null)} onSaved={reload} />}
      {openPatient && (
        <PatientDrawer
          patientId={openPatient}
          onClose={() => setOpenPatient(null)}
          onChanged={reload}
        />
      )}
    </>
  );
};

export default AdminDashboard;
