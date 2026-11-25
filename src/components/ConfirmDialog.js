'use client';

import { useEffect } from 'react';

/**
 * Dialog konfirmasi kecil (pengganti window.confirm bawaan browser).
 * Ikut tema terang/gelap karena memakai class yang sama dengan komponen lain.
 */
export default function ConfirmDialog({
  open,
  title = 'Konfirmasi',
  message,
  note,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'danger',
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape' && !loading) onCancel();
    }

    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const isDanger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
              isDanger ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
            }`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-800">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="text-sm text-slate-600 mt-1">
              {message}
            </p>
            {note && <p className="text-xs font-medium text-red-600 mt-2">{note}</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}