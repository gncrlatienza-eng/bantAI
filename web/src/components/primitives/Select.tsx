import React from 'react';

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'className'
> {
  label?: string;
  helpText?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, helpText, error, options, placeholder, id, ...rest },
    ref,
  ) {
    const reactId = React.useId();
    const selectId = id ?? `bantai-select-${reactId}`;
    const helpId = helpText ? `${selectId}-help` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;
    const describedBy =
      [errorId, helpId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="bantai-p-field">
        {label && (
          <label htmlFor={selectId} className="bantai-p-field__label">
            {label}
          </label>
        )}
        <div className="bantai-p-select-wrap">
          <select
            ref={ref}
            id={selectId}
            className="bantai-p-select"
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
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
