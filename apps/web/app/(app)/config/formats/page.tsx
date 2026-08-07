'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteFormat, listFormats, upsertFormat, type FormatSetting } from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';

const EMPTY_FORM: Omit<FormatSetting, 'updated_at'> = {
  format_key: '',
  format_value: '',
  data_type: 'STRING',
  applies_to: 'BOTH',
  is_editable: true,
};

export default function FormatsPage() {
  const [formats, setFormats] = useState<FormatSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<FormatSetting, 'updated_at'>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setFormats(await listFormats());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat format.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsertFormat(form.format_key, {
        format_value: form.format_value,
        data_type: form.data_type,
        applies_to: form.applies_to,
        is_editable: form.is_editable,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan format.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(formatKey: string) {
    if (!confirm(`Hapus format ${formatKey}?`)) return;
    setError(null);
    try {
      await deleteFormat(formatKey);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus format.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Format</h1>
          <p className="text-muted-foreground text-sm">
            M8B — tanggal, mata uang, dan angka (FR-M8B-001..003)
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah Format
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunci</TableHead>
              <TableHead>Nilai</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Berlaku</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : formats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  Belum ada format.
                </TableCell>
              </TableRow>
            ) : (
              formats.map((f) => (
                <TableRow key={f.format_key}>
                  <TableCell className="font-mono text-xs">{f.format_key}</TableCell>
                  <TableCell>{f.format_value}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{f.data_type}</Badge>
                  </TableCell>
                  <TableCell>{f.applies_to}</TableCell>
                  <TableCell>
                    {f.is_editable && (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(f.format_key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Tambah / Ubah Format</DialogTitle>
              <DialogDescription>Kunci format unik, mis. date.display.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="format_key">Kunci Format</Label>
                <Input
                  id="format_key"
                  value={form.format_key}
                  onChange={(e) => setForm({ ...form, format_key: e.target.value })}
                  placeholder="date.display"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format_value">Nilai</Label>
                <Input
                  id="format_value"
                  value={form.format_value}
                  onChange={(e) => setForm({ ...form, format_value: e.target.value })}
                  placeholder="DD/MM/YYYY"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipe Data</Label>
                  <Select
                    value={form.data_type}
                    onValueChange={(v) =>
                      setForm({ ...form, data_type: v as FormatSetting['data_type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STRING">STRING</SelectItem>
                      <SelectItem value="NUMBER">NUMBER</SelectItem>
                      <SelectItem value="JSON">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Berlaku</Label>
                  <Select
                    value={form.applies_to}
                    onValueChange={(v) =>
                      setForm({ ...form, applies_to: v as FormatSetting['applies_to'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOTH">BOTH</SelectItem>
                      <SelectItem value="WEB">WEB</SelectItem>
                      <SelectItem value="MOBILE">MOBILE</SelectItem>
                      <SelectItem value="EXPORT">EXPORT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
