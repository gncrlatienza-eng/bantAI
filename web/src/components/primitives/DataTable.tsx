import React from 'react';
import { LoadingState } from './LoadingState';
import { Skeleton } from './Skeleton';
import { SortIcon, SortAscIcon, SortDescIcon } from './icons';

/*
 * DataTable: the analyst's main surface for messages, campaigns, users, logs.
 *
 * Requirements from Section 25:
 *   - Sticky header on scroll (handled in primitives.css via position: sticky).
 *   - Sortable columns (opt-in per column).
 *   - Right-align numeric columns.
 *   - Truncation for long text cells.
 *   - Clear hover.
 *   - Selected row visual without threat colors.
 *   - Empty, loading, error states.
 *   - Real semantic <table> markup for keyboard + screen reader users.
 *
 * Sorting is controlled: parent owns `sortKey` and `sortDirection` and reacts
 * to `onSortChange`. This lets the parent sync sort state to URL query params.
 *
 * Selection is single-row for now. Multi-row selection with a checkbox column
 * is a follow-up when a screen requires bulk actions.
 */

export type Align = 'left' | 'right' | 'center';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: Align;
  headerAlign?: Align;
  sortable?: boolean;
  truncate?: boolean;
  width?: string;
}

export type SortDirection = 'asc' | 'desc';

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  ariaLabel: string;
  onRowClick?: (row: T) => void;
  activeRowKey?: string | number;
  loading?: boolean;
  loadingRows?: number;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSortChange?: (key: string, direction: SortDirection) => void;
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <span className="bantai-p-table__sort-indicator" aria-hidden>
      {!active ? (
        <SortIcon />
      ) : direction === 'asc' ? (
        <SortAscIcon />
      ) : (
        <SortDescIcon />
      )}
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  onRowClick,
  activeRowKey,
  loading = false,
  loadingRows = 6,
  emptyState,
  errorState,
  sortKey,
  sortDirection = 'asc',
  onSortChange,
}: DataTableProps<T>) {
  if (errorState) {
    return (
      <div className="bantai-p-table-wrap">
        <div className="bantai-p-table__state">{errorState}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bantai-p-table-wrap">
        <table
          className="bantai-p-table"
          aria-label={ariaLabel}
          aria-busy="true"
        >
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-align={col.headerAlign ?? col.align ?? 'left'}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} data-align={col.align ?? 'left'}>
                    <Skeleton
                      height={14}
                      width={col.align === 'right' ? 72 : '80%'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 12 }}>
          <LoadingState label="Loading rows..." />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bantai-p-table-wrap">
        <div className="bantai-p-table__state">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className="bantai-p-table-wrap">
      <table className="bantai-p-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((col) => {
              const align = col.headerAlign ?? col.align ?? 'left';
              const isSortActive = sortKey === col.key;
              if (col.sortable && onSortChange) {
                const nextDir: SortDirection =
                  isSortActive && sortDirection === 'asc' ? 'desc' : 'asc';
                return (
                  <th
                    key={col.key}
                    data-align={align}
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      isSortActive
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="bantai-p-table__sort-btn"
                      onClick={() => onSortChange(col.key, nextDir)}
                    >
                      <span>{col.header}</span>
                      <SortIndicator
                        active={isSortActive}
                        direction={sortDirection}
                      />
                    </button>
                  </th>
                );
              }
              return (
                <th
                  key={col.key}
                  data-align={align}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const isActive = activeRowKey != null && activeRowKey === key;
            const clickable = onRowClick != null;
            return (
              <tr
                key={key}
                className={clickable ? 'is-clickable' : undefined}
                aria-selected={isActive || undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    data-align={col.align ?? 'left'}
                    className={
                      col.truncate
                        ? 'bantai-p-table__cell--truncate'
                        : undefined
                    }
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
