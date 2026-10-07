import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, HelpCircle, Info, X } from 'lucide-react';
import Button from '../components/ui/Button';

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

  const getConfirmVariant = () => {
    if (isDanger) return 'danger';
    if (isWarning) return 'primary';
    return 'dark';
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isProcessing}
            onClick={() => onClose(false)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isProcessing}
            onClick={() => onClose(false)}
            className="text-slate-600 hover:bg-slate-100"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={getConfirmVariant()}
            size="sm"
            loading={isProcessing}
            loadingText="Processing..."
            onClick={handleConfirmClick}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
