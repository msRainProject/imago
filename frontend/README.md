# Imago 前端

React + TypeScript + Vite + Tailwind CSS + **shadcn/ui**（Radix UI 原语）。包管理器为 **pnpm**。

## 目录

```
frontend/src/
├── main.tsx          # 入口
├── App.tsx           # 路由 + AuthGuard
├── index.css         # Tailwind + shadcn CSS 变量（亮/暗主题）
├── lib/utils.ts      # cn() 助手（clsx + tailwind-merge）
├── pages/            # Home / Login / Files / Admin(6 tab) / Profile / PasskeyManager
├── api/              # client / public / fileManager / passkey / admin / profile / types
├── components/
│   ├── ui/           # shadcn/ui 基础组件（button/card/dialog/table/tabs/chart/...）
│   ├── AppLayout.tsx         # 顶栏 + ⌘K 入口
│   ├── CommandPalette.tsx    # ⌘K 命令面板（cmdk）
│   ├── OverviewDashboard.tsx # 控制台「概览」仪表盘（recharts）
│   ├── SettingsForm.tsx
│   ├── CopyButton.tsx / ProgressBar.tsx / ConfirmDialog.tsx
├── hooks/            # useApi / useToast(sonner) / useDebounce / useUploadQueue
├── i18n/strings.ts   # 中文文案单一来源
└── utils/            # auth / format / uploadProcessing / webauthn
```

## 路由

| 路径 | 页面 | 认证 |
|------|------|------|
| `/` | 上传首页 | 需要 |
| `/login` | 登录 | 公开 |
| `/files` | 文件管理（DataTable / @tanstack/react-table）| 需要 |
| `/admin` | 管理控制台（概览 / 系统设置 / 存储驱动 / API Token / 用户管理 / 个人中心）| 需要 |

全局：`⌘K` / `Ctrl+K` 打开命令面板快速跳转。

## 开发

```bash
pnpm install
pnpm dev        # 启动 Vite 开发服务器（带 API 代理）
pnpm build      # tsc -b && vite build，产物到 dist/，由 build.sh 嵌入后端
pnpm lint       # oxlint
```

> 仓库使用 `pnpm-lock.yaml`，不要混用 npm / yarn。

## 与后端的连接

- 所有请求走相对路径 `/api/*`，开发时由 Vite 代理，生产时由 Go 同源提供
- JWT 存 `localStorage`（key：`hill_token`），由 `api/client.ts` 拦截器自动附加
- 上传用 XHR（为了进度条），支持 `Authorization: Bearer <jwt>` 或 `X-API-Token`
- 响应统一 `{ code, data }` 包装，错误由 `HttpError` 抛出
- 图片处理在服务端；前端 `utils/uploadProcessing.ts` 目前是透传 stub

详见根目录 [API.md](../API.md) 与 [USAGE.md](../USAGE.md)。
