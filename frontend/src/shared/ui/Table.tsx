import React, { useState, useMemo, useDeferredValue } from 'react';
import { EmptyState } from './Feedback';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyField?: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  emptyAction?: React.ReactNode;
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
    secondaryGuidance?: string;
    tips?: string[];
  };
  actions?: React.ReactNode;
  loading?: boolean;
  // Server-side mode: when the parent passes `onSearchChange` / `onSortChange`
  // the rows are already filtered and ordered by the server, so the table
  // stops filtering and sorting on its own (it would only see one page).
  search?: string;
  onSearchChange?: (value: string) => void;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc' | null;
  onSortChange?: (key: string | null, dir: 'asc' | 'desc' | null) => void;
  // Total row count for the footer (the loaded rows are only one page).
  totalCount?: number | undefined;
}

type SortDir = 'asc' | 'desc' | null;

function Table<T extends object>({
  columns,
  data,
  keyField,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No records found',
  emptySubMessage = '',
  emptyAction,
  emptyState,
  actions,
  loading = false,
  search: searchProp,
  onSearchChange,
  sortKey: sortKeyProp,
  sortDir: sortDirProp,
  onSortChange,
  totalCount,
}: TableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<SortDir>(null);
  const [internalSearch, setInternalSearch] = useState('');
  const deferredSearch            = useDeferredValue(internalSearch);

  const sortKey = onSortChange ? (sortKeyProp ?? null) : internalSortKey;
  const sortDir = onSortChange ? (sortDirProp ?? null) : internalSortDir;
  const searchValue = onSearchChange ? (searchProp ?? '') : internalSearch;

  const handleSort = (key: string) => {
    const currentKey = sortKey;
    const currentDir = sortDir;
    const nextKey = currentKey !== key ? key : currentDir === 'asc' ? key : null;
    const nextDir = currentKey !== key ? 'asc' : currentDir === 'asc' ? 'desc' : null;
    if (onSortChange) {
      onSortChange(nextKey, nextDir);
      return;
    }
    setInternalSortKey(nextKey);
    setInternalSortDir(nextDir);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getValue = (row: T, key: string): unknown => (row as any)[key];

  const sorted = useMemo(() => {
    const cleanQuery = deferredSearch.trim().toLowerCase();
    const filtered =
      searchable && cleanQuery && !onSearchChange
        ? data.filter(row =>
            columns.some(col => {
              const val = getValue(row, String(col.key));
              return typeof val === 'string' && val.toLowerCase().includes(cleanQuery);
            })
          )
        : data;

    const activeSortKey = sortKey && !onSortChange ? sortKey : null;

    return activeSortKey
      ? [...filtered].sort((a, b) => {
          const av = getValue(a, activeSortKey);
          const bv = getValue(b, activeSortKey);
          if (typeof av === 'string' && typeof bv === 'string') {
            return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
          }
          if (typeof av === 'number' && typeof bv === 'number') {
            return sortDir === 'asc' ? av - bv : bv - av;
          }
          return 0;
        })
      : filtered;
  }, [data, searchable, deferredSearch, columns, sortKey, sortDir, onSearchChange, onSortChange]);

  /* ── Sort Icon ──────────────────────────────────────────────────────────── */
  const SortIcon = ({ col }: { col: ColumnDef<T> }) => {
    if (!col.sortable) return null;
    const active = sortKey === col.key;
    return (
      <span
        className={`ml-1 inline-flex shrink-0 transition-opacity duration-100 ${
          active ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-40'
        }`}
        aria-hidden="true"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          {active && sortDir === 'desc' ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          )}
        </svg>
      </span>
    );
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {searchable && (
            <div className="relative max-w-xs w-full">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={e => {
                  const value = e.target.value;
                  if (onSearchChange) onSearchChange(value);
                  else setInternalSearch(value);
                }}
                className="h-9 w-full rounded-md bg-background border border-border pl-8 pr-8 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground/40 text-foreground transition-colors"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    if (onSearchChange) onSearchChange('');
                    else setInternalSearch('');
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded cursor-pointer transition-colors"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
      )}

      {/* Table wrapper */}
      <div className="overflow-x-auto max-h-150 overflow-y-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface/60 sticky top-0 z-10">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  style={col.width ? { width: col.width } : undefined}
                  className={`group px-4 py-3 text-[11px] font-medium text-muted-foreground whitespace-nowrap select-none tracking-wide ${
                    col.sortable ? 'cursor-pointer hover:text-foreground' : ''
                  } ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : ''
                  }`}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {loading ? (
              Array.from({ length: 5 }).map((_, ri) => (
                <tr key={ri}>
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-4">
                      <div
                        className={`h-3 bg-secondary animate-pulse rounded-sm ${ci % 2 === 0 ? 'w-[12ch]' : 'w-[16ch]'}`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 px-4 text-center">
                  {emptyState ? (
                    <EmptyState {...emptyState} />
                  ) : (
                    <EmptyState 
                      title={emptyMessage} 
                      description={emptySubMessage} 
                      action={emptyAction}
                    />
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row, ri) => (
                <tr
                  key={keyField ? String(getValue(row, String(keyField))) : ri}
                  className="hover:bg-muted/30 transition-colors duration-80"
                >
                  {columns.map(col => {
                    const cellVal = getValue(row, String(col.key));
                    return (
                      <td
                        key={String(col.key)}
                        className={`px-4 py-3.5 text-[13px] text-foreground ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : ''
                        }`}
                      >
                        {col.render ? col.render(row) : String(cellVal ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Count footer */}
      {sorted.length > 0 && (
        <p className="text-[11px] text-muted-foreground px-0.5">
          {totalCount ?? sorted.length} {(totalCount ?? sorted.length) === 1 ? 'record' : 'records'}
          {searchValue ? ` · matching "${searchValue}"` : ''}
        </p>
      )}
    </div>
  );
}

export { Table };
export default Table;
