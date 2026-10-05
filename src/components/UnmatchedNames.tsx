import { useMemo, useState } from 'react';
import { similarity } from '@/helpers/fuzzy';
import { normaliseName } from '@/helpers/normalise';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';

interface UnmatchedNamesProps {
  title?: string;
  hint?: string;
  unmatched: ReadonlyArray<{ line: string; guess: string }>;
  members: ReadonlyArray<{ id: string; name: string }>;
  onAssign: (guess: string, memberId: string) => void;
  onDismiss: (guess: string) => void;
}

/** OCR lines that matched nobody: tap to say who it is (remembered as an alias). */
export function UnmatchedNames({
  title = 'Not recognised',
  hint = 'Tap a name to tell the app who it is – it will remember that spelling next time. Ignore lines that are not players.',
  unmatched,
  members,
  onAssign,
  onDismiss,
}: UnmatchedNamesProps) {
  const [picking, setPicking] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Closest spellings first, so the right member is usually at the top.
  const options = useMemo(() => {
    const guess = normaliseName(picking ?? '');
    const query = normaliseName(search);
    return members
      .filter((m) => !query || normaliseName(m.name).includes(query))
      .map((m) => ({ m, sim: similarity(normaliseName(m.name), guess) }))
      .sort((a, b) => b.sim - a.sim || a.m.name.localeCompare(b.m.name))
      .map((x) => x.m);
  }, [members, search, picking]);

  if (unmatched.length === 0) return null;
  return (
    <div className="card unmatched">
      <h3 className="card__title">
        {title} ({unmatched.length})
      </h3>
      <p className="muted small">{hint}</p>
      <div className="chips">
        {unmatched.map((u) => (
          <span key={u.guess} className="chip chip--action">
            <button type="button" className="chip__main" onClick={() => { setSearch(''); setPicking(u.guess); }} title={u.line}>
              {u.guess}
            </button>
            <button type="button" className="chip__remove" aria-label={`Ignore ${u.guess}`} onClick={() => onDismiss(u.guess)}>
              ✕
            </button>
          </span>
        ))}
      </div>
      {picking && (
        <Modal title={`Who is “${picking}”?`} onClose={() => setPicking(null)}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search the roster…" />
          <ul className="pick-list">
            {options.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="pick-list__item"
                  onClick={() => {
                    onAssign(picking, m.id);
                    setPicking(null);
                  }}
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
