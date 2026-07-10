import { useCallback, useEffect, useState } from 'react';
import { Fingerprint, Loader2, Lock, Save, User } from 'lucide-react';
import { changePassword, fetchProfile, updateProfile, type UserProfile } from '@api/profile';
import { useToast } from '@hooks/useToast';
import PasskeyManager from '@pages/PasskeyManager';
import { t } from '@/i18n/strings';

const MIN_PASSWORD_LENGTH = 6;

export default function ProfilePage() {
  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:mb-8">
        <h2 className="text-title-md text-surface-on sm:text-headline-sm">{t.profile.title}</h2>
        <p className="text-body-sm text-surface-on/60">{t.profile.subtitle}</p>
      </header>

      <div className="space-y-6">
        <ProfileSection />
        <PasswordSection />
        <PasskeySection />
      </div>
    </div>
  );
}

/* ----------------------- Profile (display name) ----------------------- */

function ProfileSection() {
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchProfile();
      setProfile(p);
      setDraft(p.display_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.errLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = profile !== null && draft.trim() !== profile.display_name;

  const handleSave = async () => {
    if (!profile) return;
    const next = draft.trim();
    if (next === profile.display_name) return;
    if (!next) {
      toast.error(t.profile.displayNamePlaceholder);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile({ display_name: next });
      setProfile(updated);
      setDraft(updated.display_name);
      toast.success(t.profile.profileUpdated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile.errUpdate);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="md3-card p-5 sm:p-6" aria-labelledby="profile-section-title">
      <SectionHeader
        id="profile-section-title"
        icon={<User className="h-5 w-5" />}
        title={t.profile.profileSection}
      />

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading || profile === null ? (
        <LoadingState />
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="profile-username"
              className="mb-1.5 block text-label-md text-surface-on/70"
            >
              {t.profile.username}
            </label>
            <input
              id="profile-username"
              type="text"
              value={profile.username}
              readOnly
              disabled
              aria-describedby="profile-username-hint"
              className="md3-input cursor-not-allowed bg-surface-container-low text-surface-on/70"
            />
            <p id="profile-username-hint" className="mt-1 text-body-sm text-surface-on/50">
              {t.profile.usernameReadonlyHint}
            </p>
          </div>

          <div>
            <label
              htmlFor="profile-display-name"
              className="mb-1.5 block text-label-md text-surface-on/70"
            >
              {t.profile.displayName}
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.profile.displayNamePlaceholder}
              maxLength={60}
              disabled={saving}
              className="md3-input"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="md3-btn-filled"
              onClick={() => void handleSave()}
              disabled={saving || !dirty || !draft.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t.profile.saveProfile}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* -------------------------- Change password --------------------------- */

interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY_PASSWORD_FORM: PasswordForm = { current: '', next: '', confirm: '' };

function PasswordSection() {
  const toast = useToast();
  const [form, setForm] = useState<PasswordForm>(EMPTY_PASSWORD_FORM);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<PasswordForm>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.current) {
      toast.error(t.profile.currentPasswordRequired);
      return;
    }
    if (form.next.length < MIN_PASSWORD_LENGTH) {
      toast.error(t.profile.passwordTooShort);
      return;
    }
    if (form.next !== form.confirm) {
      toast.error(t.profile.passwordMismatch);
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({
        current_password: form.current,
        new_password: form.next,
      });
      toast.success(t.profile.passwordChanged);
      setForm(EMPTY_PASSWORD_FORM);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.profile.errChangePassword);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled =
    submitting || !form.current || !form.next || !form.confirm;

  return (
    <section className="md3-card p-5 sm:p-6" aria-labelledby="password-section-title">
      <SectionHeader
        id="password-section-title"
        icon={<Lock className="h-5 w-5" />}
        title={t.profile.passwordSection}
      />

      <form className="mt-4 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label
            htmlFor="pwd-current"
            className="mb-1.5 block text-label-md text-surface-on/70"
          >
            {t.profile.currentPassword}
          </label>
          <input
            id="pwd-current"
            type="password"
            autoComplete="current-password"
            value={form.current}
            onChange={(e) => update({ current: e.target.value })}
            disabled={submitting}
            className="md3-input"
          />
        </div>
        <div>
          <label
            htmlFor="pwd-next"
            className="mb-1.5 block text-label-md text-surface-on/70"
          >
            {t.profile.newPassword}
          </label>
          <input
            id="pwd-next"
            type="password"
            autoComplete="new-password"
            value={form.next}
            onChange={(e) => update({ next: e.target.value })}
            disabled={submitting}
            className="md3-input"
          />
        </div>
        <div>
          <label
            htmlFor="pwd-confirm"
            className="mb-1.5 block text-label-md text-surface-on/70"
          >
            {t.profile.confirmPassword}
          </label>
          <input
            id="pwd-confirm"
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => update({ confirm: e.target.value })}
            disabled={submitting}
            className="md3-input"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="md3-btn-filled"
            disabled={submitDisabled}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {t.profile.changePassword}
          </button>
        </div>
      </form>
    </section>
  );
}

/* -------------------------- Passkey sub-section ----------------------- */

function PasskeySection() {
  return (
    <section className="md3-card p-5 sm:p-6" aria-labelledby="passkey-section-title">
      <SectionHeader
        id="passkey-section-title"
        icon={<Fingerprint className="h-5 w-5" />}
        title={t.profile.passkeySection}
        description={t.profile.passkeySectionDesc}
      />
      <div className="mt-4">
        <PasskeyManager />
      </div>
    </section>
  );
}

/* ------------------------------ shared ------------------------------- */

function SectionHeader({
  id,
  icon,
  title,
  description,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary-on-container"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h3 id={id} className="text-title-sm text-surface-on sm:text-title-md">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-body-sm text-surface-on/60">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 py-10 text-body-md text-surface-on/60">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{t.common.loading}</span>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 px-6 py-10 text-error">
      <p className="text-body-md">{message}</p>
      <button type="button" className="md3-btn-filled" onClick={onRetry}>
        {t.common.retry}
      </button>
    </div>
  );
}
