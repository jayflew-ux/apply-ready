import { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20">
      <div
        className="absolute inset-0 bg-teal-deeper/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={[
          'relative bg-linen border border-[#e5e5e0] rounded-sm shadow-xl w-full max-h-[80vh] overflow-y-auto',
          wide ? 'max-w-3xl' : 'max-w-xl',
        ].join(' ')}
      >
        <div className="sticky top-0 bg-linen z-10 flex items-center justify-between px-6 py-4 border-b border-[#e5e5e0]">
          {title && (
            <h2 className="font-montserrat font-bold text-base text-ink tracking-wide">{title}</h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-sm text-ink/40 hover:text-ink transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
