import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import {
  Modal,
  ModalBody,
  Field,
  PersonPicker,
  SlotPicker,
  Alert,
  Avatar,
  useToast,
} from '../../../components/ui';
import { appointmentsApi } from '../../../api/appointments';
import { usersApi } from '../../../api/users';
import { DEPARTMENTS, getDeptName } from '../../../utils/constants';
import {
  toDateKey,
  addDays,
  formatRelativeDay,
  formatClock,
  slotStart,
} from '../../../utils/format';
import { apiError, cleanName, deptList } from './helpers';

/**
 * Book a session.
 * - Admin: pass `patients` (or a fixed `patient`); therapists load automatically.
 * - Therapist/teacher: pass `self` (the signed-in clinician) — they can only book themselves.
 * Optional presets: `initial = { date, timeSlot, therapistId, department }`.
 */
const BookSessionModal = ({
  patients = [],
  patient: fixedPatient,
  self,
  initial = {},
  onClose,
  onBooked,
}) => {
  const toast = useToast();
  const [patientId, setPatientId] = useState(fixedPatient?._id || '');
  const [therapists, setTherapists] = useState(self ? [self] : []);
  const [therapistId, setTherapistId] = useState(self?._id || initial.therapistId || '');
  const [department, setDepartment] = useState(initial.department || '');
  const [date, setDate] = useState(initial.date || addDays(toDateKey(), 1));
  const [timeSlot, setTimeSlot] = useState(initial.timeSlot || '');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const child = fixedPatient || patients.find((p) => p._id === patientId);

  useEffect(() => {
    if (self) return;
    usersApi
      .getTherapists()
      .then((res) => setTherapists(res.data))
      .catch((err) => setError(apiError(err, 'Could not load therapists')));
  }, [self]);

  // Departments on offer: the child's enrolled ones (limited to the clinician's own when booking yourself)
  const deptOptions = useMemo(() => {
    let keys = child?.enrolledDepartments?.length
      ? child.enrolledDepartments
      : DEPARTMENTS.map((d) => d.key);
    if (self) keys = keys.filter((k) => self.departments?.includes(k));
    const presetTherapist =
      !self && initial.therapistId && therapists.find((t) => t._id === initial.therapistId);
    if (presetTherapist) {
      const own = keys.filter((k) => presetTherapist.departments?.includes(k));
      if (own.length) keys = own;
    }
    return keys;
  }, [child, self, therapists, initial.therapistId]);

  // Keep the department valid for the chosen child
  useEffect(() => {
    if (deptOptions.length && !deptOptions.includes(department)) setDepartment(deptOptions[0]);
  }, [deptOptions, department]);

  // Therapists who deliver this department; the child's assigned team first
  const therapistOptions = useMemo(() => {
    if (self) return [self];
    const assigned = new Set((child?.assignedTherapists || []).map((t) => t._id || t));
    return therapists
      .filter((t) => !department || t.departments?.includes(department))
      .sort(
        (a, b) =>
          Number(assigned.has(b._id)) - Number(assigned.has(a._id)) || a.name.localeCompare(b.name)
      );
  }, [self, therapists, department, child]);

  useEffect(() => {
    if (self) return;
    if (!therapistOptions.some((t) => t._id === therapistId))
      setTherapistId(therapistOptions[0]?._id || '');
  }, [therapistOptions, therapistId, self]);

  // Open slots for therapist + child on the chosen date
  useEffect(() => {
    if (!therapistId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    appointmentsApi
      .getAvailableSlots({ therapist: therapistId, date, patient: child?._id })
      .then((res) => {
        if (cancelled) return;
        setSlots(res.data.available);
        setTimeSlot((current) => (res.data.available.includes(current) ? current : ''));
      })
      .catch((err) => !cancelled && setError(apiError(err)))
      .finally(() => !cancelled && setLoadingSlots(false));
    return () => {
      cancelled = true;
    };
  }, [therapistId, date, child?._id]);

  const assignedIds = new Set((child?.assignedTherapists || []).map((t) => t._id || t));
  const therapist = therapistOptions.find((t) => t._id === therapistId);
  const canSubmit = child && department && therapistId && date && timeSlot && !saving;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await appointmentsApi.create({
        patient: child._id,
        therapist: therapistId,
        department,
        date,
        timeSlot,
      });
      toast({
        title: 'Session booked',
        description: `${child.name} · ${formatRelativeDay(date)} at ${formatClock(slotStart(timeSlot))}`,
      });
      onBooked?.(data);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not book this session'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Book a session"
      description={
        fixedPatient ? `For ${fixedPatient.name}` : 'Choose the child, therapy and a free time slot'
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto text-sm text-muted truncate-1 hidden sm:block">
            {canSubmit &&
              `${child.name} · ${getDeptName(department)} · ${formatRelativeDay(date)}, ${formatClock(slotStart(timeSlot))}`}
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="book-session"
            className="btn btn-primary"
            disabled={!canSubmit}
          >
            <CalendarCheck size={16} />
            {saving ? 'Booking…' : 'Book session'}
          </button>
        </>
      }
    >
      <ModalBody>
        <form id="book-session" onSubmit={submit} className="space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}

          {!fixedPatient && (
            <Field label="Child">
              <PersonPicker
                people={patients}
                value={patientId}
                onChange={setPatientId}
                placeholder="Search by name or ID…"
                getSub={(p) =>
                  [p.studentId, p.age != null && `${p.age} yrs`, deptList(p.enrolledDepartments)]
                    .filter(Boolean)
                    .join(' · ')
                }
                emptyText="No active children match"
              />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Therapy" htmlFor="book-dept">
              <select
                id="book-dept"
                className="select"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                {deptOptions.map((d) => (
                  <option key={d} value={d}>
                    {getDeptName(d)}
                  </option>
                ))}
              </select>
            </Field>

            {self ? (
              <Field label="Therapist">
                <div className="flex items-center gap-2 h-9 text-sm">
                  <Avatar name={self.name} size="sm" />
                  <span className="font-medium">You</span>
                </div>
              </Field>
            ) : (
              <Field
                label="Therapist"
                htmlFor="book-therapist"
                hint={
                  therapist && child && !assignedIds.has(therapist._id)
                    ? 'Not on this child’s care team yet'
                    : undefined
                }
              >
                <select
                  id="book-therapist"
                  className="select"
                  value={therapistId}
                  onChange={(e) => setTherapistId(e.target.value)}
                  disabled={!therapistOptions.length}
                >
                  {!therapistOptions.length && (
                    <option value="">No therapist offers this therapy</option>
                  )}
                  {therapistOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {cleanName(t.name)}
                      {assignedIds.has(t._id) ? ' — care team' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <Field label="Date" htmlFor="book-date">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="book-date"
                type="date"
                className="input w-auto"
                value={date}
                min={toDateKey()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
              {[0, 1, 2].map((n) => {
                const key = addDays(toDateKey(), n);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm ${date === key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDate(key)}
                  >
                    {formatRelativeDay(key)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label="Time"
            hint="Each session is 45 minutes. Only times when both the therapist and child are free are shown."
          >
            <SlotPicker
              slots={slots}
              value={timeSlot}
              onChange={setTimeSlot}
              date={date}
              loading={loadingSlots}
            />
          </Field>
        </form>
      </ModalBody>
    </Modal>
  );
};

export default BookSessionModal;
