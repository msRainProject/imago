# Imago - 项目交接文档

## 项目概述
Go + React 图床系统。  
数据库：SQLite（modernc.org/sqlite，纯 Go 实现，无 CGO 依赖）  
前端：React 19 + Vite 8 + TypeScript 6 + Tailwind CSS + Material Design 3

## 部署信息

### 服务器
- **IP**：`82.47.33.211`
- **OS**：Debian 13
- **SSH**：`ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes root@82.47.33.211`
- **nginx**：多处站点共存（见 `/etc/nginx/sites-enabled/`）

### 本地开发机
- **Mac**：`/Users/fuquanbin/Documents/ggto/imago/`
- **代码仓库**：`https://github.com/msRainProject/imago.git`

### 项目目录结构
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
│   ├── src/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   └── utils/
│   └── ...
├── build.sh
└── scripts/
```

---

## nginx 配置

### images.ggto.de
```
listen 443 ssl;
server_name images.ggto.de;
```
- 反代到 `http://127.0.0.1:8090`
- 证书：`/etc/nginx/ssl/ggto.crt`、`/etc/nginx/ssl/ggto.key`
- 站点配置：`/etc/nginx/sites-available/images.ggto.de`
- 当前链路：Cloudflare → nginx `:443` → `hill-images.service` `:8090`

---

## systemd 服务

### hill-images
```
systemctl status hill-images
```
- 服务文件：`/etc/systemd/system/hill-images.service`
- WorkingDirectory：`/home/www/hill-images`
- 二进制：`/home/www/hill-images/hill-images`
- 配置：`/home/www/hill-images/config.yaml`
- 数据库：`/home/www/hill-images/data/hill.db`
- 图片目录：`/home/www/hill-images/image`
- 缩略图目录：`/home/www/hill-images/cache/thumb`
- 日志：`journalctl -u hill-images -f`
- 启动命令：`systemctl restart hill-images`
- 运行用户：`www-data`

### 图片处理依赖

```bash
rsync -av -e "ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes" scripts/install-media-deps.sh root@82.47.33.211:/home/www/hill-images/install-media-deps.sh
ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes root@82.47.33.211 'bash /home/www/hill-images/install-media-deps.sh'
```

Go 服务启动时会自检这些命令并写入日志；也可以通过 `/api/health` 查看 `media_dependencies`。

---

## 存储配置

配置在 `/home/www/hill-images/config.yaml`：

```yaml
storage:
  driver: "local"   # local / r2 / s3
  local:
    path_template: "{year}/{month}"
    public_base_url: "https://images.ggto.de"
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

所有 API 以 `/api/` 为前缀，通过 nginx 代理到 Go 后端 `127.0.0.1:8090`。

完整接口列表见 [API.md](API.md)。

---

## 默认管理员账户
- 用户名：`admin`
- 密码：`admin123`

---

## WebAuthn / Passkey 说明

- RP ID 当前配置为 `images.ggto.de`
- RP Origin：`https://images.ggto.de`
- 如果换域名访问，必须更新这两个值并重启 `hill-images`
- go-webauthn 库版本：`4.7.9`
- 已知问题：后端 `CredentialCreation` 和 `CredentialAssertion` 序列化时有多一层 `publicKey` 包装，handler 已通过 `.Response` 解包

---

## 构建与部署

```bash
# 统一构建（前端 + 后端交叉编译）
./build.sh

# 单独构建后端
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o hill-images-linux .

# 部署
rsync -av -e "ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes" backend/hill-images-linux root@82.47.33.211:/home/www/hill-images/hill-images
rsync -av -e "ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes" backend/config.yaml root@82.47.33.211:/home/www/hill-images/config.yaml
ssh -i ~/.ssh/mushan -o IdentitiesOnly=yes root@82.47.33.211 'systemctl restart hill-images'
```

---

## 安全说明

Go 版本在设计上已避免此前 PHP 版本发现的所有漏洞：
- 无 SQL 注入（GORM 参数化查询）
- JWT 替代会话 Cookie
- 存储路径遍历防护（realpath 校验）
- WebAuthn 完整签名验证
- CSRF token 机制
- 速率限制（按 IP）
