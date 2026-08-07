'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
import {
  listNumberSequences,
  reserveNextNumber,
  upsertNumberSequence,
  type NumberSequence,
} from '@/lib/lahans-api';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

interface SeqForm {
  sequence_code: string;
  sequence_pattern: string;
  reset_period: string;
  padding_length: number;
  allow_manual: boolean;
}

const EMPTY_FORM: SeqForm = {
  sequence_code: '',
  sequence_pattern: 'EMP-{YYYY}-{SEQ}',
  reset_period: 'YEARLY',
  padding_length: 4,
  allow_manual: false,
};

export default function SequencesPage() {
  const { hasPermission } = useAuth();
  const [sequences, setSequences] = useState<NumberSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SeqForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [reserved, setReserved] = useState<{ code: string; number: string } | null>(null);

  const canWrite = hasPermission('config.sequence.write');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSequences(await listNumberSequences());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat sequence.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await upsertNumberSequence(form.sequence_code, {
        sequence_pattern: form.sequence_pattern,
        reset_period: form.reset_period as NumberSequence['reset_period'],
        padding_length: form.padding_length,
        allow_manual: form.allow_manual,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan sequence.');
    } finally {
      setSaving(false);
    }
  }

  async function onReserve(code: string) {
    setError(null);
    setReserved(null);
    try {
      const res = await reserveNextNumber(code);
      setReserved({ code, number: res.nextNumber });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal reserve nomor.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nomor Urut</h1>
          <p className="text-sm text-muted-foreground">M8B — sequence number (FR-M8B-007..010)</p>
        </div>
        {canWrite && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Tambah Sequence
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {reserved && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Nomor berikutnya untuk <code className="font-mono">{reserved.code}</code>:{' '}
          <strong className="font-mono">{reserved.number}</strong>
        </p>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Pola</TableHead>
              <TableHead>Reset</TableHead>
              <TableHead>Padding</TableHead>
              <TableHead>Nilai Saat Ini</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : sequences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Belum ada sequence.
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((s) => (
                <TableRow key={s.sequence_code}>
                  <TableCell className="font-mono text-xs">{s.sequence_code}</TableCell>
                  <TableCell className="font-mono text-xs">{s.sequence_pattern}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.reset_period}</Badge>
                  </TableCell>
                  <TableCell>{s.padding_length}</TableCell>
                  <TableCell className="font-mono text-xs">{s.current_value}</TableCell>
                  <TableCell>
                    {canWrite && (
                      <Button variant="ghost" size="icon" onClick={() => onReserve(s.sequence_code)} title="Reserve nomor">
                        <RefreshCw className="h-4 w-4" />
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
              <DialogTitle>Tambah Sequence</DialogTitle>
              <DialogDescription>Pola mendukung token {'{YYYY}, {MM}, {DD}, {SEQ}'}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sequence_code">Kode Sequence</Label>
                <Input
                  id="sequence_code"
                  value={form.sequence_code}
                  onChange={(e) => setForm({ ...form, sequence_code: e.target.value })}
                  placeholder="EMPLOYEE_NIK"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sequence_pattern">Pola</Label>
                <Input
                  id="sequence_pattern"
                  value={form.sequence_pattern}
                  onChange={(e) => setForm({ ...form, sequence_pattern: e.target.value })}
                  className="font-mono text-xs"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Reset</Label>
                  <Select
                    value={form.reset_period}
                    onValueChange={(v) => setForm({ ...form, reset_period: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEVER">NEVER</SelectItem>
                      <SelectItem value="YEARLY">YEARLY</SelectItem>
                      <SelectItem value="MONTHLY">MONTHLY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padding_length">Padding</Label>
                  <Input
                    id="padding_length"
                    type="number"
                    min={1}
                    value={form.padding_length}
                    onChange={(e) => setForm({ ...form, padding_length: Number(e.target.value) })}
                  />
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