import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Power,
  MapPin,
  Phone,
  Mail,
  Building2,
  Baby,
  Users,
  CalendarDays,
  Wallet,
  UserPlus,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  Modal,
  ModalBody,
  Drawer,
  Field,
  Alert,
  Badge,
  DeptChips,
  PersonCell,
  EmptyState,
  SkeletonRows,
  cx,
  useToast,
  useConfirm,
} from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { branchApi } from '../../../api/branches';
import { usersApi } from '../../../api/users';
import { DEPARTMENTS, ROLES } from '../../../utils/constants';
import { formatCurrency } from '../../../utils/format';
import { StaffFormModal } from '../shared/StaffFormModal';
import { apiError, cleanName, deptList } from '../shared/helpers';

const BranchFormModal = ({ branch, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = Boolean(branch);
  const [form, setForm] = useState({
    name: branch?.name || '',
    code: branch?.code || '',
    city: branch?.city || '',
    address: branch?.address || '',
    phone: branch?.phone || '',
    email: branch?.email || '',
    facilities: branch?.facilities || ['school', 'clinic'],
    departments: branch?.departments || DEPARTMENTS.map((d) => d.key),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (k, v) =>
    setForm((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim())
      return setError('Branch name and code are required');
    if (!form.facilities.length) return setError('Choose at least one facility');
    setSaving(true);
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase() };
      const { data } = isEdit
        ? await branchApi.update(branch._id, payload)
        : await branchApi.create(payload);
      toast({
        title: isEdit ? 'Branch updated' : `${data.name} created`,
        description: isEdit ? undefined : 'Next, add a branch admin',
      });
      onSaved(data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      title={isEdit ? `Edit ${branch.name}` : 'New branch'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="branch-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create branch'}
          </button>
        </>
      }
    >
      <ModalBody>
        <form id="branch-form" onSubmit={save} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Branch name" htmlFor="bf-name">
              <input
                id="bf-name"
                className="input"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Tambaram Branch"
              />
            </Field>
            <Field label="Code" htmlFor="bf-code" hint="Used in student IDs and receipts">
              <input
                id="bf-code"
                className="input font-mono uppercase"
                value={form.code}
                onChange={set('code')}
                placeholder="BR006"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="bf-city">
              <input id="bf-city" className="input" value={form.city} onChange={set('city')} />
            </Field>
            <Field label="Phone" htmlFor="bf-phone" optional>
              <input
                id="bf-phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={set('phone')}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Address" htmlFor="bf-addr" optional>
              <input
                id="bf-addr"
                className="input"
                value={form.address}
                onChange={set('address')}
              />
            </Field>
            <Field label="Email" htmlFor="bf-email" optional>
              <input
                id="bf-email"
                type="email"
                className="input"
                value={form.email}
                onChange={set('email')}
              />
            </Field>
          </div>
          <Field label="Facilities">
            <div className="grid gap-2 grid-cols-2">
              {[
                ['clinic', 'Therapy clinic'],
                ['school', 'Special school'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  className={cx('option-card', form.facilities.includes(v) && 'is-selected')}
                  onClick={() => toggle('facilities', v)}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={form.facilities.includes(v)}
                    tabIndex={-1}
                  />
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Therapies offered (${form.departments.length})`}>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEPARTMENTS.map((d) => {
                const on = form.departments.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={cx('option-card', on && 'is-selected')}
                    onClick={() => toggle('departments', d.key)}
                  >
                    <input type="checkbox" readOnly checked={on} tabIndex={-1} />
                    <span className="chip-dot" style={{ background: d.color }} />
                    <span className="truncate-1">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        </form>
      </ModalBody>
    </Modal>
  );
};

const BranchDrawer = ({ row, branches, onClose, onEdit, onToggle, onChanged }) => {
  const { branch } = row;
  const [adding, setAdding] = useState(false);
  const {
    data: staff,
    loading,
    reload,
  } = useApi(
    async () =>
      (await usersApi.getAll({ branch: branch._id, role: 'admin,therapist,teacher' })).data,
    [branch._id]
  );
  const admins = (staff || []).filter((u) => u.role === 'admin');

  return (
    <>
      <Drawer
        onClose={onClose}
        width={560}
        header={
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-fg">{branch.name}</h2>
              {branch.isActive ? (
                <Badge tone="green" dot>
                  Active
                </Badge>
              ) : (
                <Badge tone="gray" dot>
                  Inactive
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted">
              <span className="mono-tag">{branch.code}</span> {branch.city}
            </div>
          </div>
        }
        footer={
          <>
            <button type="button" className="btn btn-ghost mr-auto" onClick={onToggle}>
              <Power size={15} /> {branch.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              <Pencil size={15} /> Edit branch
            </button>
          </>
        }
      >
        <div className="drawer-body space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              [Baby, 'Active children', row.activePatients],
              [Users, 'Therapists & teachers', row.clinicians],
              [CalendarDays, 'Sessions today', `${row.todayCompleted}/${row.todaySessions}`],
              [Wallet, 'Fees this month', formatCurrency(row.monthRevenue)],
            ].map(([Icon, label, value]) => (
              <div key={label} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Icon size={13} /> {label}
                </div>
                <div className="text-lg font-semibold text-fg tnum mt-0.5">{value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-1.5 text-sm text-fg-2">
            {branch.address && (
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-muted" /> {branch.address}
              </div>
            )}
            {branch.phone && (
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-muted" /> {branch.phone}
              </div>
            )}
            {branch.email && (
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-muted" /> {branch.email}
              </div>
            )}
          </section>

          <section>
            <div className="section-label mb-2">Therapies offered</div>
            <DeptChips depts={branch.departments} max={10} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <div className="section-label">Staff</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAdding(true)}
              >
                <UserPlus size={14} /> Add
              </button>
            </div>
            {!loading && admins.length === 0 && (
              <Alert tone="warning" className="mb-3">
                This branch has no admin — nobody can register children or book sessions there yet.
              </Alert>
            )}
            {loading ? (
              <SkeletonRows rows={3} />
            ) : staff.length === 0 ? (
              <div className="text-sm text-muted">No staff yet.</div>
            ) : (
              <div className="card">
                {staff.map((u) => (
                  <div key={u._id} className={cx('list-row', !u.isActive && 'opacity-60')}>
                    <PersonCell
                      name={cleanName(u.name)}
                      sub={u.role === 'admin' ? u.email : deptList(u.departments)}
                      size="sm"
                    />
                    <Badge tone={ROLES[u.role]?.tone} className="ml-auto">
                      {ROLES[u.role]?.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Drawer>
      {adding && (
        <StaffFormModal
          roles={
            admins.length ? ['therapist', 'teacher', 'admin'] : ['admin', 'therapist', 'teacher']
          }
          branches={branches}
          defaultBranch={branch._id}
          onClose={() => setAdding(false)}
          onSaved={() => {
            reload();
            onChanged();
          }}
        />
      )}
    </>
  );
};

const OwnerBranches = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const {
    data: rows,
    loading,
    error,
    reload,
  } = useApi(async () => (await branchApi.getOverview()).data);

  const setParam = (key, value) => {
    const next = new URLSearchParams();
    if (value) next.set(key, value);
    setParams(next, { replace: true });
  };
  const openRow = rows?.find((r) => r.branch._id === params.get('open'));
  const adding = params.get('add') === '1';

  const toggle = async (branch) => {
    if (branch.isActive) {
      const ok = await confirm({
        title: `Deactivate ${branch.name}?`,
        description:
          'Staff and parents at this branch will not be able to sign in until it is reactivated. No data is deleted.',
        confirmLabel: 'Deactivate branch',
        tone: 'danger',
      });
      if (!ok) return;
    }
    try {
      const { data } = await branchApi.toggle(branch._id);
      toast({ title: data.message });
      reload();
    } catch (err) {
      toast({ title: 'Could not update branch', description: apiError(err), tone: 'error' });
    }
  };

  return (
    <>
      <PageHeader
        title="Branches"
        description="Your centres, what each one offers, and who runs it"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setParam('add', '1')}>
            <Plus size={16} /> New branch
          </button>
        }
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      ) : !rows?.length ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No branches yet"
            description="Create your first centre to get started."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <button
              key={r.branch._id}
              type="button"
              className={cx(
                'card text-left p-4 hover:shadow-md transition-shadow flex flex-col gap-3',
                !r.branch.isActive && 'opacity-60'
              )}
              onClick={() => setParam('open', r.branch._id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-fg truncate-1">{r.branch.name}</div>
                  <div className="text-sm text-muted">
                    <span className="mono-tag">{r.branch.code}</span> {r.branch.city}
                  </div>
                </div>
                {r.branch.isActive ? (
                  <Badge tone="green" dot>
                    Active
                  </Badge>
                ) : (
                  <Badge tone="gray" dot>
                    Inactive
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['Children', r.activePatients],
                  ['Therapists', r.clinicians],
                  ['Today', r.todaySessions],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-surface-2 py-2">
                    <div className="text-lg font-semibold text-fg tnum">{value}</div>
                    <div className="text-xs text-muted">{label}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{r.branch.departments?.length || 0} therapies</span>
                {r.admins === 0 ? (
                  <Badge tone="amber">No admin</Badge>
                ) : (
                  <span className="text-fg-2">{formatCurrency(r.monthRevenue)} this month</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {openRow && (
        <BranchDrawer
          key={openRow.branch._id}
          row={openRow}
          branches={rows.map((r) => r.branch)}
          onClose={() => setParam('open', '')}
          onEdit={() => setEditing(openRow.branch)}
          onToggle={() => toggle(openRow.branch)}
          onChanged={reload}
        />
      )}
      {(adding || editing) && (
        <BranchFormModal
          branch={editing}
          onClose={() => {
            setEditing(null);
            if (adding) setParam('add', '');
          }}
          onSaved={(b) => {
            setEditing(null);
            reload();
            setParam('open', b._id);
          }}
        />
      )}
    </>
  );
};

export default OwnerBranches;
