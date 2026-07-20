import React, { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EmptyState } from './Feedback';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
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
  emptyState,
  actions,
  loading = false,
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [search, setSearch] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getValue = (row: T, key: string): unknown => (row as any)[key];

  const filtered = searchable && search.trim()
    ? data.filter(row =>
        columns.some(col => {
          const val = getValue(row, String(col.key));
          return typeof val === 'string' && val.toLowerCase().includes(search.toLowerCase());
        })
      )
    : data;

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const av = getValue(a, sortKey);
        const bv = getValue(b, sortKey);
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        return 0;
      })
    : filtered;

  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const paddingTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0;

  const SortIcon = ({ col }: { col: ColumnDef<T> }) => {
    if (!col.sortable) return null;
    const isActive = sortKey === col.key;
    return (
      <span className={`ml-1 inline-block transition-opacity duration-150 ${isActive ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-40'}`}>
        {isActive && sortDir === 'desc' ? '↓' : '↑'}
      </span>
    );
  };

  return (
    <div className="space-y-3.5">
      {(searchable || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {searchable && (
            <div className="relative max-w-xs w-full">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8.5 w-full rounded-md bg-background border border-border pl-9 pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-muted-foreground/50 text-foreground transition-all shadow-sm"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div 
        ref={parentRef}
        className="overflow-x-auto max-h-[600px] overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
      >
        <table className="w-full text-body border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-surface/50">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  className={`group px-4 py-3 text-label whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''
                  } ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                >
                  <span className="inline-flex items-center">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {loading ? (
              Array.from({ length: 4 }).map((_, ri) => (
                <tr key={ri} className="hover:bg-surface/30">
                  {columns.map((_, ci) => (
                    <td key={ci} className="px-4 py-3.5">
                      <div className="h-3 bg-secondary animate-pulse rounded" style={{ width: `${60 + (ci * 7) % 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  {emptyState ? (
                    <EmptyState {...emptyState} />
                  ) : (
                    <EmptyState
                      title={emptyMessage}
                      description={emptySubMessage}
                    />
                  )}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td colSpan={columns.length} style={{ height: `${paddingTop}px` }} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const row = sorted[virtualRow.index]!;
                  const ri = virtualRow.index;
                  return (
                    <tr
                      key={keyField ? String(getValue(row, String(keyField))) : ri}
                      className="hover:bg-surface/30 transition-colors duration-150"
                    >
                      {columns.map(col => {
                        const cellVal = getValue(row, String(col.key));
                        return (
                          <td
                            key={String(col.key)}
                            className={`px-4 py-3.5 text-foreground text-small font-normal ${
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                            }`}
                          >
                            {col.render ? col.render(row) : String(cellVal ?? '—')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td colSpan={columns.length} style={{ height: `${paddingBottom}px` }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {sorted.length > 0 && (
        <p className="text-[11px] text-muted-foreground font-medium px-1">
          {sorted.length} {sorted.length === 1 ? 'record' : 'records'}{search ? ` matching "${search}"` : ''}
        </p>
      )}
    </div>
  );
}

export { Table };
export default Table;
