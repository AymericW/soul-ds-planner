import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Modals can stack (edit sheet + delete confirmation), so the body scroll lock is reference-counted:
// restoring a per-modal "previous" value would leave the page locked when they close together.
let openModals = 0;
let overflowBeforeLock = '';

/** Bottom-sheet style dialog (mobile friendly), closes on Escape or backdrop tap. */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    if (openModals === 0) overflowBeforeLock = document.body.style.overflow;
    openModals += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      openModals -= 1;
      if (openModals === 0) document.body.style.overflow = overflowBeforeLock;
    };
  }, []);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
