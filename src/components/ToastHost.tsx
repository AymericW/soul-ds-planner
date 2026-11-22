import { t } from '@/helpers/i18n';
interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

export function ToastHost({ toasts, onDismiss }: { toasts: readonly ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
          <span className="toast__message">{toast.message}</span>
          <button type="button" className="icon-button" aria-label={t().common.dismiss} onClick={() => onDismiss(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
