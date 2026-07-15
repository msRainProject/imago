import { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Save, XCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchConfig, updateConfig } from '@api/admin';
import { useToast } from '@hooks/useToast';
import { t } from '@/i18n/strings';

export type SettingsGroup = {
  key: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  fields: readonly string[];
};

const DRIVER_KEY = 'storage.driver';
const MAX_SIZE_KEY = 'maxSize';
const NUMBER_KEYS = new Set<string>([
  'upload.process.max_size_mb',
  'upload.process.max_width',
  'upload.process.max_height',
]);
const PASSWORD_KEYS = new Set<string>([
  'r2.secret_access_key',
  's3.secret_access_key',
]);
const BOOLEAN_KEYS = new Set<string>(['s3.use_path_style', 'upload.process.enabled']);
const TEXTAREA_KEYS = new Set<string>(['webauthn.rporigin']);
const SELECT_OPTIONS: Record<string, Record<string, string>> = {
  'upload.process.target_format': t.settings.imageFormats,
};
const UNIT_SUFFIX: Record<string, string> = {
  'upload.process.max_size_mb': 'MB',
  'upload.process.max_width': 'px',
  'upload.process.max_height': 'px',
};
const MB = 1024 * 1024;

export function SettingsForm({
  groups,
  i18n,
}: {
  groups: readonly SettingsGroup[];
  i18n: {
    loading: string;
    errLoad: string;
    errSave: string;
    saved: string;
    editHint: string;
    unsavedHint: string;
    save: string;
    reset: string;
  };
}) {
  const toast = useToast();
  const [config, setConfig] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConfig();
      if (!data || Object.keys(data).length === 0) {
        setError(i18n.errLoad);
        setConfig({});
        setEdits({});
      } else {
        setConfig(data);
        setEdits(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.errLoad);
    } finally {
      setLoading(false);
    }
  }, [i18n.errLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    for (const key of Object.keys(edits)) {
      if ((edits[key] ?? '') !== (config[key] ?? '')) return true;
    }
    for (const key of Object.keys(config)) {
      if (!(key in edits)) return true;
    }
    return false;
  }, [config, edits]);

  const handleSave = async () => {
    const changes: Record<string, string> = {};
    for (const [key, value] of Object.entries(edits)) {
      if (value !== (config[key] ?? '')) {
        changes[key] = value;
      }
    }
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    try {
      const result = await updateConfig(changes);
      setConfig(result);
      setEdits(result);
      toast.success(i18n.saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : i18n.errSave);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setEdits(config);
    setRevealedPasswords(new Set());
  };

  const grouped = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const g of groups) {
      result[g.key] = g.fields.filter((k) => k in config);
    }
    return result;
  }, [config, groups]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{i18n.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-12 text-destructive">
        <XCircle className="h-8 w-8" />
        <p>{error}</p>
        <Button onClick={load}>{t.common.retry}</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const keys = grouped[g.key] ?? [];
        if (keys.length === 0) return null;
        return (
          <Card key={g.key} className="overflow-hidden">
            <header className="flex items-start gap-3 border-b border-border/60 bg-muted/40 px-5 py-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {g.icon ?? <KeyRound className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{g.title}</h2>
                {g.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>
                )}
              </div>
            </header>
            <div className="divide-y divide-border/60">
              {keys.map((key) => (
                <Field
                  key={key}
                  fieldKey={key}
                  value={edits[key] ?? ''}
                  savedValue={config[key] ?? ''}
                  isPassword={PASSWORD_KEYS.has(key)}
                  isDriver={key === DRIVER_KEY}
                  isBoolean={BOOLEAN_KEYS.has(key)}
                  isTextarea={TEXTAREA_KEYS.has(key)}
                  isMegabytes={key === MAX_SIZE_KEY}
                  isNumber={NUMBER_KEYS.has(key)}
                  selectOptions={SELECT_OPTIONS[key]}
                  unitSuffix={UNIT_SUFFIX[key]}
                  revealed={revealedPasswords.has(key)}
                  onToggleReveal={() => {
                    setRevealedPasswords((curr) => {
                      const next = new Set(curr);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  }}
                  onChange={(value) =>
                    setEdits((prev) => ({ ...prev, [key]: value }))
                  }
                />
              ))}
            </div>
          </Card>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-sm text-muted-foreground">
          {dirty ? i18n.unsavedHint : i18n.editHint}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleReset} disabled={saving || !dirty}>
            {i18n.reset}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {i18n.save}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  fieldKey,
  value,
  savedValue,
  isPassword,
  isDriver,
  isBoolean,
  isTextarea,
  isMegabytes,
  isNumber,
  selectOptions,
  unitSuffix,
  revealed,
  onToggleReveal,
  onChange,
}: {
  fieldKey: string;
  value: string;
  savedValue: string;
  isPassword: boolean;
  isDriver: boolean;
  isBoolean: boolean;
  isTextarea: boolean;
  isMegabytes: boolean;
  isNumber: boolean;
  selectOptions?: Record<string, string>;
  unitSuffix?: string;
  revealed: boolean;
  onToggleReveal: () => void;
  onChange: (value: string) => void;
}) {
  const label = t.settings.fields[fieldKey] ?? fieldKey;
  const isSecret = isPassword && savedValue === '***';
  const changed = value !== savedValue;

  return (
    <label className="block px-5 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {changed && <Badge variant="outline">已修改</Badge>}
      </div>
      <div className="mt-1.5">
        {isDriver ? (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(t.settings.driverOptions).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : isBoolean ? (
          <Switch
            checked={normalizeBoolValue(value) === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        ) : selectOptions ? (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(selectOptions).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : isMegabytes ? (
          <MegabyteInput value={value} onChange={onChange} />
        ) : isNumber ? (
          <NumberInput value={value} onChange={onChange} suffix={unitSuffix} />
        ) : isSecret && !revealed ? (
          <SecretInput onReveal={onToggleReveal} />
        ) : isPassword ? (
          <div className="flex gap-2">
            <Input
              type={revealed ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="ghost" className="shrink-0" onClick={onToggleReveal}>
              {revealed ? '隐藏' : '显示'}
            </Button>
          </div>
        ) : isTextarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            spellCheck={false}
            className="flex min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
      {t.settings.fieldHelp[fieldKey] && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t.settings.fieldHelp[fieldKey]}
        </p>
      )}
    </label>
  );
}

function normalizeBoolValue(value: string): 'true' | 'false' {
  return String(value).trim().toLowerCase() === 'true' ? 'true' : 'false';
}

function bytesToMegabytesString(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mbValue = bytes / MB;
  return Number.isInteger(mbValue) ? String(mbValue) : mbValue.toFixed(2).replace(/\.?0+$/, '');
}

function megabytesToBytesString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const mbValue = Number(trimmed);
  if (!Number.isFinite(mbValue) || mbValue < 0) return trimmed;
  return String(Math.round(mbValue * MB));
}

function MegabyteInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [displayValue, setDisplayValue] = useState(() => bytesToMegabytesString(value));

  useEffect(() => {
    setDisplayValue(bytesToMegabytesString(value));
  }, [value]);

  return (
    <div className="relative">
      <Input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const next = e.target.value;
          setDisplayValue(next);
          onChange(megabytesToBytesString(next));
        }}
        className="pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
        MB
      </span>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  if (!suffix) {
    return (
      <Input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className="relative">
      <Input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}

function SecretInput({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="flex min-h-10 w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-input bg-background px-3 py-2 sm:flex-nowrap">
      <span className="font-mono text-sm text-muted-foreground">••••••••</span>
      <span className="text-xs text-muted-foreground sm:truncate">已保存，输入新值以覆盖</span>
      <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0" onClick={onReveal}>
        修改
      </Button>
    </div>
  );
}
