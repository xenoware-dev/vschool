import { useState } from 'react';
import { Plus, Trash2, Eye, Lock } from 'lucide-react';
import {
  Modal,
  ModalBody,
  Tabs,
  Segmented,
  Switch,
  Alert,
  Badge,
  DeptChip,
  useToast,
} from '../../../components/ui';
import { appointmentsApi } from '../../../api/appointments';
import { formatRelativeDay, formatClock, slotStart } from '../../../utils/format';
import { apiError, hasNotes, MILESTONE_STATUSES } from './helpers';

// Starter goals per department — therapists can edit or remove them
const SUGGESTED_GOALS = {
  pediatric_ot: [
    'Maintains tripod grasp on writing utensil',
    'Crosses physical midline during bilateral motor tasks',
    'Independently completes a 3-step fine motor sequence',
  ],
  speech_language: [
    'Uses 2–3 word phrases to express spontaneous requests',
    'Follows two-step directions without visual prompts',
    'Maintains eye contact during conversational turn-taking',
  ],
  behavioral: [
    'Transitions between activities with minimal verbal prompts',
    'Uses a visual schedule to follow task sequence',
    'Engages in structured play for 10 consecutive minutes',
  ],
  sensory_integration: [
    'Tolerates linear vestibular input for 5 minutes',
    'Self-regulates arousal using deep-pressure tools',
  ],
  physiotherapy: [
    'Maintains single-leg balance for 5 seconds',
    'Climbs stairs with alternating feet using the rail',
  ],
  special_education: ['Identifies letters A–Z', 'Completes a table-top task for 10 minutes'],
  special_school: [
    'Follows classroom routine with visual cues',
    'Participates in group circle time',
  ],
};

const SOAP = [
  {
    key: 'subjective',
    letter: 'S',
    title: 'Subjective',
    hint: 'Mood, alertness, readiness and what the parent reported',
    tags: ['Calm & alert', 'Sensory seeking', 'Tired', 'Dysregulated', 'Parent reports good week'],
    style: { background: 'var(--primary-soft)', color: 'var(--primary)' },
  },
  {
    key: 'objective',
    letter: 'O',
    title: 'Objective',
    hint: 'Activities done, trials, duration, prompts needed',
    tags: [
      'Swing 10 min',
      'Grasp drill',
      'Picture requesting',
      'Obstacle course',
      'Turn-taking game',
    ],
    style: { background: 'var(--success-soft)', color: 'var(--success)' },
  },
  {
    key: 'assessment',
    letter: 'A',
    title: 'Assessment',
    hint: 'How the child responded and progress against goals — parents see this',
    tags: [],
    style: { background: 'var(--warning-soft)', color: 'var(--warning)' },
  },
  {
    key: 'plan',
    letter: 'P',
    title: 'Plan',
    hint: 'Focus for the next session — parents see this',
    tags: [],
    style: { background: 'var(--surface-3)', color: 'var(--fg-2)' },
  },
];

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Attended' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'scheduled', label: 'Upcoming' },
];

const SessionNotesModal = ({ appointment, onClose, onSaved }) => {
  const toast = useToast();
  const [tab, setTab] = useState('notes');
  // Opening notes on a scheduled session usually means it just happened
  const [status, setStatus] = useState(
    appointment.status === 'scheduled' ? 'completed' : appointment.status
  );
  // New notes are shared with the family by default; keep the saved choice when editing
  const [parentVisible, setParentVisible] = useState(
    hasNotes(appointment) ? Boolean(appointment.parentVisible) : true
  );
  const [soap, setSoap] = useState({
    subjective: appointment.soapNotes?.subjective || '',
    objective: appointment.soapNotes?.objective || '',
    assessment: appointment.soapNotes?.assessment || '',
    plan: appointment.soapNotes?.plan || '',
  });
  const [milestones, setMilestones] = useState(
    appointment.milestones?.length
      ? appointment.milestones
      : (SUGGESTED_GOALS[appointment.department] || []).map((goal) => ({
          goal,
          status: 'not_started',
        }))
  );
  const [newGoal, setNewGoal] = useState('');
  const [homeActivities, setHomeActivities] = useState(appointment.homeActivities || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const appendTag = (field, tag) =>
    setSoap((s) => ({
      ...s,
      [field]: s[field] ? `${s[field].replace(/[.\s]*$/, '')}. ${tag}` : tag,
    }));

  const updateGoal = (i, patch) =>
    setMilestones((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setMilestones((list) => [...list, { goal: newGoal.trim(), status: 'in_progress' }]);
    setNewGoal('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await appointmentsApi.addNotes(appointment._id, {
        status,
        parentVisible,
        soapNotes: soap,
        // Untouched suggestions are not saved as goals
        milestones: milestones.filter((m) => m.goal.trim() && m.status !== 'not_started'),
        homeActivities,
      });
      toast({
        title: 'Session notes saved',
        description:
          parentVisible && status === 'completed'
            ? 'Shared with the parent portal'
            : 'Kept internal to the clinic',
      });
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(apiError(err, 'Could not save notes'));
    } finally {
      setSaving(false);
    }
  };

  const achieved = milestones.filter((m) => m.status === 'achieved').length;

  return (
    <Modal
      size="xl"
      onClose={onClose}
      title={`Session notes — ${appointment.patient?.name || 'Child'}`}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <DeptChip dept={appointment.department} />
          <span>
            {formatRelativeDay(appointment.date)} · {formatClock(slotStart(appointment.timeSlot))}
          </span>
        </span>
      }
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-sm">
            <Switch checked={parentVisible} onChange={setParentVisible} label="Share with parent" />
            <span className="inline-flex items-center gap-1.5 text-fg-2">
              {parentVisible ? <Eye size={14} /> : <Lock size={14} />}
              {parentVisible ? 'Parent can see summary, goals & home plan' : 'Internal only'}
            </span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </>
      }
    >
      <ModalBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'notes', label: 'SOAP notes' },
              { value: 'goals', label: 'Goals', count: `${achieved}/${milestones.length}` },
              { value: 'home', label: 'Home plan' },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Attendance</span>
            <Segmented value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
        </div>

        {tab === 'notes' && (
          <div className="space-y-4">
            {SOAP.map((s) => (
              <div key={s.key}>
                <div className="flex items-start gap-3 mb-2">
                  <span className="soap-letter" style={s.style}>
                    {s.letter}
                  </span>
                  <div className="min-w-0">
                    <label htmlFor={`soap-${s.key}`} className="font-medium text-fg">
                      {s.title}
                    </label>
                    <div className="text-xs text-muted">{s.hint}</div>
                  </div>
                </div>
                <textarea
                  id={`soap-${s.key}`}
                  className="textarea"
                  rows={3}
                  value={soap[s.key]}
                  onChange={(e) => setSoap((v) => ({ ...v, [s.key]: e.target.value }))}
                />
                {s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-tag"
                        onClick={() => appendTag(s.key, tag)}
                      >
                        <Plus size={12} /> {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'goals' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Rate each goal worked on today. Goals left as “Not started” aren’t saved. Achieved
              goals show on the parent’s progress page.
            </p>
            <div className="card">
              {milestones.length === 0 && (
                <div className="p-4 text-sm text-muted">No goals yet — add one below.</div>
              )}
              {milestones.map((m, i) => (
                <div key={i} className="list-row">
                  <input
                    className="input flex-1 min-w-0"
                    value={m.goal}
                    onChange={(e) => updateGoal(i, { goal: e.target.value })}
                    aria-label="Goal"
                  />
                  <select
                    className="select w-auto"
                    value={m.status}
                    onChange={(e) => updateGoal(i, { status: e.target.value })}
                    aria-label="Goal status"
                  >
                    {Object.entries(MILESTONE_STATUSES).map(([value, meta]) => (
                      <option key={value} value={value}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                  <Badge
                    tone={MILESTONE_STATUSES[m.status]?.tone}
                    dot
                    className="hidden md:inline-flex"
                  >
                    {MILESTONE_STATUSES[m.status]?.label}
                  </Badge>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setMilestones((list) => list.filter((_, idx) => idx !== i))}
                    aria-label="Remove goal"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a goal…"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addGoal}
                disabled={!newGoal.trim()}
              >
                <Plus size={15} /> Add goal
              </button>
            </div>
          </div>
        )}

        {tab === 'home' && (
          <div className="space-y-3">
            <Alert tone="info" title="Written for parents">
              Keep it short and practical — what to do, how long, how often. This appears on the
              parent’s home page as a daily checklist.
            </Alert>
            <textarea
              className="textarea"
              rows={8}
              value={homeActivities}
              onChange={(e) => setHomeActivities(e.target.value)}
              placeholder={
                'e.g. Roll play-dough into snakes for 10 minutes after school.\nPraise every two-word request at snack time.'
              }
              aria-label="Home activities"
            />
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default SessionNotesModal;
