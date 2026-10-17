interface Step {
  id: number;
  label: string;
  enabled: boolean;
}

interface StepIndicatorProps {
  steps: readonly Step[];
  current: number;
  onSelect: (id: number) => void;
}

/** Slim progress bar: one line per step, each line + label is a tap target to jump to that step. */
export function StepIndicator({ steps, current, onSelect }: StepIndicatorProps) {
  return (
    <ol className="steps" aria-label="Weekly steps">
      {steps.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            className={`steps__item${s.id === current ? ' is-current' : ''}${s.id < current ? ' is-done' : ''}`}
            aria-current={s.id === current ? 'step' : undefined}
            disabled={!s.enabled}
            onClick={() => onSelect(s.id)}
          >
            <span className="steps__bar" aria-hidden="true" />
            <span className="steps__label">
              {s.id} {s.label}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
