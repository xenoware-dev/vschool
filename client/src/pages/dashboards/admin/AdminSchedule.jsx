import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
  Plus,
  Check,
  UserX,
  XCircle,
  CalendarClock,
  RotateCcw,
  Users,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  Modal,
  ModalBody,
  Field,
  SlotPicker,
  Alert,
  AppointmentStatus,
  DeptChip,
  Avatar,
  EmptyState,
  SkeletonRows,
  useToast,
  cx,
} from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { appointmentsApi } from '../../../api/appointments';
import { usersApi } from '../../../api/users';
import { patientsApi } from '../../../api/patients';
import { DEPARTMENTS, TIME_SLOTS, getDeptColor, getDeptName } from '../../../utils/constants';
import {
  toDateKey,
  parseDateKey,
  addDays,
  isTodayKey,
  formatDate,
  formatLongDate,
  formatClock,
  slotStart,
  slotEnd,
  isSlotNow,
  isSlotPast,
} from '../../../utils/format';
import BookSessionModal from '../shared/BookSessionModal';
import PatientDrawer from '../shared/PatientDrawer';
import { apiError, cleanName, deptList } from '../shared/helpers';

const OCCUPYING = ['scheduled', 'completed'];

// Monday-based week containing `key`
const weekOf = (key) => {
  const d = parseDateKey(key);
  const monday = addDays(key, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

const RescheduleModal = ({ appt, therapists, onClose, onDone }) => {
  const toast = useToast();
  const [date, setDate] = useState(toDateKey(appt.date));
  const [therapistId, setTherapistId] = useState(appt.therapist?._id);
  const [slot, setSlot] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    appointmentsApi
      .getAvailableSlots({ therapist: therapistId, date, patient: appt.patient?._id })
      .then((res) => {
        if (!cancelled) {
          // The session's own slot counts as free when nothing else changes
          const own =
            date === toDateKey(appt.date) && therapistId === appt.therapist?._id
              ? [appt.timeSlot]
              : [];
          setSlots(TIME_SLOTS.filter((s) => res.data.available.includes(s) || own.includes(s)));
        }
      })
      .catch((err) => !cancelled && setError(apiError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, therapistId, appt]);

  const save = async () => {
    try {
      await appointmentsApi.update(appt._id, {
        date,
        timeSlot: slot,
        therapist: therapistId,
        status: 'scheduled',
      });
      toast({
        title: 'Session moved',
        description: `${appt.patient?.name} · ${formatDate(date)} at ${formatClock(slotStart(slot))}`,
      });
      onDone();
    } catch (err) {
      setError(apiError(err, 'Could not reschedule'));
    }
  };

  const eligible = therapists.filter((t) => t.departments?.includes(appt.department));

  return (
    <Modal
      title={`Reschedule ${appt.patient?.name}`}
      description={`${getDeptName(appt.department)} · currently ${formatDate(appt.date)} at ${formatClock(slotStart(appt.timeSlot))}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!slot} onClick={save}>
            Move session
          </button>
        </>
      }
    >
      <ModalBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" htmlFor="rs-date">
            <input
              id="rs-date"
              type="date"
              className="input"
              min={toDateKey()}
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </Field>
          <Field label="Therapist" htmlFor="rs-ther">
            <select
              id="rs-ther"
              className="select"
              value={therapistId}
              onChange={(e) => setTherapistId(e.target.value)}
            >
              {eligible.map((t) => (
                <option key={t._id} value={t._id}>
                  {cleanName(t.name)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="New time">
          <SlotPicker slots={slots} value={slot} onChange={setSlot} date={date} loading={loading} />
        </Field>
      </ModalBody>
    </Modal>
  );
};

const SessionModal = ({ appt, onClose, onStatus, onReschedule, onOpenChild, onBookSlot }) => {
  const locked = appt.status !== 'scheduled';
  return (
    <Modal
      size="sm"
      title={appt.patient?.name}
      description={`${formatLongDate(appt.date)} · ${formatClock(slotStart(appt.timeSlot))} – ${formatClock(slotEnd(appt.timeSlot))}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost mr-auto" onClick={onOpenChild}>
            Open profile
          </button>
          {appt.status === 'scheduled' ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onStatus('no_show')}
              >
                <UserX size={15} /> No-show
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onStatus('completed')}
              >
                <Check size={15} /> Attended
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onStatus('scheduled')}
            >
              <RotateCcw size={15} /> Undo
            </button>
          )}
        </>
      }
    >
      <ModalBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentStatus status={appt.status} />
          <DeptChip dept={appt.department} />
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={appt.therapist?.name} size="sm" />
          <span className="text-sm text-fg">{cleanName(appt.therapist?.name)}</span>
        </div>
        {!locked && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onReschedule}>
              <CalendarClock size={14} /> Reschedule
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-danger"
              onClick={() => onStatus('cancelled')}
            >
              <XCircle size={14} /> Cancel session
            </button>
          </div>
        )}
        {['cancelled', 'no_show'].includes(appt.status) && onBookSlot && (
          <Alert tone="info">
            This slot is free again.{' '}
            <button type="button" className="font-medium text-primary" onClick={onBookSlot}>
              Book someone else
            </button>
          </Alert>
        )}
      </ModalBody>
    </Modal>
  );
};

const AdminSchedule = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '')
    ? params.get('date')
    : toDateKey();
  const setDate = (key) => {
    const next = new URLSearchParams(params);
    next.set('date', key);
    setParams(next, { replace: true });
  };
  const [dept, setDept] = useState('');
  const [modal, setModal] = useState(null);

  // ?book=1 (e.g. from the command palette) opens booking for the shown date, then clears itself
  useEffect(() => {
    if (params.get('book') !== '1') return;
    setModal({ type: 'book', initial: { date: date < toDateKey() ? toDateKey() : date } });
    const next = new URLSearchParams(params);
    next.delete('book');
    setParams(next, { replace: true });
  }, [params, setParams, date]);
  const [openPatient, setOpenPatient] = useState(null);
  const week = useMemo(() => weekOf(date), [date]);

  const { data: staff } = useApi(async () => {
    const [t, p] = await Promise.all([
      usersApi.getTherapists(),
      patientsApi.getAll({ status: 'active' }),
    ]);
    return { therapists: t.data, patients: p.data };
  });

  const {
    data: weekSessions,
    loading,
    error,
    reload,
  } = useApi(
    async () => (await appointmentsApi.getAll({ from: week[0], to: week[6] })).data,
    [week[0]]
  );

  const daySessions = useMemo(
    () => (weekSessions || []).filter((s) => toDateKey(s.date) === date),
    [weekSessions, date]
  );
  const perDay = useMemo(() => {
    const c = {};
    (weekSessions || []).forEach((s) => {
      if (OCCUPYING.includes(s.status)) c[toDateKey(s.date)] = (c[toDateKey(s.date)] || 0) + 1;
    });
    return c;
  }, [weekSessions]);

  const columns = (staff?.therapists || []).filter((t) => !dept || t.departments?.includes(dept));
  const isPastDay = date < toDateKey();
  const today = isTodayKey(date);

  // Occupying session wins the cell; otherwise show the most recent cancelled/no-show greyed out
  const cellFor = (therapistId, slot) => {
    const here = daySessions.filter((s) => s.therapist?._id === therapistId && s.timeSlot === slot);
    return here.find((s) => OCCUPYING.includes(s.status)) || here[here.length - 1];
  };

  const setStatus = async (appt, status) => {
    try {
      await appointmentsApi.update(appt._id, { status });
      toast({
        title: 'Session updated',
        description: `${appt.patient?.name} — ${status.replace('_', '-')}`,
      });
      setModal(null);
      reload();
    } catch (err) {
      toast({ title: 'Could not update', description: apiError(err), tone: 'error' });
    }
  };

  const booked = daySessions.filter((s) => OCCUPYING.includes(s.status)).length;
  const capacity = columns.length * TIME_SLOTS.length;

  return (
    <>
      <PageHeader
        title="Schedule"
        description={`${formatLongDate(parseDateKey(date))} · ${booked} booked of ${capacity} slots`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              setModal({ type: 'book', initial: { date: isPastDay ? toDateKey() : date } })
            }
          >
            <CalendarPlus size={16} /> Book session
          </button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setDate(addDays(date, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="grid grid-cols-7 gap-1 flex-1 min-w-[420px]">
            {week.map((key) => {
              const d = parseDateKey(key);
              const active = key === date;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDate(key)}
                  className={cx(
                    'rounded-lg px-2 py-1.5 text-center transition-colors',
                    active ? 'bg-primary text-white' : 'hover:bg-surface-2',
                    isTodayKey(key) && !active && 'ring-1 ring-inset ring-primary'
                  )}
                >
                  <div className={cx('text-xs', active ? 'opacity-80' : 'text-muted')}>
                    {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </div>
                  <div className="font-semibold tnum">{d.getDate()}</div>
                  <div className={cx('text-[11px] tnum', active ? 'opacity-80' : 'text-muted')}>
                    {perDay[key] ? `${perDay[key]} booked` : '—'}
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-icon"
            onClick={() => setDate(addDays(date, 7))}
            aria-label="Next week"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDate(toDateKey())}
            disabled={today}
          >
            Today
          </button>
          <input
            type="date"
            className="input w-auto"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Pick a date"
          />
          <select
            className="select w-auto"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Filter by therapy"
          >
            <option value="">All therapies</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        {loading || !staff ? (
          <SkeletonRows rows={8} />
        ) : columns.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No therapists to show"
            description={
              dept
                ? 'Nobody in this branch offers this therapy.'
                : 'Add therapists on the Staff page.'
            }
          />
        ) : (
          <div className="sched-wrap">
            <div
              className="sched"
              style={{ gridTemplateColumns: `96px repeat(${columns.length}, minmax(170px, 1fr))` }}
            >
              <div className="sched-corner">Time</div>
              {columns.map((t) => (
                <div key={t._id} className="sched-head">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={t.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-fg truncate-1">
                        {cleanName(t.name)}
                      </div>
                      <div className="text-xs text-muted truncate-1">{deptList(t.departments)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {TIME_SLOTS.map((slot) => {
                const now = today && isSlotNow(slot);
                const past = isPastDay || (today && isSlotPast(slot));
                return (
                  <div key={slot} className="contents">
                    <div className={cx('sched-time', now && 'is-now')}>
                      <strong>{formatClock(slotStart(slot))}</strong>
                      {formatClock(slotEnd(slot))}
                    </div>
                    {columns.map((t) => {
                      const s = cellFor(t._id, slot);
                      return (
                        <div key={t._id} className={cx('sched-cell', now && 'sched-row-now')}>
                          {s ? (
                            <button
                              type="button"
                              className={cx(
                                'sched-event',
                                !OCCUPYING.includes(s.status) && 'is-muted'
                              )}
                              style={{ borderLeftColor: getDeptColor(s.department) }}
                              onClick={() => setModal({ type: 'session', appt: s })}
                            >
                              <span className="sched-event-title">{s.patient?.name}</span>
                              <span className="sched-event-meta">
                                {getDeptName(s.department)}
                                {s.status !== 'scheduled' && (
                                  <>
                                    {' '}
                                    ·{' '}
                                    {s.status === 'completed'
                                      ? '✓ Attended'
                                      : s.status === 'no_show'
                                        ? 'No-show'
                                        : 'Cancelled'}
                                  </>
                                )}
                              </span>
                            </button>
                          ) : past ? null : (
                            <button
                              type="button"
                              className="sched-empty"
                              onClick={() =>
                                setModal({
                                  type: 'book',
                                  initial: { date, timeSlot: slot, therapistId: t._id },
                                })
                              }
                              aria-label={`Book ${cleanName(t.name)} at ${formatClock(slotStart(slot))}`}
                            >
                              <Plus size={14} /> Book
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {modal?.type === 'book' && (
        <BookSessionModal
          patients={staff?.patients || []}
          initial={modal.initial}
          onClose={() => setModal(null)}
          onBooked={reload}
        />
      )}
      {modal?.type === 'session' && (
        <SessionModal
          appt={modal.appt}
          onClose={() => setModal(null)}
          onStatus={(status) => setStatus(modal.appt, status)}
          onReschedule={() => setModal({ type: 'reschedule', appt: modal.appt })}
          onOpenChild={() => {
            setOpenPatient(modal.appt.patient?._id);
            setModal(null);
          }}
          onBookSlot={
            isPastDay || (today && isSlotPast(modal.appt.timeSlot))
              ? undefined
              : () =>
                  setModal({
                    type: 'book',
                    initial: {
                      date,
                      timeSlot: modal.appt.timeSlot,
                      therapistId: modal.appt.therapist?._id,
                    },
                  })
          }
        />
      )}
      {modal?.type === 'reschedule' && (
        <RescheduleModal
          appt={modal.appt}
          therapists={staff?.therapists || []}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            reload();
          }}
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

export default AdminSchedule;
