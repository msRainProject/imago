/**
 * Hill Images — i18n strings.
 *
 * Single source of truth for zh-CN user-facing copy. If we ever add an
 * English locale, replace this object with a `Record<Locale, Strings>`
 * map and select the active locale at runtime. For now everything is
 * statically typed against the `Strings` shape so call-sites benefit
 * from exhaustive type-checking.
 */
export const t = {
  /* Common */
  common: {
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    back: '返回',
    loading: '加载中…',
    error: '出错了',
    retry: '重试',
    delete: '删除',
    copy: '复制',
    copied: '已复制',
    save: '保存',
    enabled: '启用',
    disabled: '禁用',
    search: '搜索',
    actions: '操作',
    noData: '暂无数据',
  },

  /* Brand */
  brand: {
    name: 'Hill Images',
    tagline: '清新专业的图床程序',
  },

  /* Home / upload page */
  home: {
    ctaUpload: '选择文件',

    dropZoneTitle: '拖拽图片到此处',
    dropZoneSubtitle: '或点击选择 · 支持多文件',
    dropZoneHint: '图片 · 视频 · 最大 {size}MB',
    dropZoneActive: '松开以上传',

    uploadProgressTitle: '上传中',
    uploadCompleteTitle: '上传结果',
    uploadPreparing: '图片处理中…',
    cancel: '取消',
    retry: '重试',

    copyDirect: '直链',
    copyMarkdown: 'Markdown',
    copyHtml: 'HTML',
    copyBbcode: 'BBCode',
    delete: '删除',
    confirmDelete: '此操作不可撤销，图片将从服务器永久删除。',

    statsTitle: '图床统计',
    statsTotalSpace: '总空间',
    statsUsedSpace: '已用',
    statsTotalCount: '总文件',
    statsTodayCount: '今日上传',
    statsLocalCount: '本地存储',

    errUploadFailed: '上传失败',
    errLoadStats: '加载统计失败',
  },

  /* Gallery page */
  gallery: {
    title: '公开图库',
    subtitle: '浏览社区上传的最新作品',
    emptyTitle: '暂无图片',
    emptyDesc: '图库还是空的，快去上传第一张吧。',
    emptyCta: '立即上传',

    lightboxClose: '关闭',
    lightboxCopyTitle: '复制链接',
    lightboxMeta: '文件信息',
  },

  /* Admin file manager */
  admin: {
    title: '文件管理',
    subtitle: '浏览、搜索、批量操作所有上传',
    searchPlaceholder: '按显示名或原始名搜索…',
    uploadShortcut: '去首页上传',

    viewTable: '列表',
    viewGrid: '紧凑网格',
    sortLabel: '排序',
    sortLatest: '最新',
    sortSize: '大小',
    sortName: '名称',

    colName: '文件',
    colMime: 'MIME',
    colDimensions: '尺寸',
    colSize: '大小',
    colDate: '上传时间',
    colStorage: '存储',
    colActions: '操作',

    previewTitle: '站内预览',
    previewOriginal: '查看原图',
    previewThumb: '查看缩略图',
    previewDirect: '复制直链',

    actionRename: '重命名',
    actionDelete: '删除',

    bulkBar: '已选 {n} 项',
    bulkDelete: '批量删除',

    renameTitle: '重命名文件',
    renameLabel: '新文件名',
    renameHelp: '仅修改文件名，不含路径。',

    confirmDeleteTitle: '删除文件？',
    confirmDeleteDesc: '此操作不可撤销，文件将被永久删除。',
    confirmBatchDeleteTitle: '批量删除文件？',
    confirmBatchDeleteDesc: '将永久删除 {n} 个文件，无法恢复。',

    paginationFirst: '首页',
    paginationPrev: '上一页',
    paginationNext: '下一页',
    paginationLast: '末页',
    paginationSummary: '第 {from}-{to} 条 / 共 {total} 条',

    selectAll: '全选',
    selectRow: '选择行',

    errLoadFailed: '加载文件失败',
    errDeleteFailed: '删除失败',
    errRenameFailed: '重命名失败',
    errBatchDeleteFailed: '批量删除失败',
    successDelete: '已删除',
    successRename: '已重命名',
    successBatchDelete: '已删除 {n} 个文件',
  },

  /* Login page */
  login: {
    title: '登录',
    subtitle: '使用您的账号继续',

    /* Password form */
    usernameLabel: '用户名',
    usernamePlaceholder: '请输入用户名',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入密码',
    submitPassword: '登录',
    submitting: '登录中…',
    errRequired: '请填写用户名和密码',
    errInvalid: '用户名或密码错误',
    errRateLimited: '登录尝试过于频繁，请稍后再试',
    errNetwork: '网络错误，请检查连接后重试',

    /* Passkey */
    passkeyButton: '使用 Passkey 登录',
    passkeyWorking: '等待认证器响应…',
    passkeyUnsupported: '当前浏览器不支持 WebAuthn，请使用密码登录或升级浏览器。',
    passkeyFailed: 'WebAuthn 验证失败',
    passkeySuccess: '登录成功，正在跳转…',
  },

  /* Toast */
  toast: {
    success: '成功',
    error: '错误',
    warning: '警告',
    info: '提示',
  },

  /* Admin Settings — grouped, human-readable semantics */
  settings: {
    title: '系统设置',
    subtitle: '图床基础信息、上传限制与安全',
    save: '保存设置',
    reset: '重置',
    saved: '设置已保存',
    errSave: '保存失败',
    errLoad: '加载设置失败',
    editHint: '修改后点击底部“保存设置”统一提交',
    unsavedHint: '有未保存的修改',

    /* Group headings — bound to real backend keys below */
    groups: {
      site: {
        title: '网站基本信息',
        description: '图床对外展示的信息',
      },
      upload: {
        title: '上传与限制',
        description: '允许的文件类型与单文件体积上限',
      },
      security: {
        title: '登录与安全',
        description: 'WebAuthn / Passkey 登录相关',
      },
    },

    /* Field labels keyed by the real config key the backend returns */
    fields: {
      title: '网站标题',
      domain: '网站域名',
      imgurl: '图片访问域名',
      keywords: '网站关键字',
      description: '网站描述',
      maxSize: '单文件最大体积（MB）',
      allowedExt: '允许的扩展名',
      'upload.process.enabled': '上传前图片处理',
      'upload.process.target_format': '输出格式',
      'upload.process.max_size_mb': '目标体积上限',
      'upload.process.max_width': '最大宽度',
      'upload.process.max_height': '最大高度',
      'storage.driver': '存储驱动',
      'storage.path': '存储子目录格式',
      'storage.local.root': '本地存储根目录',
      'storage.local.path_template': '子目录模板（不含文件名）',
      'storage.local.public_base_url': '本地图片访问域名',
      'r2.account_id': 'R2 账户 ID',
      'r2.access_key_id': 'Access Key ID',
      'r2.secret_access_key': 'Secret Access Key',
      'r2.bucket': 'R2 存储桶名称',
      'r2.endpoint': 'S3 兼容端点（可选）',
      'r2.public_base_url': 'R2 公共访问域名（可选）',
      's3.endpoint': 'S3 兼容端点',
      's3.region': 'S3 区域',
      's3.bucket': 'S3 存储桶名称',
      's3.access_key_id': 'S3 Access Key ID',
      's3.secret_access_key': 'S3 Secret Access Key',
      's3.public_base_url': 'S3 公共访问域名（可选）',
      's3.key_prefix': '原图对象前缀',
      's3.thumb_prefix': '缩略图对象前缀',
      's3.use_path_style': '使用 Path-Style 地址',
      'webauthn.rpid': 'WebAuthn 依赖方 ID',
      'webauthn.rporigin': 'WebAuthn 来源列表',
      'webauthn.rpname': 'WebAuthn 显示名称',
    } as Record<string, string>,

    /* Per-field helper copy — explains magic variables, formats, etc.
       Keys mirror `fields`; missing keys render no hint. */
    fieldHelp: {
      maxSize: '这里填写的是 MB，保存时会自动换算为后端需要的字节值。',
      'upload.process.enabled': '开启后，服务器会在保存前使用 ffmpeg 处理图片。HEIC/HEIF 会在这里统一转码。',
      'upload.process.target_format': '选择保留常规原格式，或统一转为 JPG / PNG / WebP。HEIC/HEIF 在保留原格式模式下也会转为 JPG 以保证兼容性。',
      'upload.process.max_size_mb': '服务器会尽量把图片压到这个体积以内；PNG 为无损编码，极端情况下可能仍略大于目标值。',
      'upload.process.max_width': '处理后图片允许的最大宽度，超过会等比缩小。填 0 表示不限制。',
      'upload.process.max_height': '处理后图片允许的最大高度，超过会等比缩小。填 0 表示不限制。',
      'storage.local.path_template': '仅控制文件所在的子目录结构。实际本地文件名固定为 12 位随机字母数字 + 扩展名；对外访问链接固定为「/年/前8位随机值_hash前12位.扩展名」。支持的占位符：{year} 年 · {month} 月 · {day} 日。示例 {year}/{month}/ 会把文件存到 2026/06/A1b2C3d4E5f6.jpg，并对外显示为 /2026/A1b2C3d4_abcdef012345.jpg。',
      'storage.local.public_base_url': '本地图片直链的域名前缀。配置后会生成 域名/年/前8位随机值_hash前12位.扩展名 这种公开访问地址。',
      'r2.public_base_url': 'R2 桶绑定的自定义域名或 r2.dev 公网地址。留空时上传接口将返回相对路径。',
      's3.endpoint': '例如 AWS S3、MinIO、Backblaze B2 或其他 S3 兼容对象存储的接口地址。',
      's3.public_base_url': '对象对外访问的 CDN 或自定义域名。留空时上传接口将返回相对路径。',
      's3.key_prefix': '原图对象的目录前缀，例如 originals/ 。',
      's3.thumb_prefix': '缩略图对象的目录前缀，例如 thumbs/ 。',
      's3.use_path_style': '部分 S3 兼容服务需要 path-style 访问方式，MinIO 等私有部署常见。',
      'webauthn.rpid': '通常填写可共享 passkey 的主域名，例如 example.com。不同根域名不能共用同一组 passkey。',
      'webauthn.rporigin': '每行一个完整来源，必须带协议，例如 https://app.example.com 。保存后新的 Passkey 登录/注册请求会立即使用这里的列表。',
      'webauthn.rpname': '系统在浏览器或系统级 Passkey 弹窗里展示的站点名称。',
    } as Record<string, string>,

    /* Driver options (only "value" → user-facing label) */
    driverOptions: {
      local: '本地存储',
      r2: 'Cloudflare R2',
      s3: '通用 S3',
    } as Record<string, string>,
    imageFormats: {
      original: '保留原格式',
      jpeg: '统一转 JPG',
      png: '统一转 PNG',
      webp: '统一转 WebP',
    } as Record<string, string>,
  },

  /* Admin Tokens */
  tokens: {
    title: 'API Token',
    subtitle: '管理 API 访问令牌',
    create: '创建 Token',
    delete: '删除',
    name: '名称',
    lastUsed: '最后使用',
    created: '创建时间',
    nameLabel: 'Token 名称',
    namePlaceholder: '输入 Token 名称…',
    createSuccess: 'Token 已创建',
    deleteSuccess: 'Token 已删除',
    errCreate: '创建失败',
    errDelete: '删除失败',
    errLoad: '加载 Token 失败',
    confirmDeleteTitle: '删除 Token？',
    confirmDeleteDesc: '此操作不可撤销，Token 将被永久删除。',
    rawTokenTitle: '新 Token 已生成',
    rawTokenDesc: '请立即复制，此 Token 仅显示一次。',
    rawTokenCopy: '复制 Token',
    neverUsed: '从未使用',
  },

  /* Admin Users */
  users: {
    title: '用户管理',
    subtitle: '管理系统用户与权限',
    create: '创建用户',
    edit: '编辑',
    delete: '删除',
    username: '用户名',
    password: '密码',
    role: '角色',
    admin: '管理员',
    user: '普通用户',
    createdAt: '创建时间',
    usernameLabel: '用户名',
    usernamePlaceholder: '输入用户名…',
    passwordLabel: '密码',
    passwordPlaceholder: '输入密码（至少6位）…',
    roleLabel: '角色',
    createSuccess: '用户已创建',
    updateSuccess: '用户已更新',
    deleteSuccess: '用户已删除',
    errCreate: '创建失败',
    errUpdate: '更新失败',
    errDelete: '删除失败',
    errLoad: '加载用户失败',
    confirmDeleteTitle: '删除用户？',
    confirmDeleteDesc: '此操作不可撤销，用户及其所有文件将被永久删除。',
    editTitle: '编辑用户',
    editPasswordHint: '留空则不修改密码',
  },

  /* Admin console — the tabbed home for /admin (settings/storage/tokens/users/passkey) */
  console: {
    title: '管理控制台',
    subtitle: '系统设置、存储驱动、API Token、用户管理、个人中心',
    settingsTab: '系统设置',
    storageTab: '存储驱动',
    tokensTab: 'API Token',
    usersTab: '用户管理',
    passkeyTab: '个人中心',
  },

  /* Personal center — self-service profile + password + passkey */
  profile: {
    title: '个人中心',
    subtitle: '管理您的个人信息和安全设置',

    /* Profile section */
    profileSection: '基本信息',
    username: '用户名',
    displayName: '昵称',
    displayNamePlaceholder: '输入显示名称',
    saveProfile: '保存',
    profileUpdated: '信息已更新',
    errLoad: '加载个人信息失败',
    errUpdate: '更新失败',
    usernameReadonlyHint: '用户名不可修改',

    /* Password section */
    passwordSection: '修改密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmPassword: '确认新密码',
    changePassword: '修改密码',
    passwordChanged: '密码已修改',
    passwordMismatch: '两次密码不一致',
    passwordTooShort: '密码至少 6 位',
    currentPasswordRequired: '请输入当前密码',
    errChangePassword: '修改密码失败',

    /* Passkey sub-section header (the inline PasskeyManager keeps its own header) */
    passkeySection: 'Passkey 管理',
    passkeySectionDesc: '绑定新设备或删除已有的通行密钥',
  },

  /* Passkey management — admin-only binding and removal */
  passkey: {
    title: 'Passkey 管理',
    subtitle: '绑定新设备或删除已有的通行密钥',
    bind: '绑定新设备',
    binding: '等待认证器响应…',
    promptName: '请输入这个 Passkey 的名称',
    promptNameDefault: '当前设备',
    errNameRequired: '请先填写 Passkey 名称',
    bindSuccess: '已绑定新设备',
    emptyTitle: '还没有绑定任何 Passkey',
    emptyDesc: '点击右上角“绑定新设备”使用指纹、Face ID 或安全密钥登录',
    delete: '删除',
    deleteSuccess: 'Passkey 已删除',
    unsupported: '当前浏览器不支持 WebAuthn，请升级浏览器后再试。',
    errInvalidChallenge: '服务端返回的注册参数格式不正确',
    errCancelled: '已取消',
    errBind: '绑定失败',
    errDelete: '删除失败',
    errLoad: '加载 Passkey 失败',
    colName: '设备',
    colId: 'Credential ID',
    colBoundAt: '绑定时间',
    colLastUsed: '最后使用',
    confirmDeleteTitle: '删除 Passkey？',
    confirmDeleteDesc: '删除后此设备将无法再用于 Passkey 登录。',

    /* Security-center status panel */
    statusBound: '已启用 Passkey',
    statusUnbound: '尚未启用 Passkey',
    statusBoundDesc: '您当前可以使用 Passkey 登录',
    statusUnboundDesc: '点击右上角“绑定新设备”为当前账号启用无密码登录',
    lastBindingLabel: '最近一次绑定',
    lastBindingNone: '尚无绑定记录',
    lastBindingUnknown: '时间未知（升级前绑定）',
    lastUsedNone: '从未使用',
    lastUsedUnknown: '时间未知',
    countLabel: '已绑定设备数',
    countOne: '1 台设备',
    countMany: '{n} 台设备',
  },

  /* Admin Storage — driver selection, local paths, Upyun / R2 credentials */
  storage: {
    title: '存储驱动',
    subtitle: '选择存储后端，配置本地路径或云存储凭证',

    /* Group headings */
    groups: {
      driver: {
        title: '存储驱动',
        description: '选择文件保存到本地、Cloudflare R2 或通用 S3',
      },
      local: {
        title: '本地存储',
        description: '文件保存路径与图片访问域名，留空则继承站点设置',
      },
      r2: {
        title: 'Cloudflare R2',
        description: '使用 Cloudflare R2 时需要填写账户与凭证',
      },
      s3: {
        title: '通用 S3',
        description: '兼容 AWS S3 / MinIO / Backblaze B2 / 其他 S3 协议对象存储',
      },
    },
  },

  /* Top-level nav */
  nav: {
    home: '首页',
    files: '文件',
    console: '控制台',
    login: '登录',
    logout: '退出',
  },
} as const;

export type Strings = typeof t;

/** Helper: substitute `{key}` placeholders in a string with the given map. */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    Object.prototype.hasOwnProperty.call(params, k) ? String(params[k]) : `{${k}}`,
  );
}
