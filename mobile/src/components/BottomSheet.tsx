import type { ReactNode } from "react";

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
