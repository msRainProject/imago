# Imago 图床使用手册

## 1. 系统说明

Imago 是一套带后台管理、Passkey 登录、API 上传和多存储后端的图床系统。

由两部分组成：

- 后端：Go（Gin + GORM + SQLite）
- 前端：React + Vite + Tailwind CSS

常见使用入口：

- 首页：上传图片
- 登录页：密码登录 / Passkey 登录
- 文件管理：浏览、搜索、复制链接、重命名、删除
- 管理控制台：系统设置、存储设置、API 授权、用户管理、个人资料 / Passkey

线上环境参考见 [HANDOVER.md](HANDOVER.md)。

## 2. 角色与权限

系统目前有两类账号：

- `admin`：管理员，可进入管理控制台，管理用户、配置、存储、API Key
- `user`：普通用户，可登录、上传、管理自己的个人资料和 Passkey

说明：

- 上传页面要求先登录
- Passkey 绑定的是"当前登录用户"
- Passkey 登录后获得的是该用户原本的权限，不会降级

## 3. 页面入口

前端主要路由如下：

- `/`：上传首页
- `/login`：登录页
- `/files`：文件管理
- `/admin`：管理控制台

管理控制台页签：

- `设置`
- `存储`
- `API 授权`
- `用户`
- `个人资料 / Passkey`

## 4. 首次使用

### 4.1 登录

打开 `/login` 后可以用两种方式登录：

1. 用户名 + 密码
2. Passkey

密码登录成功后会回到首页 `/`，不会自动跳文件管理页。

### 4.2 绑定 Passkey

进入管理控制台的"个人资料 / Passkey"页后，可以绑定新的 Passkey。

当前流程：

1. 点击"绑定 Passkey"
2. 先输入这个 Passkey 的名称
3. 调起系统级 WebAuthn / Passkey 认证器
4. 绑定成功后出现在列表里

每个 Passkey 会记录：

- 名称
- 绑定时间
- 最后使用时间

## 5. 上传图片

### 5.1 上传方式

首页支持：

- 点击选择文件
- 拖拽上传
- 多文件上传

上传前如果没有登录，页面会提示先登录。

### 5.2 上传结果

上传成功后，页面会展示每个文件的结果卡片，并提供复制按钮：

- 直链
- Markdown
- HTML
- BBCode

### 5.3 支持格式

- `jpg`、`jpeg`、`png`、`gif`、`bmp`
- `webp`、`ico`
- `heic`、`heif`
- `dng`

HEIC/HEIF 会走服务端兼容处理，DNG 会先做 RAW 转码。

### 5.4 上传限制

前端会读取 `/api/upload/options` 获取当前上传配置：

- `max_upload_mb`：单文件上传上限
- `allowed_ext`：允许扩展名
- `target_format`：目标输出格式
- `max_size_mb`：目标体积上限
- `max_width` / `max_height`：最大宽高

## 6. 图片处理机制

当前图片处理是 **服务端处理**，使用系统工具：

- `ffmpeg`：通用转码、压缩
- `heif-convert`：HEIC/HEIF → PNG
- `dcraw`：DNG/RAW → PPM/PNG

处理能力：

- 自动压缩
- 自动缩放
- 统一转为指定格式（JPG/PNG/WebP）
- HEIC/HEIF 兼容转码
- DNG/RAW 兼容转码

## 7. 文件命名与公开链接

### 7.1 本地存储

- 目录：`path_template` 决定，默认 `{year}/{month}`
- 文件名：12 位随机字母数字 + 扩展名
- 对外链接：美化链接，非实际磁盘文件名

示例：`2026/06/A1b2C3d4E5f6.jpg` → `/2026/A1b2C3d4abcdef012345`

API Key 上传路径：`MyBlog/posts/A1b2C3d4E5f6.webp` → `/A1b2C3d4abcdef012345`

### 7.2 R2 / S3

对象存储下优先返回 `public_base_url`，未配置时回退到对象访问 URL。

## 8. 文件管理

文件管理页在 `/files`。

- 分页浏览
- 文件名搜索
- 查看缩略图
- 复制多种链接格式
- 单个 / 批量删除
- 重命名

## 9. 管理控制台

入口在 `/admin`。

- **设置**：网站标题、域名、上传限制、WebAuthn RP 配置、图片处理参数
- **存储**：切换 local / R2 / S3 驱动
- **API 授权**：创建 / 管理 API Key
- **用户**：管理用户（admin only）
- **个人资料**：修改昵称、密码、管理 Passkey

## 10. API 使用

详见 [API.md](API.md)。

## 11. 构建与部署

详见 [HANDOVER.md](HANDOVER.md)。

```bash
# 构建
./build.sh

# 产出：backend/hill-images-linux
```
