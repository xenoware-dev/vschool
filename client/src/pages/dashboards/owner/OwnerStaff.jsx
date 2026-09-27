import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserPlus, MoreHorizontal, Pencil, KeyRound, Power, Users } from 'lucide-react';
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
import { branchApi } from '../../../api/branches';
import { ROLES } from '../../../utils/constants';
import { StaffFormModal, ResetPasswordModal } from '../shared/StaffFormModal';
import { apiError, cleanName } from '../shared/helpers';

const STAFF_ROLES = ['admin', 'therapist', 'teacher'];

const OwnerStaff = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [role, setRole] = useState('all');
  const [branch, setBranch] = useState('');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null);

  const { data, loading, error, reload } = useApi(async () => {
    const [users, branches] = await Promise.all([
      usersApi.getAll({ role: STAFF_ROLES.join(',') }),
      branchApi.getAll(),
    ]);
    return { users: users.data, branches: branches.data };
  });

  const staff = useMemo(() => data?.users || [], [data]);
  const counts = useMemo(() => {
    const c = { all: 0 };
    staff
      .filter((u) => u.isActive)
      .forEach((u) => {
        c.all += 1;
        c[u.role] = (c[u.role] || 0) + 1;
      });
    return c;
  }, [staff]);

  const list = staff.filter((u) => {
    if (!showInactive && !u.isActive) return false;
    if (role !== 'all' && u.role !== role) return false;
    if (branch && u.branch?._id !== branch) return false;
    const q = search.trim().toLowerCase();
    return !q || [u.name, u.email, u.phone].some((v) => v?.toLowerCase().includes(q));
  });
  const inactive = staff.filter((u) => !u.isActive).length;

  const addOpen = params.get('add') === '1' || modal?.type === 'add';
  const closeAdd = () => {
    setModal(null);
    if (params.get('add')) setParams({}, { replace: true });
  };

  const toggleActive = async (u) => {
    if (u.isActive) {
      const ok = await confirm({
        title: `Deactivate ${cleanName(u.name)}?`,
        description:
          'They will no longer be able to sign in. Their records and session notes are kept.',
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

  return (
    <>
      <PageHeader
        title="Staff"
        description="Branch admins, therapists and teachers across the network"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: 'add' })}
          >
            <UserPlus size={16} /> Add staff
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
            value={role}
            onChange={setRole}
            tabs={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'admin', label: 'Admins', count: counts.admin || 0 },
              { value: 'therapist', label: 'Therapists', count: counts.therapist || 0 },
              { value: 'teacher', label: 'Teachers', count: counts.teacher || 0 },
            ]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 p-3 border-b border-line">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, email or phone…"
            className="flex-1 min-w-[220px]"
          />
          <select
            className="select w-auto"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            aria-label="Branch"
          >
            <option value="">All branches</option>
            {(data?.branches || []).map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          {inactive > 0 && (
            <label className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show {inactive} inactive
            </label>
          )}
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No staff match"
            description="Try another filter, or add a staff member."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Therapies</th>
                  <th>Status</th>
                  <th className="col-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u._id} className={u.isActive ? '' : 'opacity-60'}>
                    <td>
                      <PersonCell name={cleanName(u.name)} sub={u.email} />
                    </td>
                    <td>
                      <Badge tone={ROLES[u.role]?.tone}>{ROLES[u.role]?.label}</Badge>
                    </td>
                    <td className="text-sm text-fg-2">
                      {u.branch?.name || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {u.departments?.length ? (
                        <DeptChips depts={u.departments} max={2} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
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
                        items={[
                          {
                            label: 'Edit / move branch',
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
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {addOpen && data && (
        <StaffFormModal
          roles={STAFF_ROLES}
          branches={data.branches}
          defaultBranch={branch}
          onClose={closeAdd}
          onSaved={reload}
        />
      )}
      {modal?.type === 'edit' && (
        <StaffFormModal
          member={modal.member}
          roles={modal.member.role === 'admin' ? ['admin'] : ['therapist', 'teacher']}
          branches={data.branches}
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

export default OwnerStaff;
