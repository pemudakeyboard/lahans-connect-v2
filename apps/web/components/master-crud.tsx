'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/data-table';
import { masterCreate, masterDelete, masterList, masterUpdate } from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email';
  required?: boolean;
  placeholder?: string;
  /** For temporal entities, include asOf date with the payload. */
}

interface MasterCrudProps<T extends { id: string }> {
  entity: string;
  title: string;
  columns: Column<T>[];
  fields: FieldDef[];
  /** Temporal entities (Class A/B) require asOf on read (BRD 4.5.1). */
  temporal?: boolean;
  canWrite: boolean;
}

export function MasterCrud<T extends { id: string }>({
  entity,
  title,
  columns,
  fields,
  temporal = false,
  canWrite,
}: MasterCrudProps<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [asOf, setAsOf] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (p: number, s: string, a: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await masterList<T>(entity, {
          page: p,
          pageSize,
          ...(s ? { search: s } : {}),
          ...(temporal ? { asOf: a } : {}),
        });
        setRows(res.rows);
        setTotal(res.total);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data.');
      } finally {
        setLoading(false);
      }
    },
    [entity, pageSize, temporal],
  );

  useEffect(() => {
    void load(page, search, asOf);
  }, [load, page, search, asOf]);

  function openCreate() {
    setEditing(null);
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = '';
    setForm(init);
    setOpen(true);
  }

  function openEdit(row: T) {
    setEditing(row);
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.name] = String((row as Record<string, unknown>)[f.name] ?? '');
    }
    setForm(init);
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = form[f.name];
      if (v === '') continue;
      payload[f.name] = f.type === 'number' ? Number(v) : v;
    }
    try {
      if (editing) {
        await masterUpdate(entity, editing.id, payload);
      } else {
        await masterCreate(entity, payload);
      }
      setOpen(false);
      void load(page, search, asOf);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan data.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(row: T) {
    if (!confirm(`Hapus ${title} ini?`)) return;
    setError(null);
    try {
      await masterDelete(entity, row.id);
      void load(page, search, asOf);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus data.');
    }
  }

  const actionCol: Column<T> = {
    key: 'actions',
    header: '',
    className: 'w-20',
    render: (row) => (
      <div className="flex items-center gap-1">
        {canWrite && (
          <>
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(row)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">M1B — master data</p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Tambah
          </Button>
        )}
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <DataTable<T>
        columns={[...columns, actionCol]}
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
          void load(1, v, asOf);
        }}
        onPageChange={(p) => setPage(p)}
        asOf={temporal ? asOf : undefined}
        onAsOfChange={(v) => {
          setAsOf(v);
          void load(1, search, v);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>{editing ? `Ubah ${title}` : `Tambah ${title}`}</DialogTitle>
              <DialogDescription>Isi data berikut.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-4">
              {fields.map((f) => (
                <div
                  key={f.name}
                  className={
                    f.name === 'legal_name' || f.name === 'full_name'
                      ? 'col-span-2 space-y-2'
                      : 'space-y-2'
                  }
                >
                  <Label htmlFor={`field-${f.name}`}>{f.label}</Label>
                  <Input
                    id={`field-${f.name}`}
                    type={f.type ?? 'text'}
                    value={form[f.name] ?? ''}
                    onChange={(ev) => setForm({ ...form, [f.name]: ev.target.value })}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
