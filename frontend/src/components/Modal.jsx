import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons.jsx';

export default function Modal({ open, onClose, title, children }) {
  const backdropRef = useRef(null);
  const [mainEl, setMainEl] = useState(null);
  const titleId = useId();

  useEffect(() => {
    setMainEl(document.querySelector('main'));
  }, []);

  useEffect(() => {
    if (!open || !mainEl) return;
    mainEl.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      mainEl.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, mainEl]);

  if (!open || !mainEl) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="sticky inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-[2px] animate-fade-in"
      style={{ top: 0, height: '100%', marginTop: `-${mainEl.scrollTop}px` }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card-gradient rounded-2xl shadow-overlay border border-divider/60 w-full max-w-lg mx-4 animate-fade-up"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-divider/60">
          <h2 id={titleId} className="text-base font-semibold text-ink tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="btn-press hit-target w-8 h-8 flex items-center justify-center rounded-lg text-ink-tertiary hover:text-ink-secondary hover:bg-elevated/50"
          >
            <XIcon />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>,
    mainEl
  );
}
