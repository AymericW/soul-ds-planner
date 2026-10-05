import { useState } from 'react';
import { FileButton } from './FileButton';

interface ScreenshotUploaderProps {
  title: string;
  hint: string;
  imageUrl: string | null;
  status: 'idle' | 'working' | 'done' | 'failed';
  progressLabel: string;
  progress: number;
  message: string | null;
  disabled?: boolean;
  onFile: (file: File) => void;
  onTrySample?: () => void;
  onClear: () => void;
}

/** Screenshot picker + preview + OCR progress. Manual ticking always stays possible. */
export function ScreenshotUploader({
  title,
  hint,
  imageUrl,
  status,
  progressLabel,
  progress,
  message,
  disabled,
  onFile,
  onTrySample,
  onClear,
}: ScreenshotUploaderProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="uploader card">
      <div className="uploader__head">
        <h3 className="card__title">{title}</h3>
        <p className="muted small">{hint}</p>
      </div>
      <div className="uploader__actions">
        <FileButton accept="image/*" onFile={onFile} className="button button--primary" disabled={disabled || status === 'working'}>
          {imageUrl ? 'Choose another screenshot' : 'Choose screenshot'}
        </FileButton>
        {onTrySample && !imageUrl && (
          <button type="button" className="button button--ghost" onClick={onTrySample} disabled={disabled}>
            Try the sample
          </button>
        )}
        {imageUrl && status !== 'working' && (
          <button type="button" className="button button--ghost" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
      {status === 'working' && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="progress__bar" style={{ width: `${Math.max(5, Math.round(progress * 100))}%` }} />
          <span className="progress__label">{progressLabel}</span>
        </div>
      )}
      {message && (
        <div className={`notice ${status === 'failed' ? 'notice--warning' : 'notice--info'} uploader__message`} role="status">
          {message}
        </div>
      )}
      {imageUrl && (
        <button
          type="button"
          className={`uploader__preview${expanded ? ' is-expanded' : ''}`}
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse screenshot' : 'Expand screenshot'}
        >
          <img src={imageUrl} alt="Imported screenshot" />
          <span className="uploader__toggle">{expanded ? 'Tap to collapse' : 'Tap to expand'}</span>
        </button>
      )}
    </div>
  );
}
