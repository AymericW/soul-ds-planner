interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export function ToastHost({ toasts, onDismiss }: { toasts: readonly ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span className="toast__message">{t.message}</span>
          <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
