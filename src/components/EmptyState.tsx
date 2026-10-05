import type { ReactNode } from 'react';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        ✦
      </div>
      <h2 className="empty-state__title">{title}</h2>
      {children && <div className="empty-state__body">{children}</div>}
    </div>
  );
}
