import React from 'react';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'destructive' | 'destructive-confirm';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      leadingIcon,
      trailingIcon,
      children,
      type = 'button',
      ...rest
    },
    ref,
  ) {
    const classes = [
      'bantai-p-btn',
      `bantai-p-btn--${variant}`,
      size !== 'md' && `bantai-p-btn--size-${size}`,
      fullWidth && 'bantai-p-btn--full',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button ref={ref} type={type} className={classes} {...rest}>
        {leadingIcon && <span aria-hidden>{leadingIcon}</span>}
        {children}
        {trailingIcon && <span aria-hidden>{trailingIcon}</span>}
      </button>
    );
  },
);
