# Imago

Go + React 图床。支持多图上传、Passkey/WebAuthn 无密码登录、API 接入、多存储后端（本地 / R2 / S3）。

> **关于名称**：`imago` 是本项目代号（拉丁语「图像」）。站点对外展示的标题可在管理后台 → 系统设置 → 网站标题 修改，前端默认文案为 `Hill Images`。

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 | Go 1.25 · Gin · GORM · SQLite（modernc，无 CGO）|
| 前端 | React 19 · TypeScript · Vite · Tailwind CSS · **shadcn/ui**（Radix UI）· Recharts · cmdk · sonner |
| 认证 | JWT（Web）· WebAuthn/Passkey · API Key（外部应用）|
| 存储 | 本地文件系统 · Cloudflare R2 · S3 兼容 |
| 图片处理 | 服务端 `ffmpeg` / `heif-convert` / `dcraw` |

## 目录结构

```
imago/
├── backend/             # Go 后端（go module 名 hill-images，沿用历史）
│   ├── main.go
│   ├── cmd/
│   ├── internal/
│   │   ├── config/
│   │   ├── handler/        # auth / image / file / admin
│   │   ├── middleware/     # jwt / jwt_or_token / csrf / ratelimit / admin
│   │   ├── models/
│   │   ├── repository/
│   │   ├── service/
│   │   ├── storage/        # local / r2 / s3
│   │   └── web/            # //go:embed 前端 dist
│   └── migrations/
├── frontend/            # React 前端
│   └── src/
│       ├── pages/          # Home / Login / Files / Admin（6 个 tab）/ Profile / PasskeyManager
│       ├── api/            # client / public / fileManager / passkey / admin / profile
│       ├── components/     # AppLayout / SettingsForm / CommandPalette / OverviewDashboard
│       │   └── ui/         # shadcn/ui 基础组件（button/card/dialog/table/tabs/...）
│       ├── hooks/          # useApi / useToast / useDebounce / useUploadQueue
│       ├── lib/utils.ts    # cn() 助手
│       ├── i18n/           # 中文文案单一来源
│       └── utils/          # auth / format / uploadProcessing / webauthn
├── scripts/             # 部署脚本（install-media-deps.sh）
└── build.sh             # 统一构建：前端 dist → 嵌入后端 → 交叉编译
```

## 快速开始

```bash
# 一键构建（前端 + 后端交叉编译，产出 backend/hill-images-linux）
./build.sh

# 后端单独运行（开发）
cd backend
cp config.yaml config.local.yaml   # 按需修改
go run .

# 前端单独运行（开发，包管理器为 pnpm）
cd frontend
pnpm install
pnpm dev
```

## 文档

- [USAGE.md](USAGE.md) — 使用手册（页面、上传、管理控制台、Passkey、存储）
- [API.md](API.md) — API 文档（认证方式、上传、文件管理、管理接口）
- [HANDOVER.md](HANDOVER.md) — 构建、部署、运维
- [SECURITY.md](SECURITY.md) — 安全说明
