import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable LoadingButton component with spinner, disabled state, and custom text.
 * Prevents multiple clicks while API requests are pending.
 */
export default function LoadingButton({
  loading = false,
  loadingText = 'Processing...',
  disabled = false,
  children,
  type = 'button',
  className = '',
  onClick,
  icon = null,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}
