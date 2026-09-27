import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarPlus,
  CalendarDays,
  CheckCircle2,
  NotebookPen,
  Baby,
  Check,
  UserX,
  Coffee,
  ChevronRight,
  PartyPopper,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  AppointmentStatus,
  DeptChip,
  EmptyState,
  SkeletonRows,
  Alert,
  Badge,
  useToast,
  cx,
} from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { appointmentsApi } from '../../api/appointments';
import { patientsApi } from '../../api/patients';
import {
  toDateKey,
  addDays,
  formatLongDate,
  formatRelativeDay,
  formatClock,
  slotStart,
  slotEnd,
  isSlotNow,
  isSlotPast,
  sortBySlot,
  greeting,
  firstName,
} from '../../utils/format';
import BookSessionModal from './shared/BookSessionModal';
import SessionNotesModal from './shared/SessionNotesModal';
import PatientDrawer from './shared/PatientDrawer';
import { apiError, cleanName, deptList, hasNotes, needsNotes, plural } from './shared/helpers';

const TherapistDashboard = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [openPatient, setOpenPatient] = useState(null);

  const { data, loading, error, reload } = useApi(async () => {
    const [sessions, patients] = await Promise.all([
      appointmentsApi.getAll(),
      patientsApi.getAll({ status: 'active' }),
    ]);
    return { sessions: sessions.data, patients: patients.data };
  });

  const today = toDateKey();
  const { todays, toWrite, upcoming } = useMemo(() => {
    const all = data?.sessions || [];
    return {
      todays: all
        .filter((s) => toDateKey(s.date) === today && s.status !== 'cancelled')
        .sort(sortBySlot),
      toWrite: all.filter(needsNotes).reverse(),
      upcoming: all
        .filter(
          (s) =>
            s.status === 'scheduled' &&
            toDateKey(s.date) > today &&
            toDateKey(s.date) <= addDays(today, 7)
        )
        .sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)) || sortBySlot(a, b)),
    };
  }, [data, today]);

  const done = todays.filter((s) => s.status === 'completed').length;
  const next = todays.find((s) => s.status === 'scheduled' && !isSlotPast(s.timeSlot));

  const mark = async (appt, status) => {
    try {
      const { data: updated } = await appointmentsApi.addNotes(appt._id, { status });
      reload();
      if (status === 'completed') {
        // Straight into notes while the session is fresh
        setModal({ type: 'notes', appointment: updated });
      } else {
        toast({ title: `${appt.patient?.name} marked no-show` });
      }
    } catch (err) {
      toast({ title: 'Could not update session', description: apiError(err), tone: 'error' });
    }
  };

  const openNotes = (appointment) => setModal({ type: 'notes', appointment });

  return (
    <>
      <PageHeader
        title="My day"
        description={`${greeting()}, ${firstName(cleanName(user.name))} · ${formatLongDate(new Date())}`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: 'book' })}
            disabled={!data?.patients.length}
          >
            <CalendarPlus size={16} /> Book session
          </button>
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
          value={loading ? '–' : todays.length}
          hint={next ? `Next at ${formatClock(slotStart(next.timeSlot))}` : 'Nothing else today'}
        />
        <Stat
          label="Done today"
          icon={CheckCircle2}
          accent="var(--success)"
          value={loading ? '–' : done}
        />
        <Stat
          label="Notes to write"
          icon={NotebookPen}
          accent={toWrite.length ? 'var(--warning)' : undefined}
          value={loading ? '–' : toWrite.length}
          hint={toWrite.length ? 'Parents are waiting for updates' : 'All caught up'}
        />
        <Stat
          label={user.role === 'teacher' ? 'My students' : 'My children'}
          icon={Baby}
          value={loading ? '–' : data?.patients.length}
          hint={deptList(user.departments)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Today"
            description="Tap Attended when a session ends — notes open straight away"
          />
          {loading ? (
            <SkeletonRows rows={4} />
          ) : todays.length === 0 ? (
            <EmptyState
              icon={Coffee}
              title="No sessions today"
              description="Enjoy the breather, or book a follow-up."
            />
          ) : (
            todays.map((s) => {
              const now = s.status === 'scheduled' && isSlotNow(s.timeSlot);
              const late = s.status === 'scheduled' && isSlotPast(s.timeSlot);
              return (
                <div key={s._id} className={cx('agenda-item', now && 'is-now')}>
                  <div className="agenda-time">
                    {formatClock(slotStart(s.timeSlot))}
                    <span>{formatClock(slotEnd(s.timeSlot))}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="font-medium text-fg hover:underline underline-offset-2"
                          onClick={() => setOpenPatient(s.patient?._id)}
                        >
                          {s.patient?.name}
                        </button>
                        {now ? (
                          <Badge tone="blue" dot>
                            Now
                          </Badge>
                        ) : late ? (
                          <Badge tone="amber" dot>
                            Awaiting check-in
                          </Badge>
                        ) : (
                          <AppointmentStatus status={s.status} />
                        )}
                      </div>
                      <div className="mt-1">
                        <DeptChip dept={s.department} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.status === 'scheduled' ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => mark(s, 'completed')}
                          >
                            <Check size={14} /> Attended
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => mark(s, 'no_show')}
                          >
                            <UserX size={14} /> No-show
                          </button>
                        </>
                      ) : s.status === 'completed' ? (
                        <button
                          type="button"
                          className={`btn btn-sm ${hasNotes(s) ? 'btn-ghost' : 'btn-secondary'}`}
                          onClick={() => openNotes(s)}
                        >
                          <NotebookPen size={14} /> {hasNotes(s) ? 'Edit notes' : 'Write notes'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Notes to write"
              description={toWrite.length ? plural(toWrite.length, 'session') : undefined}
            />
            {loading ? (
              <SkeletonRows rows={2} />
            ) : toWrite.length === 0 ? (
              <EmptyState
                icon={PartyPopper}
                title="All caught up"
                description="Every attended session has notes."
              />
            ) : (
              toWrite.slice(0, 6).map((s) => (
                <button
                  key={s._id}
                  type="button"
                  className="list-row is-interactive w-full text-left"
                  onClick={() => openNotes(s)}
                >
                  <NotebookPen size={16} className="text-warning shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-fg truncate-1">{s.patient?.name}</div>
                    <div className="text-xs text-muted">
                      {formatRelativeDay(s.date)} · {deptList([s.department])}
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-subtle" />
                </button>
              ))
            )}
          </Card>

          <Card>
            <CardHeader
              title="Coming up"
              description="Next 7 days"
              actions={
                <Link to="/dashboard/patients" className="btn btn-ghost btn-sm">
                  {user.role === 'teacher' ? 'Students' : 'Patients'} <ChevronRight size={14} />
                </Link>
              }
            />
            {loading ? (
              <SkeletonRows rows={3} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing booked"
                description="No sessions in the next week."
              />
            ) : (
              upcoming.slice(0, 8).map((s) => (
                <div key={s._id} className="list-row">
                  <div className="w-20 shrink-0">
                    <div className="text-sm font-medium text-fg">{formatRelativeDay(s.date)}</div>
                    <div className="text-xs text-muted">{formatClock(slotStart(s.timeSlot))}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-fg truncate-1">{s.patient?.name}</div>
                    <div className="text-xs text-muted truncate-1">{deptList([s.department])}</div>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>

      {modal?.type === 'book' && (
        <BookSessionModal
          patients={data?.patients || []}
          self={user}
          onClose={() => setModal(null)}
          onBooked={reload}
        />
      )}
      {modal?.type === 'notes' && (
        <SessionNotesModal
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
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

export default TherapistDashboard;
