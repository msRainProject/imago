# Imago

一款 Go + React 图床系统。支持多图上传、Passkey/WebAuthn 无密码登录、API 接入、多存储后端（本地 / R2 / S3）。

## 技术栈

| 层 | 技术 |
|------|------|
| 后端 | Go 1.25 + Gin + GORM + SQLite |
| 前端 | React 19 + TypeScript 6 + Vite 8 + Tailwind CSS + Material Design 3 |
| 认证 | WebAuthn/Passkey + JWT |
| 存储 | 本地文件系统 / Cloudflare R2 / S3 兼容 |

## 目录结构

```
imago/
├── backend/         # Go 后端
│   ├── main.go
│   ├── cmd/
│   ├── internal/
│   │   ├── config/
│   │   ├── handler/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── repository/
│   │   ├── service/
│   │   ├── storage/
│   │   └── web/
│   └── migrations/
├── frontend/        # React 前端
│   └── src/
│       ├── pages/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       └── utils/
├── scripts/         # 部署脚本
└── build.sh         # 统一构建脚本
```

## 快速开始

```bash
# 构建（前端 + 后端交叉编译）
./build.sh

# 或单独运行后端开发
cd backend
cp config.yaml config.local.yaml  # 编辑配置
go run .
```

## 文档

- [USAGE.md](USAGE.md) — 使用手册
- [API.md](API.md) — API 文档
- [HANDOVER.md](HANDOVER.md) — 部署与运维
- [SECURITY.md](SECURITY.md) — 安全说明
