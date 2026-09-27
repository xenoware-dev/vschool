import { useMemo, useState } from 'react';
import {
  Plus,
  Receipt,
  Printer,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  Banknote,
  HandCoins,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Tabs,
  Segmented,
  SearchInput,
  Modal,
  ModalBody,
  Field,
  Alert,
  Badge,
  PersonCell,
  EmptyState,
  SkeletonRows,
  useToast,
  useConfirm,
} from '../../../components/ui';
import { useApi } from '../../../hooks/useApi';
import { useAuth } from '../../../context/AuthContext';
import { billingApi } from '../../../api/billing';
import { patientsApi } from '../../../api/patients';
import { DEPARTMENTS, getDeptName } from '../../../utils/constants';
import { formatCurrency, formatDate, toDateKey, addDays } from '../../../utils/format';
import {
  apiError,
  cleanName,
  currentPeriod,
  shiftPeriod,
  formatPeriod,
  PAYMENT_METHODS,
  deptList,
} from '../shared/helpers';

const DESCRIPTIONS = [
  'Therapy — monthly package',
  'Assessment fee',
  'Special school — term fee',
  'Registration fee',
];

const PaymentModal = ({ patients, onClose, onSaved }) => {
  const toast = useToast();
  const [form, setForm] = useState({
    patient: '',
    department: '',
    description: DESCRIPTIONS[0],
    amount: '',
    status: 'paid',
    method: 'upi',
    dueDate: addDays(toDateKey(), 7),
    reference: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const child = patients.find((p) => p._id === form.patient);

  const save = async (e) => {
    e.preventDefault();
    if (!form.patient) return setError('Choose the child');
    if (!(Number(form.amount) > 0)) return setError('Enter the amount');
    setSaving(true);
    try {
      const { data } = await billingApi.createPayment({
        ...form,
        amount: Number(form.amount),
        department: form.department || undefined,
      });
      toast({
        title: form.status === 'paid' ? 'Payment recorded' : 'Invoice created',
        description: `${data.receiptNo} · ${formatCurrency(data.amount)}`,
      });
      onSaved(data);
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Record a fee"
      description="Log money received, or raise an invoice to collect later"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="pay-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : form.status === 'paid' ? 'Record payment' : 'Create invoice'}
          </button>
        </>
      }
    >
      <ModalBody>
        <form id="pay-form" className="space-y-4" onSubmit={save}>
          {error && <Alert tone="danger">{error}</Alert>}
          <Segmented
            value={form.status}
            onChange={set('status')}
            options={[
              { value: 'paid', label: 'Paid now' },
              { value: 'pending', label: 'Invoice — pay later' },
            ]}
          />
          <Field label="Child" htmlFor="pay-child">
            <select
              id="pay-child"
              className="select"
              value={form.patient}
              onChange={set('patient')}
            >
              <option value="">Choose a child…</option>
              {patients.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.studentId ? `(${p.studentId})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="For" htmlFor="pay-desc">
              <input
                id="pay-desc"
                className="input"
                list="pay-desc-list"
                value={form.description}
                onChange={set('description')}
              />
              <datalist id="pay-desc-list">
                {DESCRIPTIONS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field label="Therapy" htmlFor="pay-dept" optional>
              <select
                id="pay-dept"
                className="select"
                value={form.department}
                onChange={set('department')}
              >
                <option value="">—</option>
                {(child?.enrolledDepartments?.length
                  ? child.enrolledDepartments
                  : DEPARTMENTS.map((d) => d.key)
                ).map((k) => (
                  <option key={k} value={k}>
                    {getDeptName(k)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount" htmlFor="pay-amt">
              <div className="input-wrap">
                <span className="input-icon text-muted">₹</span>
                <input
                  id="pay-amt"
                  type="number"
                  min="1"
                  className="input"
                  value={form.amount}
                  onChange={set('amount')}
                  placeholder="0"
                />
              </div>
            </Field>
            {form.status === 'paid' ? (
              <Field label="Paid by" htmlFor="pay-method">
                <select
                  id="pay-method"
                  className="select"
                  value={form.method}
                  onChange={set('method')}
                >
                  {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Due by" htmlFor="pay-due">
                <input
                  id="pay-due"
                  type="date"
                  className="input"
                  value={form.dueDate}
                  onChange={set('dueDate')}
                />
              </Field>
            )}
          </div>
          {form.status === 'paid' && form.method !== 'cash' && (
            <Field label="Transaction reference" htmlFor="pay-ref" optional>
              <input
                id="pay-ref"
                className="input"
                value={form.reference}
                onChange={set('reference')}
                placeholder="UPI / bank ref"
              />
            </Field>
          )}
        </form>
      </ModalBody>
    </Modal>
  );
};

const ReceiptModal = ({ payment, branch, onClose }) => {
  const print = () => {
    document.body.classList.add('is-printing-receipt');
    window.print();
    document.body.classList.remove('is-printing-receipt');
  };
  const paid = payment.status === 'paid';
  return (
    <Modal
      title={paid ? 'Receipt' : 'Invoice'}
      description={payment.receiptNo}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={print}>
            <Printer size={15} /> Print
          </button>
        </>
      }
    >
      <ModalBody className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-fg">Absolute Special School &amp; Therapy Care</div>
            <div className="text-sm text-muted">{branch?.name}</div>
          </div>
          <Badge tone={paid ? 'green' : 'amber'} dot>
            {paid ? 'Paid' : 'Due'}
          </Badge>
        </div>
        <dl className="dl">
          <dt>{paid ? 'Receipt no.' : 'Invoice no.'}</dt>
          <dd className="font-mono">{payment.receiptNo}</dd>
          <dt>Date</dt>
          <dd>{formatDate(payment.paidAt || payment.createdAt)}</dd>
          <dt>Child</dt>
          <dd>
            {payment.patient?.name}{' '}
            {payment.patient?.studentId && (
              <span className="text-muted">({payment.patient.studentId})</span>
            )}
          </dd>
          <dt>Parent</dt>
          <dd>{payment.patient?.parentDetails?.name || '—'}</dd>
          <dt>For</dt>
          <dd>
            {payment.description}
            {payment.department && (
              <span className="text-muted"> · {getDeptName(payment.department)}</span>
            )}
          </dd>
          {paid ? (
            <>
              <dt>Paid by</dt>
              <dd>
                {PAYMENT_METHODS[payment.method]}
                {payment.reference && <span className="text-muted"> · {payment.reference}</span>}
              </dd>
            </>
          ) : (
            <>
              <dt>Due by</dt>
              <dd>{formatDate(payment.dueDate)}</dd>
            </>
          )}
        </dl>
        <div className="flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-muted">{paid ? 'Amount received' : 'Amount due'}</span>
          <span className="text-2xl font-semibold text-fg tnum">
            {formatCurrency(payment.amount)}
          </span>
        </div>
        {payment.recordedBy?.name && (
          <div className="text-xs text-muted">Recorded by {cleanName(payment.recordedBy.name)}</div>
        )}
      </ModalBody>
    </Modal>
  );
};

const PayoutModal = ({ row, period, onClose, onSaved }) => {
  const toast = useToast();
  const existing = row.payout;
  const [form, setForm] = useState({
    sessions: existing?.sessions ?? row.completedSessions,
    ratePerSession: existing?.ratePerSession ?? row.ratePerSession,
    bonus: existing?.bonus ?? 0,
    deductions: existing?.deductions ?? 0,
    method: existing?.method || 'bank_transfer',
    reference: existing?.reference || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const total = Math.max(
    0,
    Number(form.sessions) * Number(form.ratePerSession) +
      Number(form.bonus) -
      Number(form.deductions)
  );

  const save = async () => {
    setSaving(true);
    try {
      await billingApi.savePayout({
        staff: row.staff._id,
        period,
        ...Object.fromEntries(
          Object.entries(form).map(([k, v]) => [
            k,
            ['method', 'reference'].includes(k) ? v : Number(v) || 0,
          ])
        ),
      });
      toast({
        title: 'Payout recorded',
        description: `${cleanName(row.staff.name)} · ${formatCurrency(total)}`,
      });
      onSaved();
    } catch (err) {
      setError(apiError(err));
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Pay ${cleanName(row.staff.name)}`}
      description={`${formatPeriod(period)} · ${row.completedSessions} completed sessions on record`}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto">
            <div className="text-xs text-muted">Total payout</div>
            <div className="text-lg font-semibold text-fg tnum">{formatCurrency(total)}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Update payout' : 'Mark as paid'}
          </button>
        </>
      }
    >
      <ModalBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="grid gap-4 grid-cols-2">
          <Field
            label="Sessions"
            htmlFor="po-s"
            hint={
              Number(form.sessions) !== row.completedSessions
                ? `${row.completedSessions} on record`
                : undefined
            }
          >
            <input
              id="po-s"
              type="number"
              min="0"
              className="input"
              value={form.sessions}
              onChange={set('sessions')}
            />
          </Field>
          <Field label="Rate per session" htmlFor="po-r">
            <input
              id="po-r"
              type="number"
              min="0"
              className="input"
              value={form.ratePerSession}
              onChange={set('ratePerSession')}
            />
          </Field>
          <Field label="Bonus" htmlFor="po-b" optional>
            <input
              id="po-b"
              type="number"
              min="0"
              className="input"
              value={form.bonus}
              onChange={set('bonus')}
            />
          </Field>
          <Field label="Deductions" htmlFor="po-d" optional>
            <input
              id="po-d"
              type="number"
              min="0"
              className="input"
              value={form.deductions}
              onChange={set('deductions')}
            />
          </Field>
          <Field label="Paid by" htmlFor="po-m">
            <select id="po-m" className="select" value={form.method} onChange={set('method')}>
              {['bank_transfer', 'upi', 'cheque', 'cash'].map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_METHODS[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference" htmlFor="po-ref" optional>
            <input
              id="po-ref"
              className="input"
              value={form.reference}
              onChange={set('reference')}
            />
          </Field>
        </div>
      </ModalBody>
    </Modal>
  );
};

const AdminBilling = () => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('fees');
  const [feeFilter, setFeeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [modal, setModal] = useState(null);

  const fees = useApi(async () => {
    const [payments, patients, summary] = await Promise.all([
      billingApi.getPayments(),
      patientsApi.getAll({ status: 'active' }),
      billingApi.getSummary(),
    ]);
    return { payments: payments.data, patients: patients.data, summary: summary.data };
  });
  const payroll = useApi(async () => (await billingApi.getPayroll({ period })).data, [period]);

  const payments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (fees.data?.payments || []).filter(
      (p) =>
        (feeFilter === 'all' || p.status === feeFilter) &&
        (!q ||
          [p.receiptNo, p.patient?.name, p.description].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [fees.data, feeFilter, search]);

  const markPaid = async (p) => {
    const ok = await confirm({
      title: `Mark ${formatCurrency(p.amount)} as received?`,
      description: `${p.patient?.name} · ${p.description}. The invoice becomes a receipt dated today.`,
      confirmLabel: 'Mark paid',
    });
    if (!ok) return;
    try {
      await billingApi.updatePayment(p._id, { status: 'paid' });
      toast({ title: 'Marked as paid', description: p.receiptNo });
      fees.reload();
    } catch (err) {
      toast({ title: 'Could not update', description: apiError(err), tone: 'error' });
    }
  };

  const s = fees.data?.summary;
  const rows = payroll.data?.rows || [];
  const payrollDue = rows.filter((r) => !r.payout).reduce((n, r) => n + r.estimatedAmount, 0);
  const payrollPaid = rows.filter((r) => r.payout).reduce((n, r) => n + r.payout.amount, 0);
  const dueCount = (fees.data?.payments || []).filter((p) => p.status === 'pending').length;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Fee collection and staff payroll"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: 'pay' })}
          >
            <Plus size={16} /> Record a fee
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat
          label="Collected this month"
          icon={Wallet}
          accent="var(--success)"
          value={s ? formatCurrency(s.collected.total) : '–'}
          hint={s && `${s.collected.count} receipts`}
        />
        <Stat
          label="Fees due"
          icon={Clock}
          accent="var(--warning)"
          value={s ? formatCurrency(s.pending.total) : '–'}
          hint={s && `${s.pending.count} open invoices`}
        />
        <Stat
          label="Payroll paid"
          icon={HandCoins}
          value={s ? formatCurrency(s.payouts.total) : '–'}
          hint={s && `${s.payouts.count} staff this month`}
        />
        <Stat
          label="Net this month"
          icon={TrendingUp}
          value={s ? formatCurrency(s.collected.total - s.payouts.total) : '–'}
          hint="Fees collected minus payroll paid"
        />
      </div>

      <Card>
        <div className="px-4 pt-3 border-b border-line">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: 'fees',
                label: 'Fees',
                icon: Receipt,
                count: dueCount ? `${dueCount} due` : undefined,
              },
              { value: 'payroll', label: 'Payroll', icon: Banknote },
            ]}
          />
        </div>

        {tab === 'fees' && (
          <>
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-line">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search receipt no., child or description…"
                className="flex-1 min-w-[220px]"
              />
              <Segmented
                value={feeFilter}
                onChange={setFeeFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'pending', label: 'Due' },
                  { value: 'paid', label: 'Paid' },
                ]}
              />
            </div>
            {fees.loading ? (
              <SkeletonRows rows={5} />
            ) : payments.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={search || feeFilter !== 'all' ? 'Nothing matches' : 'No fees recorded yet'}
                description="Record a payment or raise an invoice to start the ledger."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Child</th>
                      <th>For</th>
                      <th className="col-right">Amount</th>
                      <th>Status</th>
                      <th className="col-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const overdue =
                        p.status === 'pending' && p.dueDate && toDateKey(p.dueDate) < toDateKey();
                      return (
                        <tr
                          key={p._id}
                          className="row-link"
                          onClick={() => setModal({ type: 'receipt', payment: p })}
                        >
                          <td>
                            <div className="font-mono text-sm text-fg">{p.receiptNo}</div>
                            <div className="text-xs text-muted">
                              {formatDate(p.paidAt || p.createdAt)}
                            </div>
                          </td>
                          <td className="text-fg">{p.patient?.name}</td>
                          <td>
                            <div className="text-sm text-fg-2 truncate-1 max-w-[260px]">
                              {p.description}
                            </div>
                            <div className="text-xs text-muted">
                              {p.status === 'paid'
                                ? PAYMENT_METHODS[p.method]
                                : `Due ${formatDate(p.dueDate)}`}
                            </div>
                          </td>
                          <td className="col-right font-medium text-fg tnum">
                            {formatCurrency(p.amount)}
                          </td>
                          <td>
                            {p.status === 'paid' ? (
                              <Badge tone="green" dot>
                                Paid
                              </Badge>
                            ) : (
                              <Badge tone={overdue ? 'red' : 'amber'} dot>
                                {overdue ? 'Overdue' : 'Due'}
                              </Badge>
                            )}
                          </td>
                          <td className="col-right" onClick={(e) => e.stopPropagation()}>
                            {p.status === 'pending' ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => markPaid(p)}
                              >
                                <CheckCircle2 size={14} /> Mark paid
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => setModal({ type: 'receipt', payment: p })}
                              >
                                <Printer size={14} /> Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'payroll' && (
          <>
            <CardHeader
              title={formatPeriod(period)}
              description={`${formatCurrency(payrollPaid)} paid · ${formatCurrency(payrollDue)} still to pay (estimated)`}
              actions={
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon btn-sm"
                    onClick={() => setPeriod(shiftPeriod(period, -1))}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon btn-sm"
                    onClick={() => setPeriod(shiftPeriod(period, 1))}
                    disabled={period >= currentPeriod()}
                    aria-label="Next month"
                  >
                    <ChevronRight size={15} />
                  </button>
                </>
              }
            />
            {payroll.loading ? (
              <SkeletonRows rows={4} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={Banknote}
                title="No therapists or teachers"
                description="Payroll lists clinical staff and their completed sessions."
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th className="col-right">Sessions</th>
                      <th className="col-right">Rate</th>
                      <th className="col-right">Amount</th>
                      <th>Status</th>
                      <th className="col-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.staff._id}>
                        <td>
                          <PersonCell
                            name={cleanName(r.staff.name)}
                            sub={deptList(r.staff.departments)}
                          />
                        </td>
                        <td className="col-right tnum">
                          {r.payout ? r.payout.sessions : r.completedSessions}
                        </td>
                        <td className="col-right tnum">
                          {formatCurrency(r.payout ? r.payout.ratePerSession : r.ratePerSession)}
                        </td>
                        <td className="col-right tnum font-medium text-fg">
                          {formatCurrency(r.payout ? r.payout.amount : r.estimatedAmount)}
                        </td>
                        <td>
                          {r.payout ? (
                            <div>
                              <Badge tone="green" dot>
                                Paid{' '}
                                {formatDate(r.payout.paidAt, { day: 'numeric', month: 'short' })}
                              </Badge>
                              {r.payout.reference && (
                                <div className="text-xs text-muted mt-0.5">
                                  Ref {r.payout.reference}
                                </div>
                              )}
                            </div>
                          ) : r.completedSessions ? (
                            <Badge tone="amber" dot>
                              To pay
                            </Badge>
                          ) : (
                            <Badge tone="gray">No sessions</Badge>
                          )}
                        </td>
                        <td className="col-right">
                          <button
                            type="button"
                            className={`btn btn-sm ${r.payout ? 'btn-ghost' : 'btn-secondary'}`}
                            onClick={() => setModal({ type: 'payout', row: r })}
                          >
                            {r.payout ? 'Edit' : 'Pay'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {modal?.type === 'pay' && (
        <PaymentModal
          patients={fees.data?.patients || []}
          onClose={() => setModal(null)}
          onSaved={(p) => {
            fees.reload();
            setModal(p.status === 'paid' ? { type: 'receipt', payment: p } : null);
          }}
        />
      )}
      {modal?.type === 'receipt' && (
        <ReceiptModal payment={modal.payment} branch={user.branch} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'payout' && (
        <PayoutModal
          row={modal.row}
          period={period}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            payroll.reload();
            fees.reload();
          }}
        />
      )}
    </>
  );
};

export default AdminBilling;
