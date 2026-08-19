import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

const ConfirmContext = createContext();

export function ConfirmDialogProvider({ children }) {
  const [dialogConfig, setDialogConfig] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogConfig({
        title: options.title || 'Are you sure?',
        message: options.message || 'Please confirm your action.',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'default', // 'danger' | 'default'
        resolve
      });
    });
  }, []);

  const handleClose = (result) => {
    if (dialogConfig && dialogConfig.resolve) {
      dialogConfig.resolve(result);
    }
    setDialogConfig(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialogConfig && (
        <ConfirmDialogModal config={dialogConfig} onClose={handleClose} />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  }
  return context;
}

function ConfirmDialogModal({ config, onClose }) {
  const { title, message, confirmLabel, cancelLabel, variant } = config;
  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-semibold flex-shrink-0 ${
              isDanger ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
            }`}>
              {isDanger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-normal">{message}</p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-600/20'
                : 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 shadow-slate-900/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
