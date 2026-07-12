import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Loader2, Lock, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchLoginChallenge, verifyLogin } from '@api/passkey';
import { apiPost } from '@api/client';
import { HttpError } from '@api/client';
import type { LoginResponse } from '@api/types';
import { setToken, setUser } from '@/utils/auth';
import { base64urlToBytes } from '@/utils/webauthn';
import { t } from '@/i18n/strings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type AuthStatus = 'idle' | 'working' | 'success' | 'error';

interface LocationState {
  from?: string;
}

/** Post-login landing — direct login always goes to home. */
function defaultRedirect(): string {
  return '/';
}

/** Check if this browser can use WebAuthn for assertions. */
function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials?.get === 'function'
  );
}

/**
 * Hill Images — login page.
 *
 * Two authentication paths:
 *   1. Password — POST /api/auth/login → HttpOnly session cookie + user profile.
 *   2. Passkey — fetchLoginChallenge → navigator.credentials.get()
 *      → verifyLogin(credential, session_key) → store JWT.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as LocationState | null)?.from ?? defaultRedirect();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pwStatus, setPwStatus] = useState<AuthStatus>('idle');
  const [pwError, setPwError] = useState<string | null>(null);

  /* Passkey state */
  const [pkStatus, setPkStatus] = useState<AuthStatus>('idle');
  const [pkError, setPkError] = useState<string | null>(null);

  const webAuthnSupported = isWebAuthnSupported();

  /* --------------------------- Password login -------------------------- */

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);

    if (!username.trim() || !password) {
      setPwError(t.login.errRequired);
      return;
    }

    setPwStatus('working');
    try {
      const data = await apiPost<LoginResponse>('/api/auth/login', { username, password });
      setToken(data.token);
      setUser(data.user);
      setPwStatus('success');
      await new Promise((r) => setTimeout(r, 250));
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setPwStatus('error');
      if (err instanceof HttpError) {
        setPwError(err.message || t.login.errInvalid);
      } else {
        setPwError(err instanceof Error ? err.message : t.login.errNetwork);
      }
    }
  }

  /* --------------------------- Passkey login --------------------------- */

  async function handlePasskeyLogin() {
    setPkError(null);

    if (!webAuthnSupported) {
      setPkStatus('error');
      setPkError(t.login.passkeyUnsupported);
      return;
    }

    setPkStatus('working');
    try {
      // Passkey login is intentionally a client-side discoverable flow:
      // we omit `username` so the server returns a challenge without
      // allowCredentials, letting the browser show its native passkey
      // chooser. The userHandle in the resulting assertion identifies
      // the owning account server-side.
      const challengeData = await fetchLoginChallenge();
      const { session_key, options } = challengeData;

      // 2. Decode the challenge bytes from the options.
      // The Go backend returns options as a proper PublicKeyCredentialRequestOptions
      // but the challenge field may be a base64url string that needs decoding.
      const challengeBytes = typeof options.challenge === 'string'
        ? base64urlToBytes(options.challenge as string)
        : new Uint8Array(options.challenge as ArrayBuffer);

      const publicKey: PublicKeyCredentialRequestOptions = {
        ...options,
        challenge: challengeBytes as BufferSource,
        timeout: options.timeout ?? 60_000,
        userVerification: options.userVerification ?? 'preferred',
        allowCredentials: options.allowCredentials ?? [],
      };

      // 3. Ask the authenticator for an assertion. `mediation: 'optional'`
      // forces the browser to surface its passkey chooser rather than
      // silently auto-selecting a previously used credential.
      const cred = (await navigator.credentials.get({
        publicKey,
        mediation: 'optional',
      })) as PublicKeyCredential | null;
      if (!cred) {
        setPkStatus('error');
        setPkError(t.login.passkeyFailed);
        return;
      }

      // 4. Send the serialized assertion + session_key back to Go backend.
      const result = await verifyLogin(cred, session_key);

      if (result.token && result.user) {
        setToken(result.token);
        setUser(result.user);
        setPkStatus('success');
        await new Promise((r) => setTimeout(r, 250));
        navigate(redirectTo, { replace: true });
        return;
      }

      setPkStatus('error');
      setPkError(t.login.passkeyFailed);
    } catch (err) {
      setPkStatus('error');
      if (err instanceof HttpError) {
        if (err.status === 429) {
          setPkError(t.login.errRateLimited);
        } else {
          setPkError(err.message || t.login.passkeyFailed);
        }
      } else if (err instanceof Error) {
        const name = err.name ?? '';
        if (name === 'NotAllowedError') {
          setPkError(t.login.passkeyFailed);
        } else {
          setPkError(err.message || t.login.passkeyFailed);
        }
      } else {
        setPkError(t.login.passkeyFailed);
      }
    }
  }

  /* ------------------------------ Render ------------------------------- */

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
        className="w-full max-w-sm"
      >
        <Card className="overflow-hidden shadow-lg">
          <div className="flex flex-col items-center px-6 pt-8 pb-2 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Fingerprint className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-semibold text-foreground text-balance">{t.login.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.login.subtitle}</p>
          </div>

          <CardContent className="px-6 py-6">
            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
              noValidate
            >
              <FormField
                id="login-username"
                label={t.login.usernameLabel}
                type="text"
                value={username}
                onChange={setUsername}
                placeholder={t.login.usernamePlaceholder}
                autoComplete="username"
                icon={<User className="h-4 w-4" />}
                disabled={pwStatus === 'working' || pwStatus === 'success'}
              />
              <FormField
                id="login-password"
                label={t.login.passwordLabel}
                type="password"
                value={password}
                onChange={setPassword}
                placeholder={t.login.passwordPlaceholder}
                autoComplete="current-password"
                icon={<Lock className="h-4 w-4" />}
                disabled={pwStatus === 'working' || pwStatus === 'success'}
              />

              <ErrorBanner message={pwError} />

              <Button
                type="submit"
                className="w-full"
                disabled={pwStatus === 'working' || pwStatus === 'success'}
              >
                {pwStatus === 'working' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.login.submitting}
                  </>
                ) : pwStatus === 'success' ? (
                  t.login.passkeySuccess
                ) : (
                  t.login.submitPassword
                )}
              </Button>
            </motion.form>

            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Separator className="flex-1" />
              <span>{'或'}</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <ErrorBanner message={pkError} />

              {!webAuthnSupported && (
                <ErrorBanner message={t.login.passkeyUnsupported} variant="warning" />
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handlePasskeyLogin}
                disabled={
                  !webAuthnSupported || pkStatus === 'working' || pkStatus === 'success'
                }
              >
                {pkStatus === 'working' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.login.passkeyWorking}
                  </>
                ) : pkStatus === 'success' ? (
                  t.login.passkeySuccess
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4" />
                    {t.login.passkeyButton}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

      </motion.div>
    </div>
  );
}

/* ----------------------------- Sub-components ---------------------------- */

function FormField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  icon,
  disabled,
}: {
  id: string;
  label: string;
  type: 'text' | 'password';
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground/70">
          {icon}
        </span>
        <Input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="pl-10"
        />
      </div>
    </div>
  );
}

function ErrorBanner({
  message,
  variant = 'error',
}: {
  message: string | null;
  variant?: 'error' | 'warning';
}) {
  if (!message) return null;
  const tone =
    variant === 'warning'
      ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
      : 'bg-destructive/10 text-destructive border-destructive/30';
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-md border px-3 py-2 text-sm ${tone}`}
      role="alert"
    >
      {message}
    </motion.div>
  );
}
