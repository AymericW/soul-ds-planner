import { useState, type FormEvent } from 'react';
import { DEFAULT_ACTIVITY } from '@/constants/rules';
import { formatPower, parsePower, pluralise } from '@/helpers/format';
import { MEMBER_RANKS, type Member, type MemberDraft, type MemberRank } from '@/models/Member';
import { Segmented } from './Segmented';

type Errors = Partial<Record<'name' | 'power' | 'activity', string>>;

interface MemberFormProps {
  member?: Member;
  suspensionRemaining?: number;
  onSubmit: (draft: MemberDraft) => Promise<Errors>;
  onCancel: () => void;
  onDelete?: () => void;
  onLiftSuspension?: () => void;
  onRemoveAlias?: (alias: string) => void;
}

const ACTIVITY_OPTIONS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }));

export function MemberForm({
  member,
  suspensionRemaining = 0,
  onSubmit,
  onCancel,
  onDelete,
  onLiftSuspension,
  onRemoveAlias,
}: MemberFormProps) {
  const [name, setName] = useState(member?.name ?? '');
  const [powerText, setPowerText] = useState(member ? formatPower(member.power) : '');
  const [activity, setActivity] = useState(member?.activity ?? DEFAULT_ACTIVITY);
  const [rank, setRank] = useState<MemberRank | ''>(member?.rank ?? '');
  const [active, setActive] = useState(member?.active ?? true);
  const [notes, setNotes] = useState(member?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const power = powerText.trim() ? parsePower(powerText) : 0;
    if (power === undefined) {
      setErrors({ power: 'Write power like 152.3M, 1.2B or 152300000.' });
      return;
    }
    setSaving(true);
    try {
      const result = await onSubmit({
        name,
        power,
        activity,
        rank: rank || undefined,
        active,
        notes: notes.trim() || undefined,
        aliases: member?.aliases,
      });
      setErrors(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <label className="field">
        <span className="field__label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
        {errors.name && <span className="field__error">{errors.name}</span>}
      </label>
      <label className="field">
        <span className="field__label">Power</span>
        <input
          className="input"
          value={powerText}
          onChange={(e) => setPowerText(e.target.value)}
          placeholder="e.g. 152.3M"
          inputMode="decimal"
          autoComplete="off"
        />
        <span className="field__hint">Numbers below 100 000 are read as millions (152.3 = 152.3M).</span>
        {errors.power && <span className="field__error">{errors.power}</span>}
      </label>
      <div className="field">
        <span className="field__label">Activity rating (set by R4)</span>
        <Segmented label="Activity rating" value={activity} options={ACTIVITY_OPTIONS} onChange={setActivity} />
        {errors.activity && <span className="field__error">{errors.activity}</span>}
      </div>
      <label className="field">
        <span className="field__label">Rank (optional)</span>
        <select className="input" value={rank} onChange={(e) => setRank(e.target.value as MemberRank | '')}>
          <option value="">–</option>
          {MEMBER_RANKS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="switch">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>Active member (inactive members are never selected)</span>
      </label>
      <label className="field">
        <span className="field__label">Notes (optional)</span>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} autoComplete="off" />
      </label>

      {member && member.aliases.length > 0 && (
        <div className="field">
          <span className="field__label">Remembered OCR spellings</span>
          <div className="chips">
            {member.aliases.map((alias) => (
              <span key={alias} className="chip">
                {alias}
                {onRemoveAlias && (
                  <button type="button" className="chip__remove" aria-label={`Forget ${alias}`} onClick={() => onRemoveAlias(alias)}>
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {suspensionRemaining > 0 && (
        <div className="notice notice--danger">
          Suspended for the next {pluralise(suspensionRemaining, 'event')}.
          {onLiftSuspension && (
            <button type="button" className="button button--small" onClick={onLiftSuspension}>
              Lift suspension
            </button>
          )}
        </div>
      )}

      <div className="form__actions">
        {onDelete && (
          <button type="button" className="button button--danger-ghost" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={saving}>
          {member ? 'Save' : 'Add member'}
        </button>
      </div>
    </form>
  );
}
