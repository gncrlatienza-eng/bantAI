import React from 'react';

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'className'
> {
  label?: string;
  helpText?: string;
  error?: string;
  fieldId?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, helpText, error, fieldId, id, ...rest }, ref) {
    const reactId = React.useId();
    const inputId = id ?? fieldId ?? `bantai-input-${reactId}`;
    const helpId = helpText ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [errorId, helpId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="bantai-p-field">
        {label && (
          <label htmlFor={inputId} className="bantai-p-field__label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className="bantai-p-input"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {error && (
          <span id={errorId} className="bantai-p-field__error" role="alert">
            {error}
          </span>
        )}
        {helpText && !error && (
          <span id={helpId} className="bantai-p-field__help">
            {helpText}
          </span>
        )}
      </div>
    );
  },
);
