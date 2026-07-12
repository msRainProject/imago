# Imago - 项目交接文档

## 项目概述
Go + React 图床系统。  
数据库：SQLite（modernc.org/sqlite，纯 Go 实现，无 CGO 依赖）  
前端：React 19 + Vite 8 + TypeScript 6 + Tailwind CSS + shadcn/ui（Radix UI）

### 目录结构

```
imago/
├── backend/             ← Go 后端
│   ├── main.go
│   ├── config.yaml
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
├── frontend/            ← React 前端
│   └── src/
│       ├── pages/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── i18n/
│       └── utils/
├── scripts/             ← 部署脚本
└── build.sh             ← 统一构建脚本
```

---

## 存储配置

```yaml
storage:
  driver: "local"   # local / r2 / s3
  local:
    path_template: "{year}/{month}"
    public_base_url: "https://images.example.com"
```

### 本地文件命名规则
- 目录：按魔法变量模板（如 `2026/06/`）
- 文件名：`12位随机字母数字.扩展名`（如 `A1b2C3d4E5f6.jpg`）
- 对外直链：`/年/随机前8位_hash前12位`（不带后缀）

### R2 / S3 存储
当 `storage.driver = "r2"` 时，使用 AWS SDK for Go v2 的 S3 兼容接口：
- Endpoint：`https://{account_id}.r2.cloudflarestorage.com`
- 对象前缀：`originals/` 和 `thumbs/`

当 `storage.driver = "s3"` 时，读取同一份配置中的 `storage.s3.*`。

---

## API 端点

所有 API 以 `/api/` 为前缀，完整接口列表见 [API.md](API.md)。

---

## 构建与部署

```bash
# 统一构建（前端 + 后端交叉编译）
./build.sh

# 单独构建后端
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o hill-images-linux .

# 部署
rsync -av backend/hill-images-linux user@server:/path/to/deploy/
rsync -av backend/config.yaml user@server:/path/to/deploy/
ssh user@server 'systemctl restart hill-images'
```

### systemd 服务示例

```
[Unit]
Description=Imago Image Hosting
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/deploy
ExecStart=/path/to/deploy/hill-images
Restart=always

[Install]
WantedBy=multi-user.target
```

### 图片处理依赖

服务需要以下系统工具：
- `ffmpeg`：通用转码、压缩
- `heif-convert`（Debian 包：`libheif-examples`）：HEIC/HEIF → PNG
- `dcraw`：DNG/RAW → PPM/PNG

安装脚本见 `scripts/install-media-deps.sh`。

---

## 默认管理员账户

首次启动后第一个注册的用户自动成为管理员。

---

## WebAuthn / Passkey 说明

- RP ID 和 RP Origin 需与访问域名匹配
- 换域名时必须在管理后台更新这两个值并重启服务
- go-webauthn 库版本：`4.7.9`
- 已知问题：后端 `CredentialCreation` 和 `CredentialAssertion` 序列化时有多一层 `publicKey` 包装，handler 已通过 `.Response` 解包

---

## 安全说明

详见 [SECURITY.md](SECURITY.md)。部署时务必：

- 将 `jwt.secret` 换成 `openssl rand -hex 32`（启动会拒绝占位/过短密钥）
- 生产设置 `GIN_MODE=release`
- 公开注册仅首用户可用；之后用管理后台创建账号
