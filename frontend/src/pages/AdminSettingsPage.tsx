import { Settings as SettingsIcon, Upload, ShieldCheck } from 'lucide-react';
import { t } from '@/i18n/strings';
import { SettingsForm, type SettingsGroup } from '@components/SettingsForm';

const GROUPS: readonly SettingsGroup[] = [
  {
    key: 'site',
    title: t.settings.groups.site.title,
    description: t.settings.groups.site.description,
    icon: <SettingsIcon className="h-4 w-4" />,
    fields: ['title', 'domain', 'imgurl', 'keywords', 'description'],
  },
  {
    key: 'upload',
    title: t.settings.groups.upload.title,
    description: t.settings.groups.upload.description,
    icon: <Upload className="h-4 w-4" />,
    fields: [
      'maxSize',
      'allowedExt',
      'upload.process.enabled',
      'upload.process.target_format',
      'upload.process.max_size_mb',
      'upload.process.max_width',
      'upload.process.max_height',
    ],
  },
  {
    key: 'security',
    title: t.settings.groups.security.title,
    description: t.settings.groups.security.description,
    icon: <ShieldCheck className="h-4 w-4" />,
    fields: ['webauthn.rpid', 'webauthn.rporigin', 'webauthn.rpname'],
  },
];

export default function AdminSettingsPage() {
  return (
    <SettingsForm
      groups={GROUPS}
      i18n={{
        loading: t.common.loading,
        errLoad: t.settings.errLoad,
        errSave: t.settings.errSave,
        saved: t.settings.saved,
        editHint: t.settings.editHint,
        unsavedHint: t.settings.unsavedHint,
        save: t.settings.save,
        reset: t.settings.reset,
      }}
    />
  );
}
