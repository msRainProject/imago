# Hill Images — Design System

> **Status:** v1.0 (shadcn/ui) · **Owner:** frontend team · **Last updated:** 2026-07-10

本文档是 **Hill Images** React 前端（`/frontend/`）视觉决策的唯一事实来源。2026-07 由自定义 MD3 体系全面迁移到 **shadcn/ui + Tailwind CSS 语义令牌**。所有组件必须消费本文定义的令牌 —— 禁止硬编码颜色、间距和字号。

---

## 1 · 技术栈

| 层 | 方案 |
| --- | --- |
| 组件库 | shadcn/ui（`src/components/ui/`，Radix UI 原语 + Tailwind） |
| 样式 | Tailwind CSS v3，语义化 CSS 变量令牌（HSL） |
| 图标 | lucide-react（16/20px，1.5px stroke），禁止 emoji 作图标 |
| 动画 | Framer Motion（页面转场、上传交互），尊重 `prefers-reduced-motion` |
| 通知 | Sonner（经 `hooks/useToast.tsx` 封装，保持旧 API 兼容） |
| 表格 | @tanstack/react-table + shadcn Table（排序 / 多选 / 列显隐 / 批量操作） |
| 图表 | Recharts + shadcn Chart（管理控制台仪表盘） |
| 命令面板 | cmdk（全局 ⌘K / Ctrl+K，`components/CommandPalette.tsx`） |

---

## 2 · 颜色令牌

全部定义于 `src/index.css` 的 `:root`（亮色）与 `.dark`（暗色）段，`tailwind.config.js` 通过 `hsl(var(--*))` 引用。品牌紫延续自 MD3 时期。

| 令牌 | 用途 | 亮色来源 |
| --- | --- | --- |
| `--primary` / `--primary-foreground` | 品牌主色 / 其上文字 | `#6750A4` / 白 |
| `--background` / `--foreground` | 页面背景 / 默认文字 | 淡紫白 / 深墨 |
| `--card` / `--popover` | 卡片 / 浮层背景 | 近白紫 |
| `--secondary` / `--accent` | 次级容器 / 悬停态 | 淡紫容器色 |
| `--muted` / `--muted-foreground` | 弱化背景 / 次要文字 | 灰紫系 |
| `--destructive` | 危险操作 | `#B3261E` |
| `--success` / `--tertiary` | 成功 / 警示辅助色 | 绿 / 黄褐 |
| `--border` / `--input` / `--ring` | 边框 / 输入框边 / 焦点环 | outline 系 |
| `--chart-1 … --chart-5` | 图表色板 | 主色衍生 |
| `--radius` | 圆角基准 | `0.75rem` |

**规则：**

1. 业务代码禁止 `bg-white`、`text-black` 等直接颜色，一律使用语义令牌（`bg-background`、`text-muted-foreground` …）。
2. 覆盖背景色时必须同时覆盖前景色（如 `bg-primary text-primary-foreground`）。
3. 暗色模式通过 `<html class="dark">` 切换，组件本身不感知模式。

---

## 3 · 排版

- 字体：**Roboto**（`font-sans`），CJK 回退 PingFang SC / Microsoft YaHei；等宽 `font-mono` 用于代码 / 文件名。
- 字号使用 Tailwind 标准刻度：`text-xs`(12) `text-sm`(14) `text-base`(16) `text-xl`(20) `text-3xl`(30) 等。
- 页面主标题 `text-3xl font-semibold`，卡片标题 `text-base font-medium`，辅助文字 `text-sm text-muted-foreground`。
- 标题与重要文案使用 `text-balance` / `text-pretty` 优化断行；正文 `leading-relaxed`。

---

## 4 · 间距与布局

- 基础单位 4px，使用 Tailwind spacing scale（`p-4` = 16px），禁止任意值（`p-[13px]`）。
- 移动优先；布局优先 Flexbox（`flex items-center justify-between`），复杂二维用 Grid。
- 间距使用 `gap-*`，不与 margin/padding 混用在同一元素，不使用 `space-*`。
- 顶部导航：玻璃拟态（`backdrop-blur` + 半透明背景 + 细边框），高度 `h-16`。

---

## 5 · 圆角与阴影

- 圆角由 `--radius` 派生：`rounded-md`（输入框、按钮）、`rounded-lg`（卡片）、`rounded-full`（头像、徽标）。
- 阴影克制使用 Tailwind 标准刻度：`shadow-sm`（静置卡片）→ `shadow-md`（悬停）→ `shadow-lg`（浮层、登录卡）。

---

## 6 · 动效

- Framer Motion 负责编排类动画（页面进入、列表交错、拖拽反馈），标准曲线 `ease: [0.2, 0, 0, 1]`。
- 悬停 / 焦点等微交互用 Tailwind `transition-colors` / `transition-shadow`（100–200ms）。
- 全局样式对 `prefers-reduced-motion` 用户禁用所有动画。

---

## 7 · 关键组件约定

| 场景 | 组件 | 说明 |
| --- | --- | --- |
| 确认操作 | `components/ConfirmDialog.tsx` | AlertDialog 封装，对外 props 稳定 |
| 复制 | `components/CopyButton.tsx` | Button(ghost) + Tooltip |
| 进度 | `components/ProgressBar.tsx` | shadcn Progress 封装 |
| 通知 | `hooks/useToast.tsx` | Sonner 封装：`toast.success/error/warning/info` |
| 命令面板 | `components/CommandPalette.tsx` | AppLayout 挂载，⌘K 唤起 |
| 仪表盘 | `components/OverviewDashboard.tsx` | 统计卡 + 上传趋势面积图 + 类型分布环图 |
| 设置表单 | `components/SettingsForm.tsx` | Input/Label/Select/Switch + Card 分组 |
| 数据表格 | 各 Admin 页面内 | TanStack Table + shadcn Table，行选择用 Checkbox |

新模式出现时：**先沉淀为 `components/` 下的可复用组件**，不要在页面内堆内联样式。

---

## 8 · 文件与职责

| 文件 | 职责 |
| --- | --- |
| `src/index.css` | 颜色令牌（`:root` / `.dark`）+ Tailwind 层 |
| `tailwind.config.js` | 令牌到工具类的映射（单一事实来源） |
| `components.json` | shadcn CLI 配置 |
| `src/lib/utils.ts` | `cn()` 类名合并工具 |
| `src/components/ui/` | shadcn 基础组件（勿手改样式约定之外的逻辑） |
| `src/components/AppLayout.tsx` | 玻璃拟态顶栏 + 命令面板 + `<Outlet />` |
| `DESIGN.md` | 本文档 |

设计系统变更时，本文档必须与令牌改动在同一 PR 中更新。
