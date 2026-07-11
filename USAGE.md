# Imago 使用手册

本文档描述当前 Go + React 前端的实际行为。接口细节见 [API.md](API.md)，部署见 [HANDOVER.md](HANDOVER.md)。

---

## 1. 页面路由

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 上传首页 | 拖拽 / 多文件上传 + 公开统计。**需要登录**。 |
| `/login` | 登录 | 密码登录 / Passkey 登录 |
| `/files` | 文件管理 | 分页、搜索、复制链接、重命名、删除、批量删除 |
| `/admin` | 管理控制台 | 5 个页签（见下） |

旧链接兼容：`/admin/files` 与 `/admin?tab=files` 会自动跳到 `/files`。

### 命令面板（⌘K）

登录后任意页面按 `⌘K` / `Ctrl+K`（或点顶栏「搜索」按钮）打开命令面板，可快速跳转到首页、文件管理、控制台各页签等。底层使用 `cmdk`。

### 管理控制台页签（`/admin`）

| 页签 | 实际内容 |
|------|----------|
| 概览（默认）| 仪表盘：图片数 / 总大小 / 用户数卡片 + 近 14 天上传趋势（面积图）+ 文件类型分布（饼图，取前 5）|
| 系统设置 | 站点信息、上传限制、WebAuthn 配置 |
| 存储驱动 | 切换 local / R2 / S3，填对应凭证 |
| API Token | 即 **API 授权** 页：管理应用 API Key（每个 Key 独立命名空间）|
| 用户管理 | 创建 / 编辑 / 删除用户（仅管理员）|
| 个人中心 | 昵称、修改密码、Passkey 管理（当前登录用户自己）|

> 注意：「API Token」这个页签现在渲染的是应用 API Key（`app_` 前缀），不是旧版的 `hill_` Token。旧 Token 接口（`/api/admin/tokens`）仍保留在代码里，但前端入口已切到 API Key。

---

## 2. 角色

- `admin`：可进管理控制台，管理用户、配置、存储、API Key
- `user`：可登录、上传、管理自己的个人中心

Passkey 绑定的是「当前登录用户」，用 Passkey 登录后拿到的是该用户原本的角色，不会升降级。

---

## 3. 登录

`/login` 提供两种方式：

1. **密码**：`POST /api/auth/login`，返回 JWT 写入 `localStorage`（key：`hill_token`），登录后跳回首页 `/`。
2. **Passkey**：可发现凭据流程（不需要先填用户名），浏览器弹出原生 Passkey 选择器，验证通过后写入 JWT。

---

## 4. 上传图片

### 4.1 方式

- 点击选择文件
- 拖拽上传
- 多文件同时上传（每个文件一个进度条，可单独取消）

未登录时点上传会提示先登录。

### 4.2 结果

上传成功后每个文件一个结果卡片，提供复制按钮：

- 直链
- Markdown
- HTML
- BBCode

链接以后端返回的 `url` 为准。

### 4.3 支持格式

`jpg` / `jpeg` / `png` / `gif` / `bmp` / `webp` / `ico` / `heic` / `heif` / `dng`

### 4.4 上传限制

前端上传前会调 `GET /api/upload/options` 读取服务器配置：

- `max_upload_mb`：单文件上传上限
- `allowed_ext`：允许的扩展名
- `enabled`：是否开启服务端图片处理
- `target_format`：输出格式（`original` / `jpeg` / `png` / `webp`）
- `max_size_mb` / `max_width` / `max_height`：处理目标

> 实际限制以后端当前配置为准，文档示例值不是固定的。

---

## 5. 图片处理

图片处理在 **服务端** 完成，调用系统工具：

- `ffmpeg`：通用转码、压缩、统一格式
- `heif-convert`（包：`libheif-examples`）：HEIC/HEIF 先转 PNG，避免直接转 WebP 变黑 / 丢色
- `dcraw`：DNG/RAW 先转 PPM/PNG，再交给 ffmpeg

> 前端 `processUploadFile` 目前是透传 stub，不做本地压缩；所有处理都在后端。

典型逻辑：

- 普通 JPG/PNG/WebP：直接进 ffmpeg
- HEIC/HEIF：先转中间格式再压缩 / 转码
- DNG：先 dcraw 转可处理格式，再 ffmpeg 输出

输出策略可在「系统设置」里选：保留原格式 / 统一 JPG / 统一 PNG / 统一 WebP。

---

## 6. 文件命名与公开链接

### 6.1 本地存储

- 目录：`path_template` 决定，默认 `{year}/{month}`
- 落盘文件名：12 位随机字母数字 + 扩展名（如 `A1b2C3d4E5f6.jpg`）
- 对外链接：美化链接，不是实际磁盘文件名

示例：

- 网页上传：实际 `2026/06/A1b2C3d4E5f6.jpg` → 对外 `/2026/A1b2C3d4abcdef012345`
- API Key 上传：实际 `MyBlog/posts/A1b2C3d4E5f6.webp` → 对外 `/A1b2C3d4abcdef012345`

### 6.2 R2 / S3

优先返回配置的 `public_base_url`；未配置时回退到对象存储访问 URL。

---

## 7. 文件管理（`/files`）

- 分页浏览（每页 20 条）
- 按文件名搜索（防抖 300ms）
- 缩略图预览
- 复制直链 / Markdown / HTML / BBCode
- 单文件重命名 / 删除
- 多选批量删除

---

## 8. 管理控制台（`/admin`）

### 8.0 概览（仪表盘）

默认页签，给出图床整体状态：

- 三张统计卡：图片总数、总大小、用户数（来自 `GET /api/stats`）
- 近 14 天上传趋势面积图（取最近 200 个文件按日聚合）
- 文件类型分布饼图（按扩展名取前 5）

图表用 `recharts` 渲染。

### 8.1 系统设置

- 网站标题 / 域名 / 图片访问域名 / 关键字 / 描述
- 单文件最大体积（MB）、允许的扩展名
- 上传前图片处理：`enabled` / `target_format` / `max_size_mb` / `max_width` / `max_height`
- WebAuthn：`rpid` / `rporigin`（多行，每行一个完整来源）/ `rpname`

修改后点击底部「保存设置」统一提交。

### 8.2 存储驱动

支持的驱动（前端显示 4 个，后端实际可用 3 个）：

| 驱动 | 状态 | 配置项 |
|------|------|--------|
| `local` | 可用 | 根目录、子目录模板、访问域名 |
| `r2` | 可用 | account_id / bucket / access_key / secret / endpoint / public_base_url |
| `s3` | 可用 | endpoint / region / bucket / key / secret / public_base_url / key_prefix / thumb_prefix / path_style |
| `upyun` | 仅兼容保留 | 后端不接受该驱动启动 |

切换驱动后保存，建议用一张新图验证上传与访问链接。

### 8.3 API Token（API 授权）

给博客 / App / 工作流接入用。创建的是 **API Key（`app_` 前缀）**：

- 每个 Key 有独立名称（命名空间）
- 记录：上传次数、累计流量、最后使用、创建时间
- 原始 Key 仅在创建成功时显示一次

建议按应用拆分 Key（如 `BlogA` / `Obsidian`），不要多应用共用一个。

### 8.4 用户管理（仅管理员）

- 列表 / 创建 / 编辑（用户名、角色、重置密码）/ 删除
- 不能删除当前自己登录的账号

### 8.5 个人中心

当前登录用户自己管理：

- 基本信息：用户名（只读）、昵称（可改）
- 修改密码（需输入当前密码）
- Passkey 管理：绑定新设备 / 删除已有

---

## 9. Passkey 要点

- **RP ID 与 Origin 必须和访问域名一致**。换域名后必须在「系统设置」里同步更新并重启服务，否则会报 `relying party ID 不匹配` / `registration verification failed`。
- `webauthn.rporigin` 支持多行，每行一个完整来源（带协议），例如：
  ```txt
  https://images.example.com
  https://img.example.com
  ```
- Passkey 永远绑定当前登录用户，不全局共享。

---

## 10. 常见场景

**A. 日常上传**：登录 → 首页拖图 → 复制 Markdown / 直链 → 需要删 / 改名时去 `/files`。

**B. 给博客接入**：管理员进「API Token」页 → 创建 Key → 配到博客脚本 → `POST /api/upload`，Header 用 `Authorization: Bearer app_xxx`。

**C. 启用 Passkey**：密码登录 → 「个人中心」→ 绑定新设备 → 下次登录页直接用 Passkey。

**D. 切到对象存储**：进「存储驱动」→ 选 `r2` 或 `s3` → 填凭证与 public_base_url → 保存 → 新图测试。

---

## 11. 常见问题

**Q：首页为什么不能匿名上传？**
当前产品选择要求登录后上传，不是故障。

**Q：上传后链接为什么不是原始文件名？**
对外链接被规范化，避免暴露原始文件名、路径与来源。

**Q：API Key 上传和网页上传路径为什么不一样？**
网页上传偏时间目录（`{year}/{month}`），API Key 上传偏应用目录（`{AppName}/{folder?}`），便于区分来源与统计。

**Q：Passkey 换域名后失效？**
Passkey 强依赖 RP ID / Origin，域名变了但配置没改就会失败。

**Q：HEIC / DNG 为什么依赖系统工具？**
这些格式的兼容处理与压缩质量更依赖成熟工具链，比纯前端或简单库转换更稳。
