import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Baby, CalendarDays, History, NotebookPen, CalendarPlus } from 'lucide-react';
import {
  PageHeader,
  Card,
  Tabs,
  SearchInput,
  Avatar,
  DeptChips,
  PatientStatus,
  EmptyState,
  SkeletonRows,
  Alert,
  Badge,
} from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useApi } from '../../../hooks/useApi';
import { patientsApi } from '../../../api/patients';
import { appointmentsApi } from '../../../api/appointments';
import { getDeptName } from '../../../utils/constants';
import {
  toDateKey,
  formatRelativeDay,
  formatDate,
  formatClock,
  slotStart,
} from '../../../utils/format';
import PatientDrawer from '../shared/PatientDrawer';
import BookSessionModal from '../shared/BookSessionModal';
import { needsNotes } from '../shared/helpers';

const TherapistPatients = () => {
  const { user } = useAuth();
  const isTeacher = user.role === 'teacher';
  const noun = isTeacher ? 'students' : 'children';
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [booking, setBooking] = useState(null);

  const openId = params.get('open');
  const setOpen = (id) => {
    const next = new URLSearchParams(params);
    if (id) next.set('open', id);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const { data, loading, error, reload } = useApi(async () => {
    const [patients, sessions] = await Promise.all([
      patientsApi.getAll(),
      appointmentsApi.getAll(),
    ]);
    return { patients: patients.data, sessions: sessions.data };
  });

  // Next / last session and outstanding notes for each child (from my own sessions)
  const activity = useMemo(() => {
    const today = toDateKey();
    const map = {};
    (data?.sessions || []).forEach((s) => {
      const id = s.patient?._id;
      if (!id) return;
      const a = (map[id] ||= { next: null, last: null, toWrite: 0 });
      const key = toDateKey(s.date);
      if (s.status === 'scheduled' && key >= today && (!a.next || key < toDateKey(a.next.date)))
        a.next = s;
      if (s.status === 'completed' && (!a.last || key > toDateKey(a.last.date))) a.last = s;
      if (needsNotes(s)) a.toWrite += 1;
    });
    return map;
  }, [data]);

  const all = data?.patients || [];
  const shown = all.filter((p) => {
    if (status !== 'all' && p.status !== status) return false;
    if (dept && !p.enrolledDepartments?.includes(dept)) return false;
    const q = search.trim().toLowerCase();
    return (
      !q ||
      [p.name, p.studentId, p.diagnosis, p.parentDetails?.name].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  });

  return (
    <>
      <PageHeader
        title={isTeacher ? 'Students' : 'Patients'}
        description={`The ${noun} on your caseload — open one for their history, family contact and to write notes`}
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              {
                value: 'active',
                label: 'Active',
                count: all.filter((p) => p.status === 'active').length,
              },
              { value: 'all', label: 'All', count: all.length },
            ]}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={`Search ${noun}…`}
            className="flex-1 min-w-[200px]"
          />
          {user.departments?.length > 1 && (
            <select
              className="select w-auto"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              aria-label="Therapy"
            >
              <option value="">All my therapies</option>
              {user.departments.map((d) => (
                <option key={d} value={d}>
                  {getDeptName(d)}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {loading ? (
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={Baby}
            title={all.length ? `No ${noun} match` : `No ${noun} assigned yet`}
            description={
              all.length
                ? 'Try a different search.'
                : `Your branch admin assigns ${noun} to you when they register them.`
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => {
            const a = activity[p._id] || {};
            return (
              <Card key={p._id} className="flex flex-col">
                <button
                  type="button"
                  className="text-left p-4 flex-1 hover:bg-surface-2 transition-colors rounded-t-[inherit]"
                  onClick={() => setOpen(p._id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={p.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-fg truncate-1">{p.name}</span>
                        {p.status !== 'active' && <PatientStatus status={p.status} />}
                      </div>
                      <div className="text-sm text-muted truncate-1">
                        {p.age} yrs{p.diagnosis ? ` · ${p.diagnosis}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <DeptChips depts={p.enrolledDepartments} max={3} />
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-fg-2">
                      <CalendarDays size={14} className="text-muted" />
                      {a.next ? (
                        `Next: ${formatRelativeDay(a.next.date)}, ${formatClock(slotStart(a.next.timeSlot))}`
                      ) : (
                        <span className="text-muted">No session booked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-fg-2">
                      <History size={14} className="text-muted" />
                      {a.last ? (
                        `Last seen ${formatDate(a.last.date, { day: 'numeric', month: 'short' })}`
                      ) : (
                        <span className="text-muted">Not seen yet</span>
                      )}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 px-4 py-2.5 border-t border-line">
                  {a.toWrite > 0 ? (
                    <Badge tone="amber" dot>
                      <NotebookPen size={12} /> {a.toWrite} to write
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted">Notes up to date</span>
                  )}
                  {p.status === 'active' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm ml-auto"
                      onClick={() => setBooking(p)}
                    >
                      <CalendarPlus size={14} /> Book
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {booking && (
        <BookSessionModal
          patient={booking}
          self={user}
          onClose={() => setBooking(null)}
          onBooked={reload}
        />
      )}
      {openId && (
        <PatientDrawer
          key={openId}
          patientId={openId}
          onClose={() => setOpen('')}
          onChanged={reload}
        />
      )}
    </>
  );
};

export default TherapistPatients;
