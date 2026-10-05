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
            <span className="steps__number">{s.id}</span>
            <span className="steps__label">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
