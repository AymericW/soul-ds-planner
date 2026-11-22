import { t } from '@/helpers/i18n';
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchInput({ value, onChange, placeholder = t().week.searchMembers, label = t().week.search }: SearchInputProps) {
  return (
    <div className="search">
      <span className="search__icon" aria-hidden="true">
        ⌕
      </span>
      <input
        type="search"
        className="input search__input"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {value && (
        <button type="button" className="icon-button search__clear" aria-label={t().week.clearSearch} onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  );
}
