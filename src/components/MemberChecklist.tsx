import { useMemo, useState } from 'react';
import { formatPower } from '@/helpers/format';
import { normaliseName } from '@/helpers/normalise';
import { SearchInput } from './SearchInput';
import { Segmented } from './Segmented';

export interface ChecklistItem {
  id: string;
  name: string;
  power: number;
  checked: boolean;
  /** Ticked automatically from the screenshot. */
  fromOcr: boolean;
  /** Warning badge such as "Inactive" or "Suspended (2)". */
  warning?: string;
  /** Registered only as a substitute. */
  substituteOnly?: boolean;
}

interface MemberChecklistProps {
  items: readonly ChecklistItem[];
  onToggle: (id: string) => void;
  /** When given, checked rows get a "Sub only" switch. */
  onToggleSubstitute?: (id: string) => void;
  disabled?: boolean;
  checkedLabel: string;
}

type Filter = 'all' | 'checked' | 'unchecked';

/** Searchable roster checklist: always works, with or without OCR. */
export function MemberChecklist({ items, onToggle, onToggleSubstitute, disabled, checkedLabel }: MemberChecklistProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const checkedCount = items.filter((i) => i.checked).length;

  const visible = useMemo(() => {
    const q = normaliseName(search);
    return items.filter((i) => {
      if (filter === 'checked' && !i.checked) return false;
      if (filter === 'unchecked' && i.checked) return false;
      return !q || normaliseName(i.name).includes(q);
    });
  }, [items, search, filter]);

  return (
    <div className="checklist">
      <SearchInput value={search} onChange={setSearch} placeholder="Find a member…" />
      <Segmented<Filter>
        label="Show"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All (${items.length})` },
          { value: 'checked', label: `${checkedLabel} (${checkedCount})` },
          { value: 'unchecked', label: `Not ${checkedLabel.toLowerCase()} (${items.length - checkedCount})` },
        ]}
      />
      <ul className="checklist__list">
        {visible.map((item) => (
          <li key={item.id} className="checklist__item">
            <label className={`checklist__row${item.checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}>
              <input type="checkbox" checked={item.checked} disabled={disabled} onChange={() => onToggle(item.id)} />
              <span className="checklist__name">{item.name}</span>
              {item.fromOcr && item.checked && <span className="badge badge--success">OCR</span>}
              {item.warning && <span className="badge badge--danger">{item.warning}</span>}
              <span className="checklist__meta">{formatPower(item.power)}</span>
            </label>
            {onToggleSubstitute && item.checked && (
              <button
                type="button"
                className={`checklist__sub${item.substituteOnly ? ' is-on' : ''}`}
                aria-pressed={item.substituteOnly}
                disabled={disabled}
                onClick={() => onToggleSubstitute(item.id)}
                title="Voted to be a substitute only"
              >
                Sub only
              </button>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="muted checklist__empty">Nobody matches.</li>}
      </ul>
    </div>
  );
}
