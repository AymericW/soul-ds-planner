import { useState, type FormEvent } from 'react';
import { formatPower, parsePower } from '@/helpers/format';

interface PowerEditorProps {
  name: string;
  currentPower: number;
  /** Power the player entered on the join page, if any. */
  enteredPower?: number;
  onSave: (power: number) => void | Promise<void>;
  onCancel: () => void;
}

/** Small form to correct a member's power (e.g. from a self-registration). */
export function PowerEditor({ name, currentPower, enteredPower, onSave, onCancel }: PowerEditorProps) {
  const [text, setText] = useState(formatPower(currentPower));
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const power = parsePower(text);
    if (power === undefined) {
      setError('Write power like 152.3M, 1.2B or 152300000.');
      return;
    }
    await onSave(power);
  };

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <p className="muted small">
        Roster power of <strong>{name}</strong>: {formatPower(currentPower)}
        {enteredPower !== undefined && enteredPower !== currentPower && ` · entered by the player: ${formatPower(enteredPower)}`}
      </p>
      <label className="field">
        <span className="field__label">Power</span>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" autoComplete="off" />
        {error && <span className="field__error">{error}</span>}
      </label>
      <div className="form__actions">
        {enteredPower !== undefined && enteredPower !== currentPower && (
          <button type="button" className="button button--ghost" onClick={() => setText(formatPower(enteredPower))}>
            Use {formatPower(enteredPower)}
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Save
        </button>
      </div>
    </form>
  );
}
