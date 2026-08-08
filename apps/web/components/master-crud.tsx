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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** A dropdown option: value is the stored FK id, label is what the user sees. */
export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email';
  required?: boolean;
  placeholder?: string;
  /**
   * Render as a dropdown instead of a text input. FK fields (e.g. company_id on
   * branches) must show the referenced entity's name, never a raw UUID.
   * `entity` = master entity to fetch options from (e.g. "companies").
   * `valueField`/`labelField` = which fields become the option value/label.
   */
  select?: { entity: string; valueField: string; labelField: string };
  /** Static options when no master fetch is needed. */
  options?: SelectOption[];
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
  // Cache of dropdown options keyed by the master entity that provides them.
  const [optionsCache, setOptionsCache] = useState<Record<string, SelectOption[]>>({});

  // Load FK dropdown options (companies, branches, job grades, ...) once per entity.
  useEffect(() => {
    const needs: string[] = [];
    for (const f of fields) {
      if (f.select?.entity && !(f.select.entity in optionsCache)) {
        needs.push(f.select.entity);
      }
    }
    if (needs.length === 0) return;
    void Promise.all(
      needs.map(async (entity) => {
        try {
          const res = await masterList<Record<string, unknown>>(entity, { pageSize: 100 });
          const f = fields.find((x) => x.select?.entity === entity);
          const opts: SelectOption[] = res.rows.map((r) => ({
            value: String(r[f!.select!.valueField]),
            label: String(r[f!.select!.labelField] ?? ''),
          }));
          setOptionsCache((prev) => ({ ...prev, [entity]: opts }));
        } catch {
          setOptionsCache((prev) => ({ ...prev, [entity]: [] }));
        }
      }),
    );
  }, [fields, optionsCache]);

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
      const raw = (row as Record<string, unknown>)[f.name];
      if (raw == null) {
        init[f.name] = '';
      } else if (f.type === 'date') {
        // Prisma returns ISO datetime; <input type="date"> needs YYYY-MM-DD.
        init[f.name] = String(raw).slice(0, 10);
      } else {
        init[f.name] = String(raw);
      }
    }
    setForm(init);
    setOpen(true);
  }

  async function onSave(e: React.SubmitEvent<HTMLFormElement>) {
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
                  {f.select || f.options ? (
                    <Select
                      value={form[f.name] ?? ''}
                      onValueChange={(v) => setForm({ ...form, [f.name]: v })}
                    >
                      <SelectTrigger id={`field-${f.name}`} className="w-full">
                        <SelectValue placeholder={f.placeholder ?? 'Pilih…'} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? optionsCache[f.select?.entity ?? ''] ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={`field-${f.name}`}
                      type={f.type ?? 'text'}
                      value={form[f.name] ?? ''}
                      onChange={(ev) => setForm({ ...form, [f.name]: ev.target.value })}
                      placeholder={f.placeholder}
                      required={f.required}
                    />
                  )}
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
