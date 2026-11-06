import React, { useId, useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isPassword?: boolean;
  area?: boolean;
  rows?: number;
  helpText?: React.ReactNode;
  /* Optional control rendered on the label row, right-aligned (e.g. a
     "Forgot password?" link). */
  labelAction?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  isPassword = false,
  area = false,
  rows = 3,
  helpText,
  labelAction,
  className = '',
  type = 'text',
  id,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="form-group">
      {(label || labelAction) && (
        <div className="form-label-row">
          {label && (
            <label className="form-label" htmlFor={inputId}>
              <span>{label}</span>
            </label>
          )}
          {labelAction}
        </div>
      )}
      <div
        className={`form-input-wrap${isPassword ? ' form-input-wrap--password' : ''}`}
      >
        {area ? (
          <textarea
            id={inputId}
            className={`form-input ${error ? 'error' : ''} ${className}`.trim()}
            rows={rows}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            type={inputType}
            className={`form-input ${error ? 'error' : ''} ${className}`.trim()}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...props}
          />
        )}
        {isPassword && (
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            aria-controls={inputId}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="error-text">
          {error}
        </span>
      )}
      {helpText && !error && (
        <span id={helpId} className="form-help-text">
          {helpText}
        </span>
      )}
    </div>
  );
};

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}
