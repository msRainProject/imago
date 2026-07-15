import { CloudCog, HardDrive, KeyRound } from 'lucide-react';
import { t } from '@/i18n/strings';
import { SettingsForm, type SettingsGroup } from '@components/SettingsForm';

const DRIVER_FIELDS = ['storage.driver'] as const;
const LOCAL_FIELDS = [
  'storage.local.root',
  'storage.local.path_template',
  'storage.local.public_base_url',
] as const;
const R2_FIELDS = [
  'r2.account_id',
  'r2.access_key_id',
  'r2.secret_access_key',
  'r2.bucket',
  'r2.endpoint',
  'r2.public_base_url',
] as const;
const S3_FIELDS = [
  's3.endpoint',
  's3.region',
  's3.bucket',
  's3.access_key_id',
  's3.secret_access_key',
  's3.public_base_url',
  's3.key_prefix',
  's3.thumb_prefix',
  's3.use_path_style',
] as const;

const GROUPS: readonly SettingsGroup[] = [
  {
    key: 'driver',
    title: t.storage.groups.driver.title,
    description: t.storage.groups.driver.description,
    icon: <KeyRound className="h-4 w-4" />,
    fields: DRIVER_FIELDS,
  },
  {
    key: 'local',
    title: t.storage.groups.local.title,
    description: t.storage.groups.local.description,
    icon: <HardDrive className="h-4 w-4" />,
    fields: LOCAL_FIELDS,
  },
  {
    key: 'r2',
    title: t.storage.groups.r2.title,
    description: t.storage.groups.r2.description,
    icon: <CloudCog className="h-4 w-4" />,
    fields: R2_FIELDS,
  },
  {
    key: 's3',
    title: t.storage.groups.s3.title,
    description: t.storage.groups.s3.description,
    icon: <CloudCog className="h-4 w-4" />,
    fields: S3_FIELDS,
  },
];

export default function AdminStoragePage() {
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
