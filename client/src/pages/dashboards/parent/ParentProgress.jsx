import { useEffect, useMemo, useState } from 'react';
import { Target, Home, MessageSquareText, Check, Trophy, Baby } from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Badge,
  DeptChip,
  Progress,
  EmptyState,
  PageSkeleton,
  Alert,
  cx,
} from '../../../components/ui';
import { getDeptColor } from '../../../utils/constants';
import { toDateKey, addDays, parseDateKey, formatDate, pct } from '../../../utils/format';
import { useParentData } from './useParentData';
import ChildSwitcher from './ChildSwitcher';
import { cleanName, MILESTONE_STATUSES } from '../shared/helpers';

// Home-practice ticks are a per-device convenience, so they live in localStorage
const STORE_KEY = 'vschool_home_practice';
const readTicks = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeTicks = (ticks) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(ticks));
  } catch {
    /* storage unavailable — ticks just won't persist */
  }
};

const STATUS_ORDER = { in_progress: 0, emerging: 1, not_started: 2, achieved: 3 };

const ParentProgress = () => {
  const { loading, error, children, child, selectChild, sessions } = useParentData();
  const [ticks, setTicks] = useState(readTicks);

  useEffect(() => {
    if (window.location.hash === '#home')
      document.getElementById('home')?.scrollIntoView({ behavior: 'smooth' });
  }, [loading]);

  const shared = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'completed')
        .sort((a, b) => toDateKey(b.date).localeCompare(toDateKey(a.date))),
    [sessions]
  );

  // Latest status per goal, with the trail of earlier ratings
  const goals = useMemo(() => {
    const map = new Map();
    [...shared].reverse().forEach((s) =>
      s.milestones?.forEach((m) => {
        const g = map.get(m.goal) || { goal: m.goal, department: s.department, history: [] };
        g.history.push({ status: m.status, date: s.date });
        g.status = m.status;
        g.updated = s.date;
        map.set(m.goal, g);
      })
    );
    return [...map.values()].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [shared]);

  // Most recent home plan per therapy
  const practice = useMemo(() => {
    const seen = new Set();
    return shared.filter(
      (s) => s.homeActivities && !seen.has(s.department) && seen.add(s.department)
    );
  }, [shared]);

  if (loading) return <PageSkeleton />;

  const achieved = goals.filter((g) => g.status === 'achieved').length;
  const today = toDateKey();
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const tickKey = (s, day) => `${child?._id}:${s.department}:${day}`;
  const toggle = (s) => {
    const next = { ...ticks, [tickKey(s, today)]: !ticks[tickKey(s, today)] };
    setTicks(next);
    writeTicks(next);
  };
  const practisedDays = week.filter((d) => practice.some((s) => ticks[tickKey(s, d)])).length;

  return (
    <>
      <PageHeader
        title="Progress"
        description={child ? `${child.name}’s goals, therapist notes and home practice` : undefined}
        actions={<ChildSwitcher kids={children} child={child} onSelect={selectChild} />}
      />

      {error && (
        <Alert tone="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {!child ? (
        <Card>
          <EmptyState
            icon={Baby}
            title="No child linked yet"
            description="Please ask the clinic reception to link your child’s profile."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Goals achieved"
              icon={Trophy}
              accent="var(--success)"
              value={`${achieved} / ${goals.length}`}
            >
              <Progress
                value={pct(achieved, goals.length)}
                color="var(--success)"
                className="mt-2"
              />
            </Stat>
            <Stat label="Goals in progress" icon={Target} value={goals.length - achieved} />
            <Stat
              label="Sessions with notes"
              icon={MessageSquareText}
              value={shared.length}
              hint={shared[0] ? `Latest ${formatDate(shared[0].date)}` : undefined}
            />
            <Stat label="Practised this week" icon={Home} value={`${practisedDays} / 7 days`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader
                title="Goals"
                description="What the therapists are working on, and how it’s going"
              />
              {goals.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Goals coming soon"
                  description="Therapists add goals as they get to know your child."
                />
              ) : (
                goals.map((g) => (
                  <div key={g.goal} className="list-row items-start">
                    <span
                      className={cx(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                        g.status === 'achieved' ? 'bg-success text-white' : 'border-2'
                      )}
                      style={
                        g.status === 'achieved'
                          ? undefined
                          : { borderColor: getDeptColor(g.department) }
                      }
                      aria-hidden="true"
                    >
                      {g.status === 'achieved' && <Check size={14} strokeWidth={3} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-fg">{g.goal}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <DeptChip dept={g.department} />
                        <span>
                          Updated {formatDate(g.updated, { day: 'numeric', month: 'short' })}
                        </span>
                        {g.history.length > 1 && (
                          <span>
                            ·{' '}
                            {g.history.map((h) => MILESTONE_STATUSES[h.status]?.label).join(' → ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge tone={MILESTONE_STATUSES[g.status]?.tone} dot>
                      {MILESTONE_STATUSES[g.status]?.label}
                    </Badge>
                  </div>
                ))
              )}
            </Card>

            <Card id="home">
              <CardHeader
                title="Home practice"
                description="Tick off each activity when you’ve done it today"
              />
              {practice.length === 0 ? (
                <EmptyState
                  icon={Home}
                  title="No activities yet"
                  description="Your therapist will suggest simple things to practise together."
                />
              ) : (
                <>
                  {practice.map((s) => {
                    const done = Boolean(ticks[tickKey(s, today)]);
                    return (
                      <label
                        key={s._id}
                        className={cx(
                          'list-row items-start cursor-pointer',
                          done && 'bg-surface-2'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={done}
                          onChange={() => toggle(s)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <DeptChip dept={s.department} />
                            <span className="text-xs text-muted">
                              {cleanName(s.therapist?.name)}
                            </span>
                          </div>
                          <p
                            className={cx(
                              'text-sm whitespace-pre-line',
                              done ? 'text-muted' : 'text-fg'
                            )}
                          >
                            {s.homeActivities}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                  <div className="px-4 py-3 border-t border-line">
                    <div className="section-label mb-2">Last 7 days</div>
                    <div className="flex gap-1.5">
                      {week.map((d) => {
                        const any = practice.some((s) => ticks[tickKey(s, d)]);
                        return (
                          <div
                            key={d}
                            className="flex-1 text-center"
                            title={`${formatDate(d)}: ${any ? 'practised' : 'not practised'}`}
                          >
                            <div
                              className={cx('h-7 rounded-md', any ? 'bg-success' : 'bg-surface-3')}
                            />
                            <div className="text-[11px] text-muted mt-1">
                              {parseDateKey(d).toLocaleDateString('en-IN', { weekday: 'narrow' })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Notes from sessions"
              description="Shared by the therapist after each session"
            />
            {shared.length === 0 ? (
              <EmptyState icon={MessageSquareText} title="No notes shared yet" />
            ) : (
              <div className="card-body">
                <div className="timeline">
                  {shared.map((s) => (
                    <div key={s._id} className="timeline-item">
                      <span
                        className="timeline-marker"
                        style={{ borderColor: getDeptColor(s.department) }}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-fg">{formatDate(s.date)}</span>
                        <DeptChip dept={s.department} />
                        <span className="text-muted">{cleanName(s.therapist?.name)}</span>
                      </div>
                      {(s.soapNotes?.assessment || s.sessionNotes) && (
                        <p className="mt-1.5 text-fg-2 leading-relaxed whitespace-pre-line">
                          {s.soapNotes?.assessment || s.sessionNotes}
                        </p>
                      )}
                      {s.soapNotes?.plan && (
                        <p className="mt-1 text-sm text-muted">
                          <span className="font-medium text-fg-2">Next: </span>
                          {s.soapNotes.plan}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
};

export default ParentProgress;
