import React, { forwardRef } from 'react';
import Button from './Button';

/**
 * Reusable LoadingButton component.
 * Wraps universal Button component for full backward-compatibility and single-click reliability.
 */
const LoadingButton = forwardRef(function LoadingButton(
  {
    loading = false,
    loadingText = 'Processing...',
    disabled = false,
    children,
    type = 'button',
    className = '',
    onClick,
    icon = null,
    variant,
    size,
    ...props
  },
  ref
) {
  return (
    <Button
      ref={ref}
      type={type}
      loading={loading}
      loadingText={loadingText}
      disabled={disabled}
      onClick={onClick}
      icon={icon}
      variant={variant}
      size={size}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
});

export default LoadingButton;

