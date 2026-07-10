import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Fingerprint, Loader2, Plus, ShieldOff, Trash2, XCircle } from 'lucide-react';
import {
  deletePasskeyCredential,
  fetchRegistrationChallenge,
  listPasskeyCredentials,
  verifyRegistration,
} from '@api/passkey';
import type { PasskeyCredential } from '@api/types';
import { HttpError } from '@api/client';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { format, t } from '@/i18n/strings';
import { base64urlToBytes } from '@/utils/webauthn';

type Status = 'idle' | 'working';

const ZERO_TS = 0;

/**
 * Render a unix-seconds timestamp the way a Chinese user expects to
 * read it. The backend returns 0 for credentials created before the
 * binding-timestamp feature shipped; surface that case explicitly
 * instead of pretending the epoch is a real binding time.
 */
function formatBindingTime(ts: number): string {
  if (ts <= ZERO_TS) return t.passkey.lastBindingUnknown;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return t.passkey.lastBindingUnknown;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatLastUsedTime(ts: number): string {
  if (ts < ZERO_TS) return t.passkey.lastUsedUnknown;
  if (ts === ZERO_TS) return t.passkey.lastUsedNone;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return t.passkey.lastUsedUnknown;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function PasskeyManager() {
  const toast = useToast();
  const [credentials, setCredentials] = useState<PasskeyCredential[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bindStatus, setBindStatus] = useState<Status>('idle');
  const [namingOpen, setNamingOpen] = useState(false);
  const [draftName, setDraftName] = useState<string>(t.passkey.promptNameDefault);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const webAuthnSupported =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.create === 'function';

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await listPasskeyCredentials();
      setCredentials(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.passkey.errLoad);
      setCredentials([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedCredentials = useMemo(() => {
    if (!credentials) return null;
    return [...credentials].sort((a, b) => b.created_at - a.created_at);
  }, [credentials]);

  const latestBindingTs = useMemo(() => {
    if (!sortedCredentials || sortedCredentials.length === 0) return 0;
    return sortedCredentials[0].created_at;
  }, [sortedCredentials]);

  const isBound = sortedCredentials !== null && sortedCredentials.length > 0;

  const handleBind = async (friendlyName: string) => {
    if (!webAuthnSupported) {
      toast.error(t.passkey.unsupported);
      return;
    }
    if (!friendlyName) {
      toast.error(t.passkey.errNameRequired);
      return;
    }
    setBindStatus('working');
    try {
      const { session_key, options } = await fetchRegistrationChallenge();
      const creationOptions = options as unknown as PublicKeyCredentialCreationOptionsJSON;
      const userId = creationOptions.user.id;
      const challenge = creationOptions.challenge;
      if (typeof userId !== 'string' || typeof challenge !== 'string') {
        throw new Error(t.passkey.errInvalidChallenge);
      }
      const publicKey: PublicKeyCredentialCreationOptions = {
        rp: creationOptions.rp,
        user: {
          ...creationOptions.user,
          id: base64urlToBytes(userId) as BufferSource,
        },
        challenge: base64urlToBytes(challenge) as BufferSource,
        pubKeyCredParams: creationOptions.pubKeyCredParams ?? [{ type: 'public-key', alg: -7 }],
        timeout: creationOptions.timeout ?? 60_000,
        attestation: (creationOptions.attestation ?? 'none') as AttestationConveyancePreference,
        authenticatorSelection: creationOptions.authenticatorSelection ?? {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
        excludeCredentials: creationOptions.excludeCredentials?.map<PublicKeyCredentialDescriptor>(
          (c) => ({
            type: c.type as PublicKeyCredentialType,
            id: base64urlToBytes(c.id) as BufferSource,
            transports: c.transports as AuthenticatorTransport[] | undefined,
          }),
        ),
      };
      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) {
        toast.error(t.passkey.errCancelled);
        return;
      }
      await verifyRegistration(cred, session_key, friendlyName);
      toast.success(t.passkey.bindSuccess);
      await load();
    } catch (err) {
      if (err instanceof HttpError) {
        toast.error(err.message || t.passkey.errBind);
      } else if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          toast.error(t.passkey.errCancelled);
        } else {
          toast.error(err.message || t.passkey.errBind);
        }
      } else {
        toast.error(t.passkey.errBind);
      }
    } finally {
      setBindStatus('idle');
    }
  };

  const openNamingDialog = () => {
    setDraftName(t.passkey.promptNameDefault);
    setNamingOpen(true);
  };

  const confirmNamingDialog = () => {
    const name = draftName.trim();
    if (!name) {
      toast.error(t.passkey.errNameRequired);
      return;
    }
    setNamingOpen(false);
    void handleBind(name);
  };

  const handleDelete = async (id: string) => {
    setBusyDelete(true);
    try {
      await deletePasskeyCredential(id);
      toast.success(t.passkey.deleteSuccess);
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.passkey.errDelete);
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:mb-8">
        <div>
          <h2 className="text-title-md text-surface-on sm:text-headline-sm">{t.passkey.title}</h2>
          <p className="mt-0.5 text-body-sm text-surface-on/60">{t.passkey.subtitle}</p>
        </div>
        <button
          type="button"
          className="md3-btn-filled"
          onClick={openNamingDialog}
          disabled={!webAuthnSupported || bindStatus === 'working'}
        >
          {bindStatus === 'working' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.passkey.binding}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              {t.passkey.bind}
            </>
          )}
        </button>
      </header>

      {!webAuthnSupported && (
        <div className="md3-card-filled mb-4 flex items-start gap-3 border border-tertiary/30 bg-tertiary-container px-4 py-3 text-body-sm text-tertiary-on-container">
          <Fingerprint className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t.passkey.unsupported}</p>
        </div>
      )}

      <SecurityCenterPanel
        isBound={isBound}
        latestBindingTs={latestBindingTs}
        count={sortedCredentials?.length ?? 0}
      />

      {error ? (
        <div className="md3-card-filled mt-4 flex flex-col items-center gap-3 px-6 py-12 text-error">
          <XCircle className="h-8 w-8" />
          <p>{error}</p>
          <button type="button" className="md3-btn-filled" onClick={() => void load()}>
            {t.common.retry}
          </button>
        </div>
      ) : sortedCredentials === null ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-20 text-body-md text-surface-on/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      ) : sortedCredentials.length === 0 ? (
        <div className="md3-card mt-4 px-6 py-16 text-center">
          <Fingerprint className="mx-auto mb-3 h-10 w-10 text-surface-on/30" />
          <p className="text-body-md text-surface-on/70">{t.passkey.emptyTitle}</p>
          <p className="mt-1 text-body-sm text-surface-on/50">{t.passkey.emptyDesc}</p>
        </div>
      ) : (
        <div className="md3-card mt-4 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-body-md">
              <thead className="bg-surface-container-high text-label-md uppercase tracking-wide text-surface-on/60">
                <tr>
                  <th className="px-4 py-2">{t.passkey.colName}</th>
                  <th className="hidden w-56 px-4 py-2 md:table-cell">{t.passkey.colId}</th>
                  <th className="w-40 px-4 py-2">{t.passkey.colBoundAt}</th>
                  <th className="w-40 px-4 py-2">{t.passkey.colLastUsed}</th>
                  <th className="w-20 px-4 py-2 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {sortedCredentials.map((cred) => (
                    <motion.tr
                      key={cred.credential_id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-t border-outline-variant/50 hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-primary" />
                          <span className="font-mono text-body-sm">{cred.friendly_name}</span>
                        </span>
                      </td>
                      <td className="hidden px-4 py-2 font-mono text-body-sm text-surface-on/60 md:table-cell">
                        <span className="break-all">{cred.credential_id}</span>
                      </td>
                      <td className="px-4 py-2 text-body-sm text-surface-on/70">
                        {formatBindingTime(cred.created_at)}
                      </td>
                      <td className="px-4 py-2 text-body-sm text-surface-on/70">
                        {formatLastUsedTime(cred.last_used_at)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="rounded-full p-2 text-surface-on/60 transition-colors hover:bg-error/10 hover:text-error"
                          onClick={() => setDeletingId(cred.credential_id)}
                          aria-label={t.passkey.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={namingOpen}
        title={t.passkey.promptName}
        confirmLabel={t.common.confirm}
        cancelLabel={t.common.cancel}
        onConfirm={confirmNamingDialog}
        onCancel={() => {
          if (bindStatus === 'working') return;
          setNamingOpen(false);
        }}
        busy={bindStatus === 'working'}
        confirmDisabled={!draftName.trim()}
      >
        <div className="space-y-2">
          <label htmlFor="passkey-friendly-name" className="block text-label-md text-surface-on/70">
            {t.passkey.colName}
          </label>
          <input
            id="passkey-friendly-name"
            type="text"
            className="md3-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder={t.passkey.promptNameDefault}
            autoFocus
            maxLength={60}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deletingId !== null}
        title={t.passkey.confirmDeleteTitle}
        description={t.passkey.confirmDeleteDesc}
        tone="danger"
        confirmLabel={t.passkey.delete}
        busy={busyDelete}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}

function SecurityCenterPanel({
  isBound,
  latestBindingTs,
  count,
}: {
  isBound: boolean;
  latestBindingTs: number;
  count: number;
}) {
  const Icon = isBound ? CheckCircle2 : ShieldOff;
  const tone = isBound
    ? 'border-primary/40 bg-primary-container/60 text-primary-on-container'
    : 'border-tertiary/40 bg-tertiary-container/60 text-tertiary-on-container';
  const countText =
    count === 1
      ? t.passkey.countOne
      : count === 0
        ? t.passkey.lastBindingNone
        : format(t.passkey.countMany, { n: count });
  const latestText = isBound
    ? formatBindingTime(latestBindingTs)
    : t.passkey.lastBindingNone;

  return (
    <section
      aria-live="polite"
      className={`md3-card-filled flex flex-col gap-4 border px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5 ${tone}`}
    >
      <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
        <Icon className="h-6 w-6 shrink-0" aria-hidden />
        <div>
          <div className="text-label-lg">
            {isBound ? t.passkey.statusBound : t.passkey.statusUnbound}
          </div>
          <div className="text-body-sm opacity-80">
            {isBound ? t.passkey.statusBoundDesc : t.passkey.statusUnboundDesc}
          </div>
        </div>
      </div>
      <dl className="grid w-full grid-cols-2 gap-3 sm:ml-auto sm:max-w-xs sm:gap-2">
        <div>
          <dt className="text-label-sm uppercase tracking-wide opacity-70">
            {t.passkey.lastBindingLabel}
          </dt>
          <dd className="text-body-md">{latestText}</dd>
        </div>
        <div>
          <dt className="text-label-sm uppercase tracking-wide opacity-70">
            {t.passkey.countLabel}
          </dt>
          <dd className="text-body-md">{countText}</dd>
        </div>
      </dl>
    </section>
  );
}
