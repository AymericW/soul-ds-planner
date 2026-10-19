import { useMemo, useState, type ReactNode } from 'react';
import { formatPower } from '@/helpers/format';
import { normaliseName } from '@/helpers/normalise';
import { CheckIcon } from './Icons';
import { SearchInput } from './SearchInput';

export interface ChecklistItem {
  id: string;
  name: string;
  power: number;
  checked: boolean;
  /** Ticked automatically from the screenshot. */
  fromOcr: boolean;
  /** Warning such as "Inactive" or "Suspended (2)". */
  warning?: string;
  /** Registered only as a substitute. */
  substituteOnly?: boolean;
  /** Extra tags, e.g. "Self-registered". */
  badges?: ReadonlyArray<{ label: string; tone: 'success' | 'warning' | 'danger' | 'muted' | 'rank' }>;
  /** Small line under the name (e.g. when and what the player submitted). */
  detail?: string;
  /** Highlights the detail line (e.g. a power change waiting for review). */
  detailWarning?: boolean;
}

interface MemberChecklistProps {
  items: readonly ChecklistItem[];
  /** Tapping a row (name or tick box) – the screen decides what happens (e.g. opens a confirm sheet). */
  onSelect: (id: string) => void;
  disabled?: boolean;
  checkedLabel: string;
  /** Icon buttons shown next to the search field. */
  actions?: ReactNode;
}

type Filter = 'all' | 'checked' | 'unchecked';

/** Searchable roster checklist: always works, with or without OCR. */
export function MemberChecklist({ items, onSelect, disabled, checkedLabel, actions }: MemberChecklistProps) {
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

  const filters: ReadonlyArray<{ value: Filter; label: string }> = [
    { value: 'all', label: `All ${items.length}` },
    { value: 'checked', label: `${checkedLabel} ${checkedCount}` },
    { value: 'unchecked', label: `Not yet ${items.length - checkedCount}` },
  ];

  return (
    <div className="checklist">
      <div className="checklist__search">
        <SearchInput value={search} onChange={setSearch} placeholder="Find a member" />
        {actions}
      </div>
      <div className="filter-chips" role="radiogroup" aria-label="Show">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={filter === f.value}
            className={`filter-chip${filter === f.value ? ' is-selected' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ul className="checklist__list">
        {visible.map((item) => {
          const tags = [
            ...(item.warning ? [{ label: item.warning, tone: 'danger' }] : []),
            ...(item.checked && item.substituteOnly ? [{ label: 'Sub only', tone: 'sub' }] : []),
            ...(item.badges ?? []),
            ...(item.fromOcr && item.checked ? [{ label: 'From screenshot', tone: 'success' }] : []),
          ];
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`checklist__row${item.checked ? ' is-checked' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(item.id)}
              >
                <span className="checklist__text">
                  <span className="checklist__name">{item.name}</span>
                  {(tags.length > 0 || item.detail) && (
                    <span className="checklist__tags">
                      {tags.map((t) => (
                        <span key={t.label} className={`tag tag--${t.tone}`}>
                          {t.label}
                        </span>
                      ))}
                      {item.detail && <span className={`tag ${item.detailWarning ? 'tag--warning' : 'tag--muted'}`}>{item.detail}</span>}
                    </span>
                  )}
                </span>
                <span className="checklist__power">{formatPower(item.power)}</span>
                <span className="tickbox" aria-hidden="true">
                  {item.checked && <CheckIcon size={16} />}
                </span>
                <span className="visually-hidden">{item.checked ? checkedLabel : `Not ${checkedLabel.toLowerCase()}`}</span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="muted checklist__empty">Nobody matches.</li>}
      </ul>
    </div>
  );
}
