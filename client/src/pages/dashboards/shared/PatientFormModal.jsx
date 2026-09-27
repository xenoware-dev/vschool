import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, KeyRound, Link2, UserX, RefreshCw } from 'lucide-react';
import { Modal, ModalBody, Field, Alert, Avatar, cx, useToast } from '../../../components/ui';
import { patientsApi } from '../../../api/patients';
import { usersApi } from '../../../api/users';
import { DEPARTMENTS } from '../../../utils/constants';
import { toDateKey } from '../../../utils/format';
import { apiError, cleanName, deptList, COMMON_DIAGNOSES } from './helpers';

const STEPS = ['Child', 'Family', 'Care plan'];

const tempPassword = () => `abs${Math.random().toString(36).slice(2, 8)}`;

const ageOf = (dob) => {
  if (!dob) return null;
  const b = new Date(dob);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate()))
    a -= 1;
  return a;
};

const fromPatient = (p) => ({
  name: p?.name || '',
  studentId: p?.studentId || '',
  dateOfBirth: p?.dateOfBirth ? toDateKey(p.dateOfBirth) : '',
  gender: p?.gender || '',
  categories: p?.categories?.length ? p.categories : ['clinic'],
  grade: p?.schoolDetails?.grade || '',
  section: p?.schoolDetails?.section || '',
  rollNo: p?.schoolDetails?.rollNo || '',
  academicYear:
    p?.schoolDetails?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  diagnosis: p?.diagnosis || '',
  parentName: p?.parentDetails?.name || '',
  relationship: p?.parentDetails?.relationship || 'Mother',
  phone: p?.parentDetails?.phone || '',
  email: p?.parentDetails?.email || '',
  address: p?.parentDetails?.address || '',
  enrolledDepartments: p?.enrolledDepartments || [],
  assignedTherapists: (p?.assignedTherapists || []).map((t) => t._id || t),
  medicalNotes: p?.medicalNotes || '',
});

/** Register a new child (no `patient`) or edit an existing one. `startStep` jumps straight to a section. */
const PatientFormModal = ({ patient, startStep = 0, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = Boolean(patient);
  const [step, setStep] = useState(startStep);
  const [form, setForm] = useState(() => fromPatient(patient));
  const [therapists, setTherapists] = useState([]);
  const [parents, setParents] = useState([]);
  // Parent portal access: keep | create | link | none
  const [access, setAccess] = useState(patient?.parent ? 'keep' : 'create');
  const [portal, setPortal] = useState({
    email: patient?.parentDetails?.email || '',
    password: tempPassword(),
  });
  const [linkParentId, setLinkParentId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e?.target ? e.target.value : e }));

  useEffect(() => {
    Promise.all([usersApi.getTherapists(), usersApi.getAll({ role: 'parent' })])
      .then(([t, p]) => {
        setTherapists(t.data);
        setParents(p.data);
      })
      .catch((err) => setError(apiError(err, 'Could not load staff list')));
  }, []);

  // The portal email follows the contact email until someone edits it separately
  const lastContactEmail = useRef(form.email);
  useEffect(() => {
    const previous = lastContactEmail.current;
    lastContactEmail.current = form.email;
    setPortal((p) => (!p.email || p.email === previous ? { ...p, email: form.email } : p));
  }, [form.email]);

  const toggle = (field, value) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));

  // Therapists who deliver a selected therapy first
  const sortedTherapists = useMemo(
    () =>
      [...therapists].sort((a, b) => {
        const rel = (t) => t.departments?.some((d) => form.enrolledDepartments.includes(d));
        return Number(rel(b)) - Number(rel(a)) || a.name.localeCompare(b.name);
      }),
    [therapists, form.enrolledDepartments]
  );

  const validate = (s) => {
    if (s === 0) {
      if (!form.name.trim()) return 'Enter the child’s name';
      if (!form.dateOfBirth) return 'Enter the date of birth';
      if (!form.gender) return 'Select a gender';
      const age = ageOf(form.dateOfBirth);
      if (age < 0 || age > 25) return 'Check the date of birth';
      if (!form.categories.length) return 'Choose at least one programme';
    }
    if (s === 1) {
      if (!form.parentName.trim()) return 'Enter the parent or guardian’s name';
      if (!form.phone.trim()) return 'Enter a contact phone number';
      if (access === 'create') {
        if (!/^\S+@\S+\.\S+$/.test(portal.email))
          return 'Enter a valid email for the parent’s login';
        if (portal.password.length < 6) return 'The temporary password needs at least 6 characters';
      }
      if (access === 'link' && !linkParentId) return 'Choose the parent account to link';
    }
    if (s === 2 && !form.enrolledDepartments.length) return 'Select at least one therapy';
    return '';
  };

  const next = () => {
    const msg = validate(step);
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  };

  const goTo = (target) => {
    // Free navigation when editing; forward only through valid steps when registering
    if (isEdit || target < step) {
      setError('');
      setStep(target);
    } else if (target === step + 1) next();
  };

  const save = async () => {
    for (let s = 0; s < STEPS.length; s += 1) {
      const msg = validate(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      categories: form.categories,
      schoolDetails: form.categories.includes('school')
        ? {
            grade: form.grade,
            section: form.section,
            rollNo: form.rollNo,
            academicYear: form.academicYear,
          }
        : {},
      diagnosis: form.diagnosis.trim(),
      parentDetails: {
        name: form.parentName.trim(),
        relationship: form.relationship,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
      },
      enrolledDepartments: form.enrolledDepartments,
      assignedTherapists: form.assignedTherapists,
      medicalNotes: form.medicalNotes,
      ...(!isEdit && form.studentId.trim() && { studentId: form.studentId.trim() }),
      ...(access === 'create' && { parentAccount: portal }),
      ...(access === 'link' && { parent: linkParentId }),
      ...(access === 'none' && isEdit && { parent: null }),
    };
    try {
      const { data } = isEdit
        ? await patientsApi.update(patient._id, payload)
        : await patientsApi.create(payload);
      toast({
        title: isEdit ? 'Changes saved' : `${data.name} registered`,
        description:
          access === 'create'
            ? `Parent login: ${portal.email} / ${portal.password} — share this with the family`
            : isEdit
              ? undefined
              : `Student ID ${data.studentId}`,
        duration: access === 'create' ? 12000 : 4000,
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const age = ageOf(form.dateOfBirth);
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={isEdit ? `Edit ${patient.name}` : 'Register a child'}
      description={
        isEdit
          ? 'Update details, family contact or care plan'
          : 'Three short steps — you can edit everything later'
      }
      footer={
        <>
          {step > 0 && (
            <button type="button" className="btn btn-ghost mr-auto" onClick={() => goTo(step - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {isEdit || isLast ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Register child'}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={next}>
              Continue
            </button>
          )}
        </>
      }
    >
      <ModalBody className="space-y-5">
        <div className="stepper" role="tablist">
          {STEPS.map((label, i) => (
            <div key={label} className="contents">
              {i > 0 && <span className="step-line" />}
              <button
                type="button"
                role="tab"
                aria-selected={step === i}
                className={cx('step', step === i && 'is-active', step > i && !isEdit && 'is-done')}
                onClick={() => goTo(i)}
              >
                <span className="step-num">
                  {step > i && !isEdit ? <Check size={12} /> : i + 1}
                </span>
                {label}
              </button>
            </div>
          ))}
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        {step === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Child’s full name" htmlFor="pf-name">
                <input
                  id="pf-name"
                  className="input"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="e.g. Aarav Sharma"
                />
              </Field>
              <Field
                label="Student ID"
                htmlFor="pf-sid"
                optional
                hint={isEdit ? undefined : 'Generated if left blank'}
              >
                <input
                  id="pf-sid"
                  className="input"
                  value={form.studentId}
                  onChange={set('studentId')}
                  disabled={isEdit}
                  placeholder="Auto"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Date of birth"
                htmlFor="pf-dob"
                hint={age != null && age >= 0 ? `${age} years old` : undefined}
              >
                <input
                  id="pf-dob"
                  type="date"
                  className="input"
                  max={toDateKey()}
                  value={form.dateOfBirth}
                  onChange={set('dateOfBirth')}
                />
              </Field>
              <Field label="Gender">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['male', 'Boy'],
                    ['female', 'Girl'],
                    ['other', 'Other'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={cx(
                        'option-card justify-center',
                        form.gender === value && 'is-selected'
                      )}
                      onClick={() => set('gender')(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field
              label="Programme"
              hint="A child can attend both the special school and the therapy clinic"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['clinic', 'Therapy clinic', 'Individual therapy sessions'],
                  ['school', 'Special school', 'Classroom enrolment'],
                ].map(([value, label, sub]) => (
                  <button
                    key={value}
                    type="button"
                    className={cx('option-card', form.categories.includes(value) && 'is-selected')}
                    onClick={() => toggle('categories', value)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={form.categories.includes(value)}
                      tabIndex={-1}
                    />
                    <span>
                      <span className="block font-medium text-fg">{label}</span>
                      <span className="block text-xs text-muted">{sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
            {form.categories.includes('school') && (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 rounded-lg bg-surface-2 p-3">
                <Field label="Class / grade" htmlFor="pf-grade">
                  <input
                    id="pf-grade"
                    className="input"
                    value={form.grade}
                    onChange={set('grade')}
                    placeholder="Primary 1"
                  />
                </Field>
                <Field label="Section" htmlFor="pf-sec">
                  <input
                    id="pf-sec"
                    className="input"
                    value={form.section}
                    onChange={set('section')}
                    placeholder="A"
                  />
                </Field>
                <Field label="Roll no." htmlFor="pf-roll">
                  <input
                    id="pf-roll"
                    className="input"
                    value={form.rollNo}
                    onChange={set('rollNo')}
                  />
                </Field>
                <Field label="Academic year" htmlFor="pf-year">
                  <input
                    id="pf-year"
                    className="input"
                    value={form.academicYear}
                    onChange={set('academicYear')}
                  />
                </Field>
              </div>
            )}
            <Field label="Diagnosis / presenting concern" htmlFor="pf-dx" optional>
              <input
                id="pf-dx"
                className="input"
                list="pf-dx-list"
                value={form.diagnosis}
                onChange={set('diagnosis')}
                placeholder="Start typing or pick a common one"
              />
              <datalist id="pf-dx-list">
                {COMMON_DIAGNOSES.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label="Parent / guardian name" htmlFor="pf-pname">
                <input
                  id="pf-pname"
                  className="input"
                  value={form.parentName}
                  onChange={set('parentName')}
                />
              </Field>
              <Field label="Relationship" htmlFor="pf-rel">
                <select
                  id="pf-rel"
                  className="select"
                  value={form.relationship}
                  onChange={set('relationship')}
                >
                  {['Mother', 'Father', 'Guardian', 'Grandparent'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="pf-phone">
                <input
                  id="pf-phone"
                  type="tel"
                  className="input"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <Field label="Email" htmlFor="pf-email" optional>
                <input
                  id="pf-email"
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={set('email')}
                />
              </Field>
            </div>
            <Field label="Address" htmlFor="pf-addr" optional>
              <textarea
                id="pf-addr"
                className="textarea"
                rows={2}
                value={form.address}
                onChange={set('address')}
              />
            </Field>

            <div className="space-y-2">
              <div className="section-label">Parent portal access</div>
              <p className="text-sm text-muted">
                Parents use the portal to see upcoming sessions, shared notes, goals and home
                activities.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  isEdit &&
                    patient.parent && [
                      'keep',
                      KeyRound,
                      `Keep ${patient.parent.email}`,
                      'Current login stays linked',
                    ],
                  ['create', KeyRound, 'Create a new login', 'Email + temporary password'],
                  ['link', Link2, 'Link existing parent', 'e.g. a sibling is already enrolled'],
                  [
                    'none',
                    UserX,
                    isEdit && patient.parent ? 'Remove access' : 'Not now',
                    'You can add it later',
                  ],
                ]
                  .filter(Boolean)
                  .map(([value, Icon, label, sub]) => (
                    <button
                      key={value}
                      type="button"
                      className={cx('option-card', access === value && 'is-selected')}
                      onClick={() => setAccess(value)}
                    >
                      <Icon size={16} className="text-muted shrink-0" />
                      <span className="min-w-0">
                        <span className="block font-medium text-fg truncate-1">{label}</span>
                        <span className="block text-xs text-muted">{sub}</span>
                      </span>
                    </button>
                  ))}
              </div>
              {access === 'create' && (
                <div className="grid gap-4 sm:grid-cols-2 rounded-lg bg-surface-2 p-3">
                  <Field label="Login email" htmlFor="pf-pemail">
                    <input
                      id="pf-pemail"
                      type="email"
                      className="input"
                      value={portal.email}
                      onChange={(e) => setPortal((p) => ({ ...p, email: e.target.value }))}
                    />
                  </Field>
                  <Field
                    label="Temporary password"
                    htmlFor="pf-ppass"
                    hint="Shown once after saving — share it with the family"
                  >
                    <div className="flex gap-2">
                      <input
                        id="pf-ppass"
                        className="input font-mono flex-1 min-w-0"
                        value={portal.password}
                        onChange={(e) => setPortal((p) => ({ ...p, password: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon shrink-0"
                        onClick={() => setPortal((p) => ({ ...p, password: tempPassword() }))}
                        aria-label="Generate a new password"
                        title="Generate a new password"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </Field>
                </div>
              )}
              {access === 'link' && (
                <Field label="Parent account" htmlFor="pf-link">
                  <select
                    id="pf-link"
                    className="select"
                    value={linkParentId}
                    onChange={(e) => setLinkParentId(e.target.value)}
                  >
                    <option value="">Choose a parent…</option>
                    {parents.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} — {p.email}
                        {p.children?.length ? ` (${p.children.map((c) => c.name).join(', ')})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Field label="Therapies">
              <div className="grid gap-2 sm:grid-cols-2">
                {DEPARTMENTS.map((d) => {
                  const on = form.enrolledDepartments.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      className={cx('option-card', on && 'is-selected')}
                      onClick={() => toggle('enrolledDepartments', d.key)}
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
              label="Care team"
              hint="Therapists who can see this child and write session notes. Matching therapists are listed first."
            >
              {sortedTherapists.length === 0 ? (
                <div className="text-sm text-muted">No active therapists in this branch yet.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {sortedTherapists.map((t) => {
                    const on = form.assignedTherapists.includes(t._id);
                    const relevant = t.departments?.some((d) =>
                      form.enrolledDepartments.includes(d)
                    );
                    return (
                      <button
                        key={t._id}
                        type="button"
                        className={cx(
                          'option-card',
                          on && 'is-selected',
                          !relevant && !on && 'opacity-60'
                        )}
                        onClick={() => toggle('assignedTherapists', t._id)}
                      >
                        <input type="checkbox" readOnly checked={on} tabIndex={-1} />
                        <Avatar name={t.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-medium text-fg truncate-1">
                            {cleanName(t.name)}
                          </span>
                          <span className="block text-xs text-muted truncate-1">
                            {deptList(t.departments)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>
            <Field
              label="Intake notes"
              htmlFor="pf-notes"
              optional
              hint="Medical history, allergies, sensory triggers, school reports"
            >
              <textarea
                id="pf-notes"
                className="textarea"
                rows={3}
                value={form.medicalNotes}
                onChange={set('medicalNotes')}
              />
            </Field>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default PatientFormModal;
