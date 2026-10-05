interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search members…', label = 'Search' }: SearchInputProps) {
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
        <button type="button" className="icon-button search__clear" aria-label="Clear search" onClick={() => onChange('')}>
          ✕
        </button>
      )}
    </div>
  );
}
