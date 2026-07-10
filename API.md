# Imago API 文档

## 快速接入（博客 / App 上传图片）

**三步搞定：**

1. 登录管理后台 → **API 令牌** → 新建一个 Token（输入 App 名称，如 `MyBlog`）
2. 用 Token 上传图片，拿到直链 URL
3. 把 URL 放进文章

```bash
# 创建 Token 后拿到的 app key（只显示一次，请保存）
app_07c3456e9aeaf7a2591978b8a05e696e

# 上传
curl -X POST https://images.ggto.de/api/upload \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"

# 响应
{"code":200,"data":{"hash":"1a9be62f...","url":"https://images.ggto.de/tx2U5p5K1a9be62fdeeb","size":98,"width":70,"height":70}}
```

---

## 基础信息

| 项目 | 说明 |
|------|------|
| Base URL | `https://images.ggto.de` |
| 协议 | HTTPS |
| 上传格式 | `multipart/form-data` |
| 其他格式 | `application/json` |
| 响应包装 | `{ "code": 200, "data": ... }` |

---

## 认证

### API Key（推荐 — 用于博客 / App 接入）

Token 格式：`app_<32位十六进制>`

放在 `Authorization` Header 中：

```
Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e
```

**特点：**
- 每个 Token 绑定一个 **App 名称**（如 `MyBlog`），上传的文件存储在独立的 `{App名称}/` 目录下
- 可指定子文件夹：`POST /api/upload?folder=posts`
- Token 只在创建时显示一次，请妥善保存
- 在管理后台 → API 令牌 可以查看 / 删除

### JWT（Web 前端使用）

登录后获取，放在 `Authorization: Bearer <jwt>` 中。用于管理操作（文件列表、删除、重命名等），有效期约 24 小时。

---

## 核心接口

### 上传图片

```
POST /api/upload
```

**认证：** API Key 或 JWT

**Query 参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `folder` | 否 | 子文件夹名称（仅 API Key 上传有效，如 `folder=posts` → 存入 `MyBlog/posts/`） |

**Body（multipart/form-data）：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `file` | 是 | 图片文件 |

**支持格式：** `jpg, jpeg, png, gif, bmp, webp, ico, heic, heif, dng`

**大小限制：** 单文件最大 100 MB

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "hash": "1a9be62fdeebaeed4169263932bba27a8ec6bd40a40916d78ada371dd7d72b6d",
    "url": "https://images.ggto.de/tx2U5p5K1a9be62fdeeb",
    "size": 98,
    "width": 70,
    "height": 70
  }
}
```

**字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `hash` | string | 文件 SHA-256 哈希（唯一标识） |
| `url` | string | **图片直链**，可直接用于博客或 Markdown |
| `size` | int | 文件大小（字节） |
| `width` | int | 图片宽度（像素） |
| `height` | int | 图片高度（像素） |

**URL 格式说明：**

| 上传方式 | 存储路径 | 直链 URL |
|---------|---------|---------|
| API Key 上传 | `{AppName}/{folder?}/{random12}.webp` | `https://images.ggto.de/{rand8}{hash12}` |
| API Key + folder | `MyBlog/posts/{random12}.webp` | `https://images.ggto.de/{rand8}{hash12}` |
| Web 网页上传 | `{year}/{month}/{random12}.webp` | `https://images.ggto.de/{year}/{rand8}{hash12}` |

> **注意：**
> - 同一文件重复上传不会创建新记录，直接返回已有 URL（基于内容哈希去重）
> - 服务器自动压缩和转码（JPEG → WebP），返回处理后的结果
> - API Key 上传的 URL 无年份前缀，更简洁

---

### 查询上传配置

```
GET /api/upload/options
```

**认证：** 无需

**响应示例：**

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

> 博客 / App 可先调用此接口获取服务器配置，据此决定是否压缩后再上传。

---

### 获取图片信息

```
GET /api/files/:hash
```

**认证：** JWT 或 API Key

**响应示例：**

```json
{
  "code": 200,
  "data": {
    "id": "35a51718-ee4a-47db-9d3c-e820dbb4968b",
    "hash": "1a9be62fdeebaeed4169263932bba27a8ec6bd40a40916d78ada371dd7d72b6d",
    "name": "tx2U5p5K1a9b.webp",
    "original_name": "photo.jpg",
    "mime_type": "image/webp",
    "url": "https://images.ggto.de/tx2U5p5K1a9be62fdeeb",
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

**认证：** 无需（首次访问自动生成）

返回 WebP 格式缩略图，适合作为文章配图预加载。

---

### 通过直链访问

**无需认证**，可直接作为 `<img>` src 或 Markdown `![](url)`。

```
# API Key 上传的图片（无年份前缀）
https://images.ggto.de/{rand8}{hash12}

# Web 上传的图片（带年份前缀）
https://images.ggto.de/{year}/{rand8}{hash12}
```

- 返回 Content-Type 根据实际 MIME 类型，浏览器正确渲染
- 缓存头：`Cache-Control: public, max-age=31536000`（一年）

---

## 博客接入示例

### cURL

```bash
# 基本上传
curl -X POST https://images.ggto.de/api/upload \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"

# 上传到子文件夹
curl -X POST "https://images.ggto.de/api/upload?folder=posts" \
  -H "Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e" \
  -F "file=@photo.jpg"

# 上传前查询配置
curl https://images.ggto.de/api/upload/options
```

### Python

```python
import requests

API_URL = "https://images.ggto.de/api/upload"
API_KEY = "app_07c3456e9aeaf7a2591978b8a05e696e"

def upload_image(file_path: str, folder: str = None) -> str:
    """上传图片，返回直链 URL。folder 可选，指定子文件夹。"""
    url = API_URL
    if folder:
        url += f"?folder={folder}"
    with open(file_path, "rb") as f:
        resp = requests.post(
            url,
            headers={"Authorization": f"Bearer {API_KEY}"},
            files={"file": f},
        )
    resp.raise_for_status()
    return resp.json()["data"]["url"]

# 使用
url = upload_image("photo.jpg", folder="posts")
print(f"![]({url})")  # Markdown 图片
```

### JavaScript / Node.js

```javascript
async function uploadImage(file, folder = null) {
  const form = new FormData();
  form.append("file", file);

  let url = "https://images.ggto.de/api/upload";
  if (folder) url += `?folder=${folder}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer app_07c3456e9aeaf7a2591978b8a05e696e" },
    body: form,
  });
  const { data } = await res.json();
  return data.url;
}

// 浏览器中使用
const url = await uploadImage(fileInput.files[0], "posts");
```

### WordPress / PHP

```php
function hill_upload_image($file_path, $folder = null) {
    $url = 'https://images.ggto.de/api/upload';
    if ($folder) $url .= '?folder=' . urlencode($folder);

    $ch = curl_init($url);
    $cfile = new CURLFile($file_path);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer app_07c3456e9aeaf7a2591978b8a05e696e'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $response['data']['url'] ?? null;
}
```

### Go

```go
func uploadImage(filePath, folder string) (string, error) {
    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    file, _ := os.Open(filePath)
    defer file.Close()
    part, _ := writer.CreateFormFile("file", file.Name())
    io.Copy(part, file)
    writer.Close()

    url := "https://images.ggto.de/api/upload"
    if folder != "" {
        url += "?folder=" + folder
    }
    req, _ := http.NewRequest("POST", url, body)
    req.Header.Set("Authorization", "Bearer app_07c3456e9aeaf7a2591978b8a05e696e")
    req.Header.Set("Content-Type", writer.FormDataContentType())

    resp, _ := http.DefaultClient.Do(req)
    defer resp.Body.Close()
    var result struct {
        Code int `json:"code"`
        Data struct {
            URL string `json:"url"`
        } `json:"data"`
    }
    json.NewDecoder(resp.Body).Decode(&result)
    return result.Data.URL, nil
}
```

---

## 错误码

| HTTP Status | code | 说明 |
|-------------|------|------|
| 200 | 200 | 成功 |
| 201 | 201 | 创建成功（新建 API Key） |
| 400 | 400 | 参数错误 / 不支持的文件类型 / 文件过大 |
| 401 | 401 | 未认证（Token 无效或过期） |
| 403 | 403 | 权限不足（如普通用户访问管理接口） |
| 413 | 413 | 文件超过大小限制 |
| 500 | 500 | 服务器内部错误 |

**错误响应格式：**

```json
{
  "code": 401,
  "error": "AUTH_FAILED",
  "message": "unauthorized"
}
```

---

## 管理接口（需要 JWT + 管理员权限）

### 文件管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/files` | 文件列表（分页 + 搜索） |
| `GET` | `/api/files/:hash` | 获取单个文件信息 |
| `PATCH` | `/api/files/:hash` | 重命名 |
| `DELETE` | `/api/files/:hash` | 删除文件 |
| `POST` | `/api/files/batch_delete` | 批量删除 |
| `GET` | `/api/files/:hash/thumb` | 获取缩略图（无需认证） |

**文件列表查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | int | 1 | 页码 |
| `pageSize` | int | 20 | 每页数量（1-100） |
| `search` | string | - | 搜索关键词（匹配文件名） |
| `sort` | string | `date` | 排序：`date` / `size` / `name` |

### 认证 / 用户

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/register` | 注册（第一个用户自动成为管理员） |
| `POST` | `/api/auth/login` | 登录，返回 JWT |
| `POST` | `/api/auth/logout` | 登出 |
| `POST` | `/api/auth/refresh` | 刷新 JWT |
| `GET` | `/api/auth/profile` | 获取当前用户信息 |
| `PATCH` | `/api/auth/profile` | 更新昵称 |
| `PUT` | `/api/auth/password` | 修改密码 |

### WebAuthn / Passkey

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/auth/webauthn/register/challenge` | 获取注册挑战 |
| `POST` | `/api/auth/webauthn/register/verify` | 验证注册 |
| `GET` | `/api/auth/webauthn/credentials` | 列出已绑定的凭证 |
| `DELETE` | `/api/auth/webauthn/credentials/:id` | 删除凭证 |
| `GET` | `/api/auth/webauthn/login/challenge` | 获取登录挑战 |
| `POST` | `/api/auth/webauthn/login/verify` | 验证登录 |

### 管理员

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/users` | 用户列表 |
| `POST` | `/api/admin/users` | 创建用户 |
| `PATCH` | `/api/admin/users/:id` | 编辑用户 |
| `DELETE` | `/api/admin/users/:id` | 删除用户 |
| `GET` | `/api/admin/api-keys` | API Key 列表 |
| `POST` | `/api/admin/api-keys` | 创建 API Key |
| `DELETE` | `/api/admin/api-keys/:id` | 删除 API Key |
| `GET` | `/api/admin/config` | 获取系统配置 |
| `PUT` | `/api/admin/config` | 更新系统配置 |

### 公开接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/stats` | 公开统计（图片数、存储量） |
| `GET` | `/api/upload/options` | 上传配置 |

---

## 常见问题

### Q: API Key 丢了怎么办？

在管理后台删除旧 Key，创建一个新的即可。旧 Key 立即失效。

### Q: 同一张图上传两次会怎样？

返回相同的 URL。系统基于内容哈希去重，不会重复存储。

### Q: API Key 上传和网页上传有什么区别？

| | API Key 上传 | 网页上传 |
|---|---|---|
| 认证 | `Authorization: Bearer app_xxx` | JWT（登录后自动） |
| 存储路径 | `{AppName}/{folder?}/` | `{year}/{month}/` |
| 直链格式 | `/{rand8}{hash12}` | `/{year}/{rand8}{hash12}` |
| 用途 | 博客 / App 自动上传 | 浏览器手动上传 |

### Q: folder 参数有什么用？

给 API Key 上传的图片分子文件夹。比如 `?folder=posts` 会把图片存到 `MyBlog/posts/` 目录下。不传则存到 `MyBlog/` 根目录。**注意：** 直链 URL 格式不随 folder 变化，始终是 `/{rand8}{hash12}`。

### Q: 上传后图片被压缩了？

服务器默认开启自动压缩（JPEG/PNG → WebP），目标体积由 `max_size_mb` 控制（可在管理后台调整）。如果不想被压缩，可以在管理后台关闭自动处理。
