'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  onPageChange?: (page: number) => void;
  asOf?: string;
  onAsOfChange?: (value: string) => void;
  emptyMessage?: string;
  /** When set, rows become clickable (e.g. navigate to a detail page). */
  onRowClick?: (row: T) => void;
  /** Enables a selection checkbox column (bulk actions). */
  selectable?: boolean;
  /** Selected row ids (controlled). */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** Rows that can't be checked (e.g. already inactive employees). */
  isRowSelectable?: (row: T) => boolean;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  total,
  page,
  pageSize,
  loading,
  search,
  onSearch,
  onPageChange,
  asOf,
  onAsOfChange,
  emptyMessage = 'Tidak ada data.',
  onRowClick,
  selectable,
  selectedIds,
  onSelectionChange,
  isRowSelectable,
}: DataTableProps<T>) {
  const [searchDraft, setSearchDraft] = useState(search ?? '');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const colCount = columns.length + (selectable ? 1 : 0);

  // Selection helpers (only when selectable).
  const selected = selectedIds ?? new Set<string>();
  const selectableRows = isRowSelectable ? rows.filter((r) => isRowSelectable(r)) : rows;
  const allSelected =
    selectable && selectableRows.length > 0 && selectableRows.every((r) => selected.has(r.id));
  const someSelected = selectable && selectableRows.some((r) => selected.has(r.id)) && !allSelected;

  const toggleId = (id: string, on: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelectionChange(next);
  };

  const togglePage = (on: boolean) => {
    if (!onSelectionChange) return;
    const next = new Set(selected);
    for (const r of selectableRows) {
      if (on) next.add(r.id);
      else next.delete(r.id);
    }
    onSelectionChange(next);
  };

  return (
    <div className="space-y-3">
      {(onSearch || onAsOfChange) && (
        <div className="flex flex-wrap items-center gap-2">
          {onSearch && (
            <Input
              placeholder="Cari…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch(searchDraft);
              }}
              className="max-w-xs"
            />
          )}
          {onAsOfChange && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">As of</span>
              <Input
                type="date"
                value={asOf ?? ''}
                onChange={(e) => onAsOfChange(e.target.value)}
                className="w-40"
              />
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Pilih semua di halaman ini"
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectableRows.length === 0}
                    onChange={(e) => togglePage(e.target.checked)}
                  />
                </TableHead>
              )}
              {columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  <Loader2 className="text-muted-foreground mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-muted-foreground h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const rowSelectable = isRowSelectable ? isRowSelectable(row) : true;
                const checked = selected.has(row.id);
                return (
                  <TableRow
                    key={row.id}
                    className={onRowClick ? 'cursor-pointer' : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable && (
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label="Pilih baris"
                          checked={checked}
                          disabled={!rowSelectable}
                          onChange={(e) => toggleId(row.id, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    {columns.map((c) => (
                      <TableCell key={c.key} className={c.className}>
                        {c.render
                          ? c.render(row)
                          : String((row as Record<string, unknown>)[c.key] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {total} data · halaman {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Sebelum
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Berikut <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
