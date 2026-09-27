import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Modal, ModalBody, Field, Alert, cx, useToast } from '../../../components/ui';
import { usersApi } from '../../../api/users';
import { DEPARTMENTS, ROLES } from '../../../utils/constants';
import { apiError } from './helpers';

const tempPassword = () => `abs${Math.random().toString(36).slice(2, 8)}`;

const CLINICAL = ['therapist', 'teacher'];

/**
 * Create or edit a staff account.
 * `roles` = roles the current user may assign; `branches` given → owner can pick a branch.
 */
export const StaffFormModal = ({ member, roles, branches, defaultBranch, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = Boolean(member);
  const [form, setForm] = useState({
    name: member?.name || '',
    email: member?.email || '',
    phone: member?.phone || '',
    role: member?.role || roles[0],
    branch: member?.branch?._id || defaultBranch || branches?.[0]?._id || '',
    departments: member?.departments || [],
    sessionRate: member?.sessionRate ?? 650,
    password: tempPassword(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));
  const isClinical = CLINICAL.includes(form.role);

  const toggleDept = (key) =>
    setForm((f) => ({
      ...f,
      departments: f.departments.includes(key)
        ? f.departments.filter((d) => d !== key)
        : [...f.departments, key],
    }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Enter a name');
    if (!/^\S+@\S+\.\S+$/.test(form.email))
      return setError('Enter a valid email — it is their login');
    if (!isEdit && form.password.length < 6)
      return setError('The temporary password needs at least 6 characters');
    if (isClinical && !form.departments.length)
      return setError('Pick at least one therapy they deliver');
    if (branches && form.role !== 'parent' && !form.branch) return setError('Choose a branch');

    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      role: form.role,
      departments: isClinical ? form.departments : [],
      ...(isClinical && { sessionRate: Number(form.sessionRate) || 0 }),
      ...(branches && { branch: form.branch }),
      ...(!isEdit && { password: form.password }),
    };
    try {
      const { data } = isEdit
        ? await usersApi.update(member._id, payload)
        : await usersApi.create(payload);
      toast({
        title: isEdit ? 'Changes saved' : `${data.name} added`,
        description: isEdit
          ? undefined
          : `Login: ${data.email} / ${form.password} — share this with them`,
        duration: isEdit ? 4000 : 12000,
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={isEdit ? `Edit ${member.name}` : 'Add staff member'}
      description={
        isEdit ? undefined : 'They sign in with their email and the temporary password below'
      }
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="staff-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create account'}
          </button>
        </>
      }
    >
      <ModalBody>
        <form id="staff-form" onSubmit={save} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          {roles.length > 1 && (
            <Field label="Role">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))` }}
              >
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={cx('option-card justify-center', form.role === r && 'is-selected')}
                    onClick={() => set('role')(r)}
                  >
                    {ROLES[r]?.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="sf-name">
              <input
                id="sf-name"
                className="input"
                value={form.name}
                onChange={set('name')}
                placeholder="e.g. Pooja Menon"
              />
            </Field>
            <Field label="Phone" htmlFor="sf-phone" optional>
              <input
                id="sf-phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={set('phone')}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email (login)" htmlFor="sf-email">
              <input
                id="sf-email"
                type="email"
                className="input"
                value={form.email}
                onChange={set('email')}
              />
            </Field>
            {!isEdit ? (
              <Field label="Temporary password" htmlFor="sf-pass">
                <div className="flex gap-2">
                  <input
                    id="sf-pass"
                    className="input font-mono flex-1 min-w-0"
                    value={form.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon shrink-0"
                    onClick={() => set('password')(tempPassword())}
                    aria-label="Generate a new password"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </Field>
            ) : (
              branches && (
                <Field label="Branch" htmlFor="sf-branch">
                  <select
                    id="sf-branch"
                    className="select"
                    value={form.branch}
                    onChange={set('branch')}
                  >
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )
            )}
          </div>

          {!isEdit && branches && (
            <Field label="Branch" htmlFor="sf-branch">
              <select
                id="sf-branch"
                className="select"
                value={form.branch}
                onChange={set('branch')}
              >
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {isClinical && (
            <>
              <Field label="Therapies they deliver">
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEPARTMENTS.map((d) => {
                    const on = form.departments.includes(d.key);
                    return (
                      <button
                        key={d.key}
                        type="button"
                        className={cx('option-card', on && 'is-selected')}
                        onClick={() => toggleDept(d.key)}
                      >
                        <input type="checkbox" readOnly checked={on} tabIndex={-1} />
                        <span className="chip-dot" style={{ background: d.color }} />
                        <span className="truncate-1">{d.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field
                label="Pay per completed session"
                htmlFor="sf-rate"
                hint="Used to calculate monthly payroll"
              >
                <div className="input-wrap w-44">
                  <span className="input-icon text-muted">₹</span>
                  <input
                    id="sf-rate"
                    type="number"
                    min="0"
                    step="50"
                    className="input"
                    value={form.sessionRate}
                    onChange={set('sessionRate')}
                  />
                </div>
              </Field>
            </>
          )}
        </form>
      </ModalBody>
    </Modal>
  );
};

export const ResetPasswordModal = ({ member, onClose }) => {
  const toast = useToast();
  const [password, setPassword] = useState(tempPassword());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (password.length < 6) return setError('Use at least 6 characters');
    setSaving(true);
    try {
      await usersApi.resetPassword(member._id, password);
      toast({
        title: 'Password reset',
        description: `${member.email} / ${password} — share this with them`,
        duration: 12000,
      });
      onClose();
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Reset password"
      description={`Set a new temporary password for ${member.name}`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="reset-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Resetting…' : 'Reset password'}
          </button>
        </>
      }
    >
      <ModalBody>
        <form id="reset-form" onSubmit={save} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="New password" htmlFor="rp-pass">
            <div className="flex gap-2">
              <input
                id="rp-pass"
                className="input font-mono flex-1 min-w-0"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon shrink-0"
                onClick={() => setPassword(tempPassword())}
                aria-label="Generate a new password"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </Field>
        </form>
      </ModalBody>
    </Modal>
  );
};
