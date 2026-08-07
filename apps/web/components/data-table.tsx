'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
}: DataTableProps<T>) {
  const [searchDraft, setSearchDraft] = useState(search ?? '');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
              <span className="text-sm text-muted-foreground">As of</span>
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
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {onPageChange && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} data · halaman {page}/{totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
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