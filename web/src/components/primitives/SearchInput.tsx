import React from 'react';
import { SearchIcon, ClearIcon } from './icons';

interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput(
    { value, onChange, onClear, placeholder = 'Search', ...rest },
    ref,
  ) {
    const showClear =
      onClear != null && typeof value === 'string' && value.length > 0;
    return (
      <div className="bantai-p-search">
        <span className="bantai-p-search__icon" aria-hidden>
          <SearchIcon />
        </span>
        <input
          ref={ref}
          type="search"
          className="bantai-p-input bantai-p-search__input"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          {...rest}
        />
        {showClear && (
          <button
            type="button"
            className="bantai-p-search__clear"
            aria-label="Clear search"
            onClick={onClear}
          >
            <ClearIcon />
          </button>
        )}
      </div>
    );
  },
);
