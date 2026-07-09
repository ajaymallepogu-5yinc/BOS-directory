interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-ink-150 bg-white p-6 shadow-xl animate-slide-up">
        {/* Header section with icon */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isDestructive 
              ? "bg-rose-50 border-rose-100 text-rose-600" 
              : "bg-amber-50 border-amber-100 text-amber-600"
          }`}>
            {isDestructive ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-ink-900 leading-tight">{title}</h3>
            <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-ink-150">
          <button
            type="button"
            onClick={onCancel}
            className="py-2 px-4 rounded-xl border border-ink-200 bg-white text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-all cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`py-2 px-4 rounded-xl text-xs font-semibold text-white transition-all shadow-md cursor-pointer ${
              isDestructive 
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/10" 
                : "bg-brand hover:bg-brand/90 shadow-brand/10"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
