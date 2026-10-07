import React, { forwardRef, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Universal Button Component for the application.
 * 
 * Guarantees:
 * - 1 click -> 1 immediate action (no double-click requirement)
 * - touch-manipulation to eliminate 300ms mobile tap delay
 * - Asynchronous execution protection against accidental double submissions
 * - Full accessibility (keyboard Enter/Space, aria props, disabled semantics)
 * - Curated variants and sizes matching the app design system
 */

const VARIANTS = {
  primary: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm shadow-red-600/20 border border-transparent',
  danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm shadow-red-600/20 border border-transparent',
  dark: 'bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white shadow-sm border border-slate-800',
  secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-transparent',
  outline: 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs',
  ghost: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-transparent',
  success: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm shadow-emerald-600/20 border border-transparent',
  icon: 'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-500 hover:text-slate-800 border border-transparent'
};

const SIZES = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1.5',
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5 font-medium',
  md: 'px-4 py-2 text-xs sm:text-sm rounded-xl gap-2 font-semibold',
  lg: 'px-5 py-2.5 text-xs sm:text-sm rounded-xl gap-2.5 font-semibold',
  icon: 'p-1.5 rounded-xl shrink-0'
};

const Button = forwardRef(function Button(
  {
    children,
    type = 'button',
    variant,
    size,
    loading = false,
    loadingText,
    disabled = false,
    onClick,
    icon: IconProp = null,
    iconPosition = 'left',
    className = '',
    style = {},
    ...props
  },
  ref
) {
  const [internalLoading, setInternalLoading] = useState(false);
  const isExecutingRef = useRef(false);

  const isActuallyLoading = loading || internalLoading;
  const isActuallyDisabled = disabled || isActuallyLoading;

  const handleClick = useCallback(
    async (event) => {
      if (isActuallyDisabled || isExecutingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (onClick) {
        try {
          const result = onClick(event);
          // If onClick returns a promise, protect against multiple fast clicks while promise resolves
          if (result && typeof result.then === 'function') {
            isExecutingRef.current = true;
            setInternalLoading(true);
            await result;
          }
        } catch (err) {
          console.error('Error during button click execution:', err);
        } finally {
          isExecutingRef.current = false;
          setInternalLoading(false);
        }
      }
    },
    [isActuallyDisabled, onClick]
  );

  // Determine base styling classes based on variant & size (or custom className override)
  const variantClass = variant && VARIANTS[variant] ? VARIANTS[variant] : '';
  const sizeClass = size && SIZES[size] ? SIZES[size] : '';

  // Render Icon helper
  const renderIcon = () => {
    if (!IconProp) return null;
    if (React.isValidElement(IconProp)) {
      return <span className="shrink-0">{IconProp}</span>;
    }
    if (typeof IconProp === 'function') {
      const Comp = IconProp;
      return <Comp size={15} className="shrink-0" />;
    }
    return null;
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isActuallyDisabled}
      onClick={handleClick}
      aria-busy={isActuallyLoading}
      aria-disabled={isActuallyDisabled}
      className={`inline-flex items-center justify-center select-none touch-manipulation transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      style={{
        WebkitTapHighlightColor: 'transparent',
        ...style
      }}
      {...props}
    >
      {isActuallyLoading ? (
        <>
          <Loader2 size={14} className="animate-spin shrink-0" />
          {loadingText ? <span>{loadingText}</span> : children ? <span>{children}</span> : null}
        </>
      ) : (
        <>
          {iconPosition === 'left' && renderIcon()}
          {children}
          {iconPosition === 'right' && renderIcon()}
        </>
      )}
    </button>
  );
});

export default Button;
