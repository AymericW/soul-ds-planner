interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  error?: string;
  onChange: (value: number) => void;
}

/** Large -/+ buttons around a number (easier than a tiny input on phones). */
export function NumberStepper({ label, value, min, max, step = 1, hint, error, onChange }: NumberStepperProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="stepper">
        <button type="button" className="button stepper__btn" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
          −
        </button>
        <input
          className="input stepper__input"
          type="number"
          inputMode="numeric"
          aria-label={label}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        <button type="button" className="button stepper__btn" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
          +
        </button>
      </div>
      {hint && <span className="field__hint">{hint}</span>}
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
