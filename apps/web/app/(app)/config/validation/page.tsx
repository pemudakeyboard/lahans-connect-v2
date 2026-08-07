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
import {
  createValidationRule,
  deleteValidationRule,
  listValidationRules,
  type ValidationRule,
} from '@/lib/lahans-api';
import { ApiError } from '@/lib/api';

const RULE_TYPES = [
  'REQUIRED',
  'REGEX',
  'RANGE',
  'LENGTH',
  'UNIQUE',
  'CROSS_FIELD',
  'LOOKUP',
] as const;
const SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const;
const APPLIES_ON = ['CREATE', 'UPDATE', 'IMPORT', 'ALL'] as const;

interface RuleForm {
  entity_name: string;
  field_name: string;
  rule_type: string;
  rule_config: string;
  severity: string;
  error_message: string;
  applies_on: string;
}

const EMPTY_FORM: RuleForm = {
  entity_name: 'employees',
  field_name: '',
  rule_type: 'REGEX',
  rule_config: '{"pattern": ""}',
  severity: 'ERROR',
  error_message: '',
  applies_on: 'ALL',
};

export default function ValidationPage() {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listValidationRules({ pageSize: 100 });
      setRules(res.rows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat rule validasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    let ruleConfig: Record<string, unknown> = {};
    try {
      ruleConfig = JSON.parse(form.rule_config || '{}') as Record<string, unknown>;
    } catch {
      setError('rule_config bukan JSON valid.');
      setSaving(false);
      return;
    }
    try {
      await createValidationRule({
        entity_name: form.entity_name,
        field_name: form.field_name,
        rule_type: form.rule_type,
        rule_config: ruleConfig,
        severity: form.severity as ValidationRule['severity'],
        error_message: form.error_message,
        applies_on: form.applies_on,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan rule.');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus rule validasi ini?')) return;
    setError(null);
    try {
      await deleteValidationRule(id);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus rule.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rule Validasi</h1>
          <p className="text-muted-foreground text-sm">M8B — validasi data (FR-M8B-004..006)</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah Rule
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entitas</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Pesan</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Memuat…
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground h-24 text-center">
                  Belum ada rule.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.entity_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.field_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.rule_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.severity === 'ERROR'
                          ? 'destructive'
                          : r.severity === 'WARNING'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm">
                    {r.error_message}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={onSave}>
            <DialogHeader>
              <DialogTitle>Buat Rule Validasi</DialogTitle>
              <DialogDescription>rule_config diisi JSON sesuai rule_type.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="entity_name">Entitas</Label>
                  <Input
                    id="entity_name"
                    value={form.entity_name}
                    onChange={(e) => setForm({ ...form, entity_name: e.target.value })}
                    placeholder="employees"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field_name">Field</Label>
                  <Input
                    id="field_name"
                    value={form.field_name}
                    onChange={(e) => setForm({ ...form, field_name: e.target.value })}
                    placeholder="nik"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipe Rule</Label>
                  <Select
                    value={form.rule_type}
                    onValueChange={(v) => setForm({ ...form, rule_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(v) => setForm({ ...form, severity: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule_config">rule_config (JSON)</Label>
                <Input
                  id="rule_config"
                  value={form.rule_config}
                  onChange={(e) => setForm({ ...form, rule_config: e.target.value })}
                  className="font-mono text-xs"
                  placeholder='{"pattern": "^\\d{8}$"}'
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="error_message">Pesan Error</Label>
                <Input
                  id="error_message"
                  value={form.error_message}
                  onChange={(e) => setForm({ ...form, error_message: e.target.value })}
                  placeholder="NIK wajib 8 digit."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Berlaku Saat</Label>
                <Select
                  value={form.applies_on}
                  onValueChange={(v) => setForm({ ...form, applies_on: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLIES_ON.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
