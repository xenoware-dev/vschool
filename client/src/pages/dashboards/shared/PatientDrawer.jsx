import { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  Pencil,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  LogOut,
  Phone,
  Mail,
  KeyRound,
  NotebookPen,
  ChevronDown,
  Home,
  CalendarDays,
  Eye,
  Lock,
} from 'lucide-react';
import {
  Drawer,
  Tabs,
  Avatar,
  PatientStatus,
  AppointmentStatus,
  DeptChip,
  DeptChips,
  Badge,
  Menu,
  EmptyState,
  SkeletonRows,
  Alert,
  useToast,
  useConfirm,
} from '../../../components/ui';
import { patientsApi } from '../../../api/patients';
import { appointmentsApi } from '../../../api/appointments';
import { getDeptColor } from '../../../utils/constants';
import {
  formatDate,
  formatRelativeDay,
  formatClock,
  slotStart,
  toDateKey,
  idOf,
} from '../../../utils/format';
import { useAuth } from '../../../context/AuthContext';
import BookSessionModal from './BookSessionModal';
import SessionNotesModal from './SessionNotesModal';
import PatientFormModal from './PatientFormModal';
import { apiError, cleanName, deptList, hasNotes, needsNotes, MILESTONE_STATUSES } from './helpers';

const SessionCard = ({ s, canWrite, onWrite }) => {
  const [open, setOpen] = useState(false);
  const documented = hasNotes(s);
  return (
    <div className="timeline-item">
      <span className="timeline-marker" style={{ borderColor: getDeptColor(s.department) }} />
      <div className="card">
        <button
          type="button"
          className="w-full text-left px-4 py-3 flex items-start gap-3"
          onClick={() => setOpen((o) => !o)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-fg">{formatDate(s.date)}</span>
              <span className="text-sm text-muted">{formatClock(slotStart(s.timeSlot))}</span>
              <AppointmentStatus status={s.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <DeptChip dept={s.department} />
              <span>{cleanName(s.therapist?.name)}</span>
            </div>
          </div>
          {documented && (
            <ChevronDown
              size={16}
              className={`text-muted mt-1 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          )}
        </button>
        {open && documented && (
          <div className="px-4 pb-4 space-y-3 text-sm border-t border-line pt-3">
            {['subjective', 'objective', 'assessment', 'plan'].map(
              (k) =>
                s.soapNotes?.[k] && (
                  <div key={k}>
                    <div className="section-label mb-0.5">{k}</div>
                    <p className="text-fg-2 whitespace-pre-line">{s.soapNotes[k]}</p>
                  </div>
                )
            )}
            {!s.soapNotes?.assessment && s.sessionNotes && (
              <p className="text-fg-2 whitespace-pre-line">{s.sessionNotes}</p>
            )}
            {s.milestones?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.milestones.map((m, i) => (
                  <Badge key={i} tone={MILESTONE_STATUSES[m.status]?.tone}>
                    {m.goal}
                  </Badge>
                ))}
              </div>
            )}
            {s.homeActivities && (
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-center gap-1.5 font-medium text-fg mb-1">
                  <Home size={14} /> Home plan
                </div>
                <p className="text-fg-2 whitespace-pre-line">{s.homeActivities}</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {s.parentVisible ? <Eye size={13} /> : <Lock size={13} />}
              {s.parentVisible ? 'Shared with parent' : 'Internal to clinic'}
            </div>
          </div>
        )}
        {canWrite && (s.status === 'completed' || s.status === 'scheduled') && (
          <div className="px-4 pb-3">
            <button
              type="button"
              className={`btn btn-sm ${needsNotes(s) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onWrite(s)}
            >
              <NotebookPen size={14} /> {documented ? 'Edit notes' : 'Write notes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Child profile. Admins can edit, change status and book with any therapist;
 * therapists/teachers can book themselves and document their own sessions.
 */
const PatientDrawer = ({ patientId, onClose, onChanged }) => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState('overview');
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'book' | 'edit' | 'notes', ... }

  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([
        patientsApi.getOne(patientId),
        appointmentsApi.getAll({ patient: patientId }),
      ]);
      setPatient(p.data);
      setSessions(a.data);
      setError('');
    } catch (err) {
      setError(apiError(err, 'Could not load this child'));
    }
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged?.();
  };

  const changeStatus = async (status) => {
    const labels = { on_hold: 'Put on hold', discharged: 'Discharge', active: 'Reactivate' };
    if (status !== 'active') {
      const ok = await confirm({
        title: `${labels[status]} ${patient.name}?`,
        description:
          status === 'discharged'
            ? 'They will no longer appear in active lists and new sessions cannot be booked. You can reactivate them later.'
            : 'New sessions cannot be booked while a child is on hold.',
        confirmLabel: labels[status],
        tone: status === 'discharged' ? 'danger' : undefined,
      });
      if (!ok) return;
    }
    try {
      await patientsApi.update(patient._id, { status });
      const done = {
        on_hold: 'is now on hold',
        discharged: 'has been discharged',
        active: 'is active again',
      };
      toast({ title: `${patient.name} ${done[status]}` });
      refresh();
    } catch (err) {
      toast({ title: 'Could not update status', description: apiError(err), tone: 'error' });
    }
  };

  const today = toDateKey();
  const upcoming = (sessions || []).filter(
    (s) => s.status === 'scheduled' && toDateKey(s.date) >= today
  );
  const history = (sessions || []).filter((s) => !upcoming.includes(s)).reverse();
  const isMine = (s) => idOf(s.therapist) === idOf(user);

  const header = patient ? (
    <div className="flex items-start gap-3">
      <Avatar name={patient.name} size="xl" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-fg">{patient.name}</h2>
          <PatientStatus status={patient.status} />
        </div>
        <div className="text-sm text-muted mt-0.5 flex flex-wrap items-center gap-x-2">
          {patient.studentId && <span className="mono-tag">{patient.studentId}</span>}
          <span>
            {patient.age} yrs ·{' '}
            {patient.gender === 'female' ? 'Girl' : patient.gender === 'male' ? 'Boy' : 'Other'}
          </span>
          {patient.diagnosis && <span className="truncate-1">· {patient.diagnosis}</span>}
        </div>
      </div>
    </div>
  ) : (
    <div className="h-14" />
  );

  return (
    <>
      <Drawer
        onClose={onClose}
        width={620}
        header={header}
        footer={
          patient && (
            <>
              {isAdmin && (
                <Menu
                  align="start"
                  trigger={
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon mr-auto"
                      aria-label="More actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  }
                  items={[
                    patient.status !== 'active' && {
                      label: 'Reactivate',
                      icon: PlayCircle,
                      onClick: () => changeStatus('active'),
                    },
                    patient.status === 'active' && {
                      label: 'Put on hold',
                      icon: PauseCircle,
                      onClick: () => changeStatus('on_hold'),
                    },
                    patient.status !== 'discharged' && {
                      label: 'Discharge',
                      icon: LogOut,
                      danger: true,
                      onClick: () => changeStatus('discharged'),
                    },
                  ].filter(Boolean)}
                />
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModal({ type: 'edit', step: 0 })}
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={patient.status !== 'active'}
                title={
                  patient.status !== 'active' ? 'Reactivate the child to book sessions' : undefined
                }
                onClick={() => setModal({ type: 'book' })}
              >
                <CalendarPlus size={15} /> Book session
              </button>
            </>
          )
        }
      >
        <div className="px-5 pt-3 border-b border-line">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'overview', label: 'Overview' },
              { value: 'sessions', label: 'Sessions', count: sessions?.length },
              { value: 'family', label: 'Family' },
            ]}
          />
        </div>
        <div className="drawer-body">
          {error && <Alert tone="danger">{error}</Alert>}
          {!patient && !error && <SkeletonRows rows={5} />}

          {patient && tab === 'overview' && (
            <div className="space-y-6">
              {upcoming[0] && (
                <div className="rounded-lg border border-line p-3 flex items-center gap-3">
                  <CalendarDays size={18} className="text-primary shrink-0" />
                  <div className="text-sm min-w-0">
                    <div className="font-medium text-fg">
                      Next session: {formatRelativeDay(upcoming[0].date)},{' '}
                      {formatClock(slotStart(upcoming[0].timeSlot))}
                    </div>
                    <div className="text-muted truncate-1">
                      {deptList([upcoming[0].department])} with{' '}
                      {cleanName(upcoming[0].therapist?.name)}
                    </div>
                  </div>
                </div>
              )}
              <section>
                <div className="section-label mb-2">Therapies</div>
                <DeptChips depts={patient.enrolledDepartments} max={10} />
              </section>
              <section>
                <div className="section-label mb-2">Care team</div>
                {patient.assignedTherapists?.length ? (
                  <div className="card">
                    {patient.assignedTherapists.map((t) => (
                      <div key={t._id} className="list-row">
                        <Avatar name={t.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-fg truncate-1">
                            {cleanName(t.name)}{' '}
                            {idOf(t) === idOf(user) && (
                              <span className="text-muted font-normal">(you)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted truncate-1">
                            {deptList(t.departments)}
                          </div>
                        </div>
                        {t.phone && (
                          <a
                            className="btn btn-ghost btn-icon btn-sm"
                            href={`tel:${t.phone}`}
                            aria-label={`Call ${t.name}`}
                          >
                            <Phone size={15} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted">
                    No therapists assigned.{' '}
                    {isAdmin && (
                      <button
                        type="button"
                        className="text-primary font-medium"
                        onClick={() => setModal({ type: 'edit', step: 2 })}
                      >
                        Assign a care team
                      </button>
                    )}
                  </div>
                )}
              </section>
              <section>
                <div className="section-label mb-2">Details</div>
                <dl className="dl">
                  <dt>Programme</dt>
                  <dd>
                    {patient.categories
                      ?.map((c) => (c === 'school' ? 'Special school' : 'Therapy clinic'))
                      .join(' + ')}
                  </dd>
                  {patient.categories?.includes('school') && patient.schoolDetails?.grade && (
                    <>
                      <dt>Class</dt>
                      <dd>
                        {patient.schoolDetails.grade}
                        {patient.schoolDetails.section &&
                          ` · Section ${patient.schoolDetails.section}`}
                        {patient.schoolDetails.rollNo && ` · Roll ${patient.schoolDetails.rollNo}`}
                      </dd>
                    </>
                  )}
                  <dt>Date of birth</dt>
                  <dd>{formatDate(patient.dateOfBirth)}</dd>
                  <dt>Diagnosis</dt>
                  <dd>{patient.diagnosis || <span className="text-muted">Not recorded</span>}</dd>
                  <dt>Branch</dt>
                  <dd>{patient.branch?.name}</dd>
                  <dt>Registered</dt>
                  <dd>
                    {formatDate(patient.createdAt)}
                    {patient.registeredBy?.name && (
                      <span className="text-muted"> by {cleanName(patient.registeredBy.name)}</span>
                    )}
                  </dd>
                </dl>
              </section>
              {patient.medicalNotes && (
                <section>
                  <div className="section-label mb-2">Intake notes</div>
                  <p className="text-sm text-fg-2 whitespace-pre-line rounded-lg bg-surface-2 p-3">
                    {patient.medicalNotes}
                  </p>
                </section>
              )}
            </div>
          )}

          {patient && tab === 'sessions' && (
            <div className="space-y-6">
              {!sessions?.length && (
                <EmptyState
                  icon={CalendarDays}
                  title="No sessions yet"
                  description="Booked sessions and their notes will appear here."
                />
              )}
              {upcoming.length > 0 && (
                <section>
                  <div className="section-label mb-2">Upcoming</div>
                  <div className="card">
                    {upcoming.map((s) => (
                      <div key={s._id} className="list-row">
                        <div className="w-24 shrink-0">
                          <div className="font-medium text-fg text-sm">
                            {formatRelativeDay(s.date)}
                          </div>
                          <div className="text-xs text-muted">
                            {formatClock(slotStart(s.timeSlot))}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <DeptChip dept={s.department} />
                          <div className="text-xs text-muted mt-1 truncate-1">
                            {cleanName(s.therapist?.name)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {history.length > 0 && (
                <section>
                  <div className="section-label mb-3">History</div>
                  <div className="timeline">
                    {history.map((s) => (
                      <SessionCard
                        key={s._id}
                        s={s}
                        canWrite={!isAdmin && isMine(s)}
                        onWrite={(appt) =>
                          setModal({ type: 'notes', appointment: { ...appt, patient } })
                        }
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {patient && tab === 'family' && (
            <div className="space-y-6">
              <section>
                <div className="section-label mb-2">Parent / guardian</div>
                <div className="card p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={patient.parentDetails?.name || '?'} size="lg" />
                    <div>
                      <div className="font-medium text-fg">
                        {patient.parentDetails?.name || 'Not recorded'}
                      </div>
                      <div className="text-sm text-muted">
                        {patient.parentDetails?.relationship}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {patient.parentDetails?.phone && (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={`tel:${patient.parentDetails.phone}`}
                      >
                        <Phone size={14} /> {patient.parentDetails.phone}
                      </a>
                    )}
                    {patient.parentDetails?.email && (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={`mailto:${patient.parentDetails.email}`}
                      >
                        <Mail size={14} /> {patient.parentDetails.email}
                      </a>
                    )}
                  </div>
                  {patient.parentDetails?.address && (
                    <p className="text-sm text-fg-2">{patient.parentDetails.address}</p>
                  )}
                </div>
              </section>
              <section>
                <div className="section-label mb-2">Parent portal</div>
                {patient.parent ? (
                  <div className="card p-4 flex items-center gap-3">
                    <KeyRound size={18} className="text-success shrink-0" />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="font-medium text-fg">Active — {patient.parent.email}</div>
                      <div className="text-muted">
                        The family can see shared notes, goals and upcoming sessions.
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setModal({ type: 'edit', step: 1 })}
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <Alert tone="warning" title="No portal access">
                    This family can’t see session notes or progress yet.
                    {isAdmin && (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setModal({ type: 'edit', step: 1 })}
                        >
                          <KeyRound size={14} /> Set up parent login
                        </button>
                      </div>
                    )}
                  </Alert>
                )}
              </section>
            </div>
          )}
        </div>
      </Drawer>

      {modal?.type === 'book' && (
        <BookSessionModal
          patient={patient}
          self={isAdmin ? undefined : user}
          onClose={() => setModal(null)}
          onBooked={refresh}
        />
      )}
      {modal?.type === 'edit' && (
        <PatientFormModal
          patient={patient}
          startStep={modal.step}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
      {modal?.type === 'notes' && (
        <SessionNotesModal
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
};

export default PatientDrawer;
