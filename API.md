# Imago API 文档

## 快速接入（博客 / App 上传图片）

1. 登录管理后台 → **API Token** 页签（即 API 授权页）→ 创建 Key（输入应用名，如 `MyBlog`）
2. 用 Key 上传图片，拿到直链 URL
3. 把 URL 放进文章

```bash
# 创建后拿到的 Key（只显示一次，请保存）
app_07c3456e9aeaf7a2591978b8a05e696e

# 上传
curl -X POST https://images.example.com/api/upload \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"

# 响应
{"code":200,"data":{"hash":"1a9be62f...","url":"https://images.example.com/tx2U5p5K1a9be62fdeeb","size":98,"width":70,"height":70}}
```

---

## 基础信息

| 项目 | 说明 |
|------|------|
| Base URL | 部署域名（示例用 `https://images.example.com`）|
| 协议 | HTTPS |
| 上传格式 | `multipart/form-data` |
| 其他格式 | `application/json` |
| 成功响应 | `{ "code": 200, "data": ... }` |
| 错误响应 | `{ "code": 4xx, "error": "ERR_CODE", "message": "..." }` |

---

## 认证

后端支持三种凭证，按下面的顺序识别：

| 凭证 | Header | 用途 |
|------|--------|------|
| JWT | `Authorization: Bearer <jwt>` | Web 前端登录后获得，约 24h，用于管理操作 |
| API Key | `Authorization: Bearer app_<32 hex>` | **推荐**给博客 / App 接入，每个 Key 独立命名空间 |
| API Token（旧）| `X-API-Token: hill_<hex>` | 旧版令牌，仍兼容，前端入口已不创建 |

### API Key（推荐）

- 在 `/admin` → **API Token** 页签创建
- 每个 Key 绑定一个应用名（命名空间），文件存到 `{AppName}/{folder?}/`
- 创建时只显示一次，删除后立即失效
- 可指定子文件夹：`POST /api/upload?folder=posts`

### JWT

- `POST /api/auth/login` 获取
- Web 前端自动从 `localStorage`（key：`hill_token`）读取并附加到请求

---

## 核心接口

### 上传图片

```
POST /api/upload
```

**认证：** JWT 或 API Key 或 API Token

**Query 参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `folder` | 否 | 子文件夹（仅 API Key 上传有效，如 `folder=posts` → `MyBlog/posts/`）|

**Body（multipart/form-data）：** `file`（图片文件）

**支持格式：** `jpg, jpeg, png, gif, bmp, webp, ico, heic, heif, dng`

**大小限制：** 单文件最大 100 MB（实际由后端配置决定）

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "hash": "1a9be62fdeebaeed4169263932bba27a8ec6bd40a40916d78ada371dd7d72b6d",
    "url": "https://images.example.com/tx2U5p5K1a9be62fdeeb",
    "size": 98,
    "width": 70,
    "height": 70
  }
}
```

**字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 文件 SHA-256（唯一标识）|
| `url` | string | 图片直链，可直接用于博客 / Markdown |
| `size` | int | 字节 |
| `width` / `height` | int | 像素 |

**URL 格式：**

| 上传方式 | 存储路径 | 直链 |
|---------|---------|------|
| API Key | `{AppName}/{folder?}/{rand12}.webp` | `/{rand8}{hash12}` |
| API Key + folder | `MyBlog/posts/{rand12}.webp` | `/{rand8}{hash12}` |
| 网页上传 | `{year}/{month}/{rand12}.webp` | `/{year}/{rand8}{hash12}` |

> 同一文件重复上传返回已有 URL（基于内容哈希去重）。服务端默认压缩 / 转码后返回处理结果。

---

### 查询上传配置

```
GET /api/upload/options
```

**认证：** 无需

```json
{
  "code": 200,
  "data": {
    "enabled": true,
    "target_format": "webp",
    "max_size_mb": 0.5,
    "max_width": 2560,
    "max_height": 2560,
    "max_upload_mb": 100,
    "allowed_ext": "jpg,jpeg,png,gif,bmp,webp,ico,heic,heif,dng"
  }
}
```

---

### 获取图片信息

```
GET /api/files/:hash
```

**认证：** JWT 或 API Key 或 API Token

```json
{
  "code": 200,
  "data": {
    "id": "35a51718-ee4a-47db-9d3c-e820dbb4968b",
    "hash": "1a9be62f...",
    "name": "tx2U5p5K1a9b.webp",
    "original_name": "photo.jpg",
    "mime_type": "image/webp",
    "url": "https://images.example.com/tx2U5p5K1a9be62fdeeb",
    "thumb_url": "/api/files/1a9be62f.../thumb",
    "size": 98,
    "width": 70,
    "height": 70,
    "uploaded_at": "2026-06-25T14:35:00Z"
  }
}
```

---

### 获取缩略图

```
GET /api/files/:hash/thumb
```

**认证：** JWT 登录态，并校验文件属主（管理员可访问全部文件）。

首次访问时生成并缓存版本化 JPEG 缩略图；后续访问复用缓存。响应带长期 immutable 缓存头和 ETag。无法生成缩略图时返回错误，不会回退传输原图。

---

### 通过直链访问

**无需认证**，可直接作为 `<img>` src 或 Markdown `![](url)`。

```
# API Key 上传（无年份前缀）
https://images.example.com/{rand8}{hash12}

# 网页上传（带年份前缀）
https://images.example.com/{year}/{rand8}{hash12}
```

- Content-Type 按实际 MIME 返回
- 缓存头：`Cache-Control: public, max-age=31536000`（一年）

---

## 接入示例

### cURL

```bash
curl -X POST https://images.example.com/api/upload \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"

# 子文件夹
curl -X POST "https://images.example.com/api/upload?folder=posts" \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"
```

### Python

```python
import requests

API_URL = "https://images.example.com/api/upload"
API_KEY = "app_07c3456e9aeaf7a2591978b8a05e696e"

def upload_image(file_path: str, folder: str | None = None) -> str:
    url = API_URL if not folder else f"{API_URL}?folder={folder}"
    with open(file_path, "rb") as f:
        resp = requests.post(url, headers={"Authorization": f"Bearer {API_KEY}"}, files={"file": f})
    resp.raise_for_status()
    return resp.json()["data"]["url"]
```

### JavaScript / Node.js

```javascript
async function uploadImage(file, folder = null) {
  const form = new FormData();
  form.append("file", file);
  const url = "https://images.example.com/api/upload" + (folder ? `?folder=${folder}` : "");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer app_07c3456e9aeaf7a2591978b8a05e696e" },
    body: form,
  });
  return (await res.json()).data.url;
}
```

---

## 错误码

| HTTP | code | 说明 |
|------|------|------|
| 200 | 200 | 成功 |
| 201 | 201 | 创建成功 |
| 400 | 400 | 参数错误 / 不支持的文件类型 / 文件过大 |
| 401 | 401 | 未认证（凭证无效或过期）|
| 403 | 403 | 权限不足 |
| 413 | 413 | 文件超过大小限制 |
| 429 | 429 | 触发速率限制 |
| 500 | 500 | 服务器内部错误 |

错误响应：

```json
{ "code": 401, "error": "AUTH_FAILED", "message": "unauthorized" }
```

---

## 接口清单

### 认证

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/register` | - | 注册（第一个用户自动成为管理员）|
| `POST` | `/api/auth/login` | - | 密码登录，返回 JWT |
| `POST` | `/api/auth/refresh` | - | 刷新 JWT |
| `POST` | `/api/auth/logout` | JWT | 登出 |
| `GET` | `/api/auth/profile` | JWT | 当前用户信息 |
| `PATCH` | `/api/auth/profile` | JWT | 更新昵称（仅 `display_name`）|
| `PUT` | `/api/auth/password` | JWT | 修改密码（需当前密码）|

### WebAuthn / Passkey

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/auth/webauthn/register/challenge` | JWT | 注册挑战 |
| `POST` | `/api/auth/webauthn/register/verify` | JWT | 验证注册 |
| `GET` | `/api/auth/webauthn/credentials` | JWT | 已绑定凭证列表 |
| `DELETE` | `/api/auth/webauthn/credentials/:id` | JWT | 删除凭证 |
| `GET` | `/api/auth/webauthn/login/challenge` | - | 登录挑战（可带 `?username=`）|
| `POST` | `/api/auth/webauthn/login/verify` | - | 验证登录，返回 JWT |

### 文件

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| `GET` | `/api/files` | JWT/Key/Token | 文件列表（`page` / `pageSize` / `search` / `sort`）|
| `GET` | `/api/files/:hash` | JWT/Key/Token | 文件信息 |
| `PATCH` | `/api/files/:hash` | JWT/Key/Token | 重命名 |
| `DELETE` | `/api/files/:hash` | JWT/Key/Token | 删除 |
| `POST` | `/api/files/batch_delete` | JWT/Key/Token | 批量删除 |
| `GET` | `/api/files/:hash/thumb` | JWT | 文件管理缩略图 |
| `POST` | `/api/upload` | JWT/Key/Token | 上传 |
| `GET` | `/api/upload/options` | 无需 | 上传配置 |

### 管理（JWT + admin）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` `/` `POST` `/` `PATCH` `/` `DELETE` | `/api/admin/users`(`/`:id`)` | 用户管理 |
| `GET` `/` `POST` `/` `DELETE` | `/api/admin/api-keys`(`/`:id`)` | API Key 管理（当前前端使用）|
| `GET` `/` `POST` `/` `DELETE` | `/api/admin/tokens`(`/`:id`)` | 旧 API Token 管理（兼容保留）|
| `GET` `/` `PUT` | `/api/admin/config` | 系统配置 |

### 公开

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查（含 `media_dependencies`）|
| `GET` | `/api/stats` | 公开统计（`total_images` / `total_size` / `total_users`）|

> 另有一组 `/app/*.php` 兼容路由用于旧 PHP 前端，新系统不再使用。

---

## 常见问题

**Q：API Key 丢了怎么办？**
后台删除旧 Key，新建一个即可，旧 Key 立即失效。

**Q：同一张图上传两次？**
返回相同 URL，基于内容哈希去重，不重复存储。

**Q：API Key 上传和网页上传的区别？**

| | API Key | 网页 |
|---|---|---|
| 认证 | `Authorization: Bearer app_xxx` | JWT |
| 存储路径 | `{AppName}/{folder?}/` | `{year}/{month}/` |
| 直链 | `/{rand8}{hash12}` | `/{year}/{rand8}{hash12}` |

**Q：folder 参数有什么用？**
给 API Key 上传的图片分子文件夹，不影响直链格式。

**Q：上传后图片被压缩了？**
服务端默认开启自动压缩，目标体积由 `max_size_mb` 控制；可在「系统设置」里关闭或调整。
