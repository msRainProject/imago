# 安全说明 / Security

Imago 在设计上避免了此前 PHP 版本的所有已知漏洞，并在 Go 重写后持续加固。

## 防护措施

| 风险 | 防护 |
|------|------|
| SQL 注入 | GORM 参数化查询，无原生 SQL 拼接 |
| 会话劫持 | JWT（HS256）+ JTI 黑名单；拒绝 `alg=none` / 非 HS256 |
| 默认密钥 | 启动时校验 `jwt.secret`：拒绝空值、短于 32 字符、已知占位串 |
| 路径遍历 | 本地 `safePath` 前缀边界校验；API Key 的 `folder`/`appName` 经 segment 白名单消毒 |
| Passkey 伪造 | go-webauthn 完整签名验证 + 服务器挑战码 + Origin 校验；注册 session 绑定当前用户 |
| 公开注册 | 仅允许**首个用户**自助注册并成为 admin；之后必须由管理员创建账号 |
| 暴力破解 | 全局限流 + 登录/注册/Passkey 独立更严限流（按 IP，固定窗口） |
| XSS 上传 | 拒绝 SVG（MIME + 内容启发式）；上传类型以 magic-byte 嗅探为准 |
| 元数据越权 | `GET /api/files/:hash` 校验属主或 admin（公开直链仍可匿名访问图片本身） |
| 安全响应头 | `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 等 |
| 配置写保护 | 管理端配置更新仅允许白名单 key；敏感字段 `***` / 空值表示不修改 |

## 部署检查清单

1. 将 `jwt.secret` 设为 `openssl rand -hex 32` 生成的随机值（**不要**使用仓库示例或 `CHANGE_ME_*`）
2. 生产环境使用 `GIN_MODE=release`，避免放开开发 CORS origin
3. 反代后正确配置可信代理，确保 `ClientIP()` 与限流准确
4. 首个管理员注册完成后，确认他人无法再调用 `POST /api/auth/register`
5. WebAuthn 的 `rp_id` / `rp_origin` 与对外域名一致

## 报告漏洞

如发现安全漏洞，请通过 GitHub Issues 报告，不要在公开评论中透露漏洞细节。
