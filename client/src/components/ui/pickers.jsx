import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Avatar, Spinner, cx } from './primitives';
import { isSlotPast, isTodayKey, slotStart, formatClock } from '../../utils/format';

/** Searchable single-select list for people (patients, therapists). */
export const PersonPicker = ({ people = [], value, onChange, getSub, placeholder = 'Search by name…', emptyText = 'No matches' }) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name?.toLowerCase().includes(q) || getSub?.(p)?.toLowerCase().includes(q));
  }, [people, query, getSub]);

  return (
    <div className="picker">
      <div className="input-wrap">
        <span className="input-icon"><Search size={15} /></span>
        <input
          className="input picker-search"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="picker-list" role="listbox">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted">{emptyText}</div>
        ) : (
          filtered.map((p) => {
            const selected = p._id === value;
            return (
              <button
                key={p._id}
                type="button"
                role="option"
                aria-selected={selected}
                className={cx('picker-item', selected && 'is-selected')}
                onClick={() => onChange(p._id)}
              >
                <Avatar name={p.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-fg truncate-1">{p.name}</div>
                  {getSub && <div className="text-xs text-muted truncate-1">{getSub(p)}</div>}
                </div>
                {selected && <Check size={15} className="text-primary shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

/** Grid of time-slot buttons. Past slots on today's date are hidden. */
export const SlotPicker = ({ slots = [], value, onChange, date, loading }) => {
  const visible = date && isTodayKey(date) ? slots.filter((s) => !isSlotPast(s)) : slots;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-3">
        <Spinner /> Checking availability…
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">
        No open slots on this date. Try another day.
      </div>
    );
  }

  return (
    <div className="slot-grid">
      {visible.map((slot) => (
        <button
          key={slot}
          type="button"
          className={cx('slot-btn', value === slot && 'is-selected')}
          onClick={() => onChange(slot)}
          title={slot}
        >
          {formatClock(slotStart(slot))}
        </button>
      ))}
    </div>
  );
};
