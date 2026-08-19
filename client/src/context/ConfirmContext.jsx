import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';

const ConfirmContext = createContext();

export function ConfirmDialogProvider({ children }) {
  const [dialogConfig, setDialogConfig] = useState(null);

  /**
   * Reusable confirm helper supporting Promise API or onConfirm callback
   * Usage:
   * 1. const isConfirmed = await confirm({ title: 'Delete Item', message: '...', variant: 'danger' });
   * 2. confirm({ title: 'Logout', message: '...', onConfirm: async () => { ... } });
   */
  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialogConfig({
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || options.type || 'default', // 'danger' | 'warning' | 'default'
        onConfirm: options.onConfirm || null,
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

/**
 * Reusable Confirm Dialog Modal Component with Loading State & Variant Styling
 */
function ConfirmDialogModal({ config, onClose }) {
  const { title, message, confirmLabel, cancelLabel, variant, onConfirm } = config;
  const [isProcessing, setIsProcessing] = useState(false);

  const isDanger = variant === 'danger';
  const isWarning = variant === 'warning';

  const handleConfirmClick = async () => {
    if (isProcessing) return;

    if (onConfirm && typeof onConfirm === 'function') {
      try {
        setIsProcessing(true);
        await onConfirm();
        onClose(true);
      } catch (err) {
        console.error('Error in confirm action:', err);
        setIsProcessing(false);
      }
    } else {
      onClose(true);
    }
  };

  const getHeaderIcon = () => {
    if (isDanger) {
      return (
        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={20} />
        </div>
      );
    }
    if (isWarning) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={20} />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center flex-shrink-0">
        <HelpCircle size={20} />
      </div>
    );
  };

  const getConfirmButtonStyles = () => {
    if (isDanger) {
      return 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/20';
    }
    if (isWarning) {
      return 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/20';
    }
    return 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-slate-900/20';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto scrollbar-hide animate-scale-up select-none">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {getHeaderIcon()}
            <div>
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
              <p className="text-xs text-slate-500 mt-1 font-normal leading-relaxed">{message}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onClose(false)}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleConfirmClick}
            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${getConfirmButtonStyles()}`}
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
