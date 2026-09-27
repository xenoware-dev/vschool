import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, CalendarPlus, Baby, X, Users, KeyRound } from 'lucide-react';
import {
  PageHeader,
  Card,
  Tabs,
  SearchInput,
  PersonCell,
  DeptChips,
  PatientStatus,
  Avatar,
  EmptyState,
  SkeletonRows,
  Alert,
  Badge,
} from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { patientsApi } from '../../../api/patients';
import { DEPARTMENTS } from '../../../utils/constants';
import PatientFormModal from '../shared/PatientFormModal';
import PatientDrawer from '../shared/PatientDrawer';
import BookSessionModal from '../shared/BookSessionModal';
import { cleanName } from '../shared/helpers';

const SETUP_FILTERS = {
  'no-team': { label: 'No care team', icon: Users, test: (p) => !p.assignedTherapists?.length },
  'no-portal': { label: 'No parent login', icon: KeyRound, test: (p) => !p.parent },
};

const AdminPatients = () => {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('');
  const [dept, setDept] = useState('');
  const [modal, setModal] = useState(null); // 'register' | { book: patient }

  const openId = params.get('open');
  const setupFilter = SETUP_FILTERS[params.get('filter')] ? params.get('filter') : '';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const {
    data: patients,
    loading,
    error,
    reload,
  } = useApi(async () => (await patientsApi.getAll()).data);

  const counts = useMemo(() => {
    const c = { active: 0, on_hold: 0, discharged: 0, all: patients?.length || 0 };
    (patients || []).forEach((p) => (c[p.status] += 1));
    return c;
  }, [patients]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (patients || []).filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (program && !p.categories?.includes(program)) return false;
      if (dept && !p.enrolledDepartments?.includes(dept)) return false;
      if (setupFilter && !SETUP_FILTERS[setupFilter].test(p)) return false;
      if (!q) return true;
      return [p.name, p.studentId, p.parentDetails?.name, p.parentDetails?.phone, p.diagnosis]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [patients, status, program, dept, setupFilter, search]);

  const filtersOn = search || program || dept || setupFilter;
  const clearFilters = () => {
    setSearch('');
    setProgram('');
    setDept('');
    updateParam('filter', '');
  };

  return (
    <>
      <PageHeader
        title="Patients"
        description="Every child registered at your branch — profiles, care teams and family contacts"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal('register')}>
            <UserPlus size={16} /> Register child
          </button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        <div className="px-4 pt-3 border-b border-line">
          <Tabs
            value={status}
            onChange={setStatus}
            tabs={[
              { value: 'active', label: 'Active', count: counts.active },
              { value: 'on_hold', label: 'On hold', count: counts.on_hold },
              { value: 'discharged', label: 'Discharged', count: counts.discharged },
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, parent or phone…"
            className="flex-1 min-w-[220px]"
          />
          <select
            className="select w-auto"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            aria-label="Programme"
          >
            <option value="">All programmes</option>
            <option value="clinic">Therapy clinic</option>
            <option value="school">Special school</option>
          </select>
          <select
            className="select w-auto"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label="Therapy"
          >
            <option value="">All therapies</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
          {Object.entries(SETUP_FILTERS).map(([key, f]) => (
            <button
              key={key}
              type="button"
              className={`btn btn-sm ${setupFilter === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => updateParam('filter', setupFilter === key ? '' : key)}
            >
              <f.icon size={14} /> {f.label}
            </button>
          ))}
          {filtersOn && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
              <X size={14} /> Clear
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Baby}
            title={filtersOn ? 'No children match' : 'No children here yet'}
            description={
              filtersOn
                ? 'Try a different search or clear the filters.'
                : 'Register a child to get started.'
            }
            action={
              filtersOn ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setModal('register')}
                >
                  <UserPlus size={15} /> Register child
                </button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Child</th>
                  <th>Therapies</th>
                  <th>Care team</th>
                  <th>Parent</th>
                  <th>Status</th>
                  <th className="col-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p._id} className="row-link" onClick={() => updateParam('open', p._id)}>
                    <td>
                      <PersonCell
                        name={p.name}
                        sub={[
                          p.studentId,
                          `${p.age} yrs`,
                          p.categories?.includes('school') && 'School',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                    </td>
                    <td>
                      <DeptChips depts={p.enrolledDepartments} max={2} />
                    </td>
                    <td>
                      {p.assignedTherapists?.length ? (
                        <div
                          className="flex items-center"
                          title={p.assignedTherapists.map((t) => cleanName(t.name)).join(', ')}
                        >
                          {p.assignedTherapists.slice(0, 3).map((t, i) => (
                            <span
                              key={t._id}
                              className={i ? '-ml-1.5' : ''}
                              style={{ boxShadow: '0 0 0 2px var(--surface)', borderRadius: 99 }}
                            >
                              <Avatar name={t.name} size="sm" />
                            </span>
                          ))}
                          {p.assignedTherapists.length > 3 && (
                            <span className="text-xs text-muted ml-1.5">
                              +{p.assignedTherapists.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge tone="red">Not assigned</Badge>
                      )}
                    </td>
                    <td>
                      <div className="text-sm text-fg truncate-1">
                        {p.parentDetails?.name || '—'}
                      </div>
                      <div className="text-xs text-muted flex items-center gap-1">
                        {p.parentDetails?.phone}
                        {!p.parent && <span title="No parent login">· no login</span>}
                      </div>
                    </td>
                    <td>
                      <PatientStatus status={p.status} />
                    </td>
                    <td className="col-right">
                      {p.status === 'active' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ book: p });
                          }}
                        >
                          <CalendarPlus size={14} /> Book
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && shown.length > 0 && (
          <div className="px-4 py-2.5 text-xs text-muted border-t border-line">
            Showing {shown.length} of {counts.all}
          </div>
        )}
      </Card>

      {modal === 'register' && (
        <PatientFormModal
          onClose={() => setModal(null)}
          onSaved={(p) => {
            reload();
            updateParam('open', p._id);
          }}
        />
      )}
      {modal?.book && (
        <BookSessionModal patient={modal.book} onClose={() => setModal(null)} onBooked={reload} />
      )}
      {openId && (
        <PatientDrawer
          key={openId}
          patientId={openId}
          onClose={() => updateParam('open', '')}
          onChanged={reload}
        />
      )}
    </>
  );
};

export default AdminPatients;
