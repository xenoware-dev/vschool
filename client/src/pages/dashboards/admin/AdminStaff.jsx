import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { UserPlus, MoreHorizontal, Pencil, KeyRound, Power, Users, Phone } from 'lucide-react';
import {
  PageHeader,
  Card,
  Tabs,
  SearchInput,
  PersonCell,
  DeptChips,
  Badge,
  Menu,
  EmptyState,
  SkeletonRows,
  Alert,
  useToast,
  useConfirm,
} from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { usersApi } from '../../../api/users';
import { patientsApi } from '../../../api/patients';
import { ROLES } from '../../../utils/constants';
import { formatCurrency } from '../../../utils/format';
import { StaffFormModal, ResetPasswordModal } from '../shared/StaffFormModal';
import { apiError, cleanName } from '../shared/helpers';

const AdminStaff = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('team');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null);
  const [params, setParams] = useSearchParams();

  // ?add=1 (e.g. from the command palette) opens the add form, then clears itself
  useEffect(() => {
    if (params.get('add') !== '1') return;
    setModal({ type: 'add' });
    const next = new URLSearchParams(params);
    next.delete('add');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const { data, loading, error, reload } = useApi(async () => {
    const [users, patients] = await Promise.all([
      usersApi.getAll(),
      patientsApi.getAll({ status: 'active' }),
    ]);
    return { users: users.data, patients: patients.data };
  });

  const caseload = useMemo(() => {
    const c = {};
    (data?.patients || []).forEach((p) =>
      p.assignedTherapists?.forEach((t) => (c[t._id] = (c[t._id] || 0) + 1))
    );
    return c;
  }, [data]);

  const team = (data?.users || []).filter((u) => ['therapist', 'teacher'].includes(u.role));
  const parents = (data?.users || []).filter((u) => u.role === 'parent');
  const list = (tab === 'team' ? team : parents).filter((u) => {
    if (!showInactive && !u.isActive) return false;
    const q = search.trim().toLowerCase();
    return (
      !q ||
      [u.name, u.email, u.phone, ...(u.children || []).map((c) => c.name)].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  });
  const inactiveCount = (tab === 'team' ? team : parents).filter((u) => !u.isActive).length;

  const toggleActive = async (u) => {
    if (u.isActive) {
      const ok = await confirm({
        title: `Deactivate ${cleanName(u.name)}?`,
        description:
          u.role === 'parent'
            ? 'They will no longer be able to sign in to the parent portal.'
            : 'They will not be able to sign in, and won’t appear when booking sessions. Their past sessions and notes are kept.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      const { data: res } = await usersApi.toggle(u._id);
      toast({ title: res.message });
      reload();
    } catch (err) {
      toast({ title: 'Could not update account', description: apiError(err), tone: 'error' });
    }
  };

  const actions = (u) =>
    [
      u.role !== 'parent' && {
        label: 'Edit details',
        icon: Pencil,
        onClick: () => setModal({ type: 'edit', member: u }),
      },
      {
        label: 'Reset password',
        icon: KeyRound,
        onClick: () => setModal({ type: 'reset', member: u }),
      },
      'separator',
      {
        label: u.isActive ? 'Deactivate' : 'Reactivate',
        icon: Power,
        danger: u.isActive,
        onClick: () => toggleActive(u),
      },
    ].filter(Boolean);

  return (
    <>
      <PageHeader
        title="Staff"
        description="Therapists, teachers and parent logins for your branch"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: 'add' })}
          >
            <UserPlus size={16} /> Add therapist or teacher
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
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: 'team',
                label: 'Therapists & teachers',
                count: team.filter((u) => u.isActive).length,
              },
              {
                value: 'parents',
                label: 'Parent logins',
                count: parents.filter((u) => u.isActive).length,
              },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 p-3 border-b border-line">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === 'team' ? 'Search name, email or phone…' : 'Search parent or child name…'
            }
            className="flex-1 min-w-[220px]"
          />
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show {inactiveCount} inactive
            </label>
          )}
        </div>

        {tab === 'parents' && (
          <div className="px-4 py-2.5 text-sm text-muted border-b border-line">
            Parent logins are created when you register a child or from a child’s Family tab on the{' '}
            <Link to="/dashboard/patients" className="text-primary font-medium">
              Patients
            </Link>{' '}
            page.
          </div>
        )}

        {loading ? (
          <SkeletonRows rows={5} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search
                ? 'No one matches'
                : tab === 'team'
                  ? 'No therapists yet'
                  : 'No parent logins yet'
            }
            description={
              search
                ? 'Try a different search.'
                : tab === 'team'
                  ? 'Add your first therapist or teacher.'
                  : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                {tab === 'team' ? (
                  <tr>
                    <th>Name</th>
                    <th>Therapies</th>
                    <th>Caseload</th>
                    <th>Pay / session</th>
                    <th>Status</th>
                    <th className="col-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                ) : (
                  <tr>
                    <th>Parent</th>
                    <th>Children</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th className="col-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                )}
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u._id} className={u.isActive ? '' : 'opacity-60'}>
                    <td>
                      <PersonCell name={cleanName(u.name)} sub={u.email}>
                        {tab === 'team' && (
                          <Badge tone={ROLES[u.role]?.tone}>
                            {u.role === 'teacher' ? 'Teacher' : 'Therapist'}
                          </Badge>
                        )}
                      </PersonCell>
                    </td>
                    {tab === 'team' ? (
                      <>
                        <td>
                          <DeptChips depts={u.departments} max={2} />
                        </td>
                        <td className="tnum">{caseload[u._id] || 0} children</td>
                        <td className="tnum">{formatCurrency(u.sessionRate)}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          {u.children?.length ? (
                            <div className="flex flex-wrap gap-1">
                              {u.children.map((c) => (
                                <Link
                                  key={c._id}
                                  to={`/dashboard/patients?open=${c._id}`}
                                  className="chip hover:border-primary"
                                >
                                  {c.name}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">No linked child</span>
                          )}
                        </td>
                        <td>
                          {u.phone ? (
                            <a
                              href={`tel:${u.phone}`}
                              className="inline-flex items-center gap-1.5 text-fg-2 hover:text-primary"
                            >
                              <Phone size={13} /> {u.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}
                    <td>
                      {u.isActive ? (
                        <Badge tone="green" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="gray" dot>
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="col-right">
                      <Menu
                        trigger={
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon btn-sm"
                            aria-label={`Actions for ${u.name}`}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        }
                        items={actions(u)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <StaffFormModal
          member={modal.member}
          roles={['therapist', 'teacher']}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal member={modal.member} onClose={() => setModal(null)} />
      )}
    </>
  );
};

export default AdminStaff;
