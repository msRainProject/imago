import { useEffect, useMemo, useState, useCallback } from 'react';
import { Loader2, Save, XCircle, KeyRound } from 'lucide-react';
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
  'upyun.password',
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
      <div className="flex items-center justify-center gap-2 py-20 text-body-md text-surface-on/60">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{i18n.loading}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md3-card flex flex-col items-center gap-3 px-6 py-12 text-error">
        <XCircle className="h-8 w-8" />
        <p>{error}</p>
        <button type="button" className="md3-btn-filled" onClick={load}>
          {t.common.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const keys = grouped[g.key] ?? [];
        if (keys.length === 0) return null;
        return (
          <section key={g.key} className="md3-card overflow-hidden">
            <header className="flex items-start gap-3 border-b border-outline-variant/40 bg-surface-container-lowest/40 px-5 py-4">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-container text-primary-on-container">
                {g.icon ?? <KeyRound className="h-4 w-4" />}
              </span>
              <div>
                <h2 className="text-title-sm text-surface-on">{g.title}</h2>
                {g.description && (
                  <p className="mt-0.5 text-body-sm text-surface-on/60">{g.description}</p>
                )}
              </div>
            </header>
            <div className="divide-y divide-outline-variant/40">
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
          </section>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-body-sm text-surface-on/60">
          {dirty ? i18n.unsavedHint : i18n.editHint}
        </p>
        <div className="flex gap-2">
          <button type="button" className="md3-btn-text" onClick={handleReset} disabled={saving || !dirty}>
            {i18n.reset}
          </button>
          <button
            type="button"
            className="md3-btn-filled"
            onClick={() => void handleSave()}
            disabled={saving || !dirty}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {i18n.save}
          </button>
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
        <span className="text-label-lg text-surface-on">{label}</span>
        {changed && (
          <span className="rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm text-tertiary-on-container">
            已修改
          </span>
        )}
      </div>
      <div className="mt-1.5">
        {isDriver ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="md3-input"
          >
            {Object.entries(t.settings.driverOptions).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ) : isBoolean ? (
          <ToggleSwitch
            checked={normalizeBoolValue(value) === 'true'}
            onChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
        ) : selectOptions ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="md3-input"
          >
            {Object.entries(selectOptions).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ) : isMegabytes ? (
          <MegabyteInput value={value} onChange={onChange} />
        ) : isNumber ? (
          <NumberInput value={value} onChange={onChange} suffix={unitSuffix} />
        ) : isSecret && !revealed ? (
          <SecretInput onReveal={onToggleReveal} />
        ) : isPassword ? (
          <div className="flex gap-2">
            <input
              type={revealed ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="md3-input flex-1"
            />
            <button
              type="button"
              className="md3-btn-text shrink-0"
              onClick={onToggleReveal}
            >
              {revealed ? '隐藏' : '显示'}
            </button>
          </div>
        ) : isTextarea ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            spellCheck={false}
            className="md3-input min-h-28 resize-y"
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="md3-input"
          />
        )}
      </div>
      {t.settings.fieldHelp[fieldKey] && (
        <p className="mt-1.5 text-body-sm text-surface-on/60">
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
      <input
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
        className="md3-input pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-label-md text-surface-on/60">
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
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="md3-input"
      />
    );
  }

  return (
    <div className="relative">
      <input
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="md3-input pr-14"
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-label-md text-surface-on/60">
        {suffix}
      </span>
    </div>
  );
}

function SecretInput({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="md3-input flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
      <span className="font-mono text-body-lg text-surface-on/50">••••••••</span>
      <span className="text-body-sm text-surface-on/60 sm:truncate">已保存，输入新值以覆盖</span>
      <button type="button" className="md3-btn-text ml-auto shrink-0" onClick={onReveal}>
        修改
      </button>
    </div>
  );
}
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${checked
          ? 'bg-primary'
          : 'bg-surface-on/20'
        }
      `}
    >
      <span
        className={`
          inline-block h-5 w-5
          transform rounded-full
          bg-white shadow-sm
          ring-0
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-5' : 'translate-x-0'}
        `}
      />
    </button>
  );
}
