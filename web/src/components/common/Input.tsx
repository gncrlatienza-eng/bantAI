import React, { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  isPassword?: boolean;
  area?: boolean;
  rows?: number;
  helpText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  isPassword = false,
  area = false,
  rows = 3,
  helpText,
  className = '',
  type = 'text',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          <span>{label}</span>
        </label>
      )}
      <div className="form-input-wrap">
        {area ? (
          <textarea
            className={`form-input ${error ? 'error' : ''} ${className}`.trim()}
            rows={rows}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            type={inputType}
            className={`form-input ${error ? 'error' : ''} ${className}`.trim()}
            {...props}
          />
        )}
        {isPassword && (
          <button
            type="button"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && <span className="error-text">{error}</span>}
      {helpText && !error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {helpText}
        </span>
      )}
    </div>
  );
};
