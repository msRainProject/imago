# Hill Images — Design System

> **Status:** v0.1 (foundation) · **Owner:** frontend team · **Last updated:** 2026-06-23

This document is the source of truth for visual decisions in the **Hill Images** React frontend (`/frontend/`). Every component MUST consume the tokens defined here — no hardcoded colors, spacing, or type sizes.

The system is inspired by [Material Design 3](https://m3.material.io/) (actify-style) and [actifyjs/actify](https://github.com/actifyjs/actify): clean surfaces, soft tonal palettes, and large rounded shapes. The goal is a **professional, fresh, slightly playful** aesthetic suited to a content-hosting product.

---

## 1 · Design principles

1. **Surfaces before ink.** Color and elevation are the primary hierarchy tools; type is the secondary tool.
2. **Tonal, not saturated.** We prefer MD3's "tonal palette" approach over Vivid/Material 2's high-saturation colors.
3. **4dp grid, 8dp corner, 12dp shape.** Spacing is modular and consistent.
4. **Motion is decorative, never load-bearing.** All motion respects `prefers-reduced-motion` (handled in `index.css`).
5. **Dark mode is a first-class citizen.** Tokens exist in both schemes; the dark scheme is applied via the `.dark` class on `<html>`.

---

## 2 · Color palette

All values are MD3-derived. Reference: <https://m3.material.io/styles/color/the-color-system/tokens-1d2c855a>.

### 2.1 — Primary (brand violet)

| Token | Hex | Role |
| --- | --- | --- |
| `primary` | `#6750A4` | Default brand color; filled buttons, links, focus ring |
| `primary-on` | `#FFFFFF` | Text/icons on `primary` |
| `primary-container` | `#EADDFF` | Tonal surfaces — chips, tonal buttons, badges |
| `primary-on-container` | `#21005D` | Text/icons on `primary-container` |
| `primary-50 … 900` | scale | Hover/active shades, dark mode primaries |

### 2.2 — Secondary, Tertiary, Error, Success

| Group | Default | Container | On-container | Usage |
| --- | --- | --- | --- | --- |
| **Secondary** | `#625B71` | `#E8DEF8` | `#1D192B` | Nav active, low-emphasis text |
| **Tertiary** | `#7D5260` | `#FFD8E4` | `#31111D` | Accent / admin-only surfaces |
| **Error** | `#B3261E` | `#F9DEDC` | `#410E0B` | Destructive actions, validation |
| **Success** | `#0F7B3D` | `#C8F0D2` | `#0A2D17` | Confirmations, "uploaded" toasts |

> **Note:** "Success" is an extension; MD3 doesn't define a success role. We keep it tonally consistent with the rest of the palette.

### 2.3 — Surface (light)

| Token | Hex | Usage |
| --- | --- | --- |
| `surface` | `#FEF7FF` | Page background |
| `surface-bright` | `#FFFBFE` | Dialogs, sheets |
| `surface-container` | `#F3EDF7` | Default card background |
| `surface-container-high` | `#ECE6F0` | Elevated cards, hover state |
| `surface-container-highest` | `#E6E0E9` | Modals, menus |
| `surface-variant` | `#E7E0EC` | Dividers, low-emphasis chips |
| `surface-on-variant` | `#49454F` | Body text on `surface-variant` |
| `surface-on` | `#1D1B20` | Default body text |

### 2.4 — Surface (dark)

When `<html class="dark">` is set, the `surface-dark.*` tokens take over:

- `surface-dark` → `#141218`
- `surface-dark-container` → `#211F26`
- `surface-dark-on` → `#E6E0E9`
- Primary shifts to `#D0BCFF` (MD3 dark scheme convention).

### 2.5 — Outline

| Token | Hex | Usage |
| --- | --- | --- |
| `outline` | `#79747E` | Borders, dividers, secondary text |
| `outline-variant` | `#CAC4D0` | Hairline borders, focused-input ring |

---

## 3 · Typography

We use **Roboto** as the primary family with **PingFang SC / Microsoft YaHei** for CJK fallback. JetBrains Mono is reserved for code/file names.

| Token | Size / LH / weight | Use |
| --- | --- | --- |
| `display-lg` | 57 / 64 / 400 | Hero numerals (rare) |
| `display-sm` | 36 / 44 / 400 | Hero text (mobile) |
| `headline-lg` | 32 / 40 / 400 | Page hero on `lg+` |
| `headline-md` | 28 / 36 / 400 | Page hero default |
| `headline-sm` | 24 / 32 / 400 | Section title |
| `title-lg` | 22 / 28 / 500 | Card title (large) |
| `title-md` | 16 / 24 / 500 | Card title (default) |
| `title-sm` | 14 / 20 / 500 | List item title |
| `body-lg` | 16 / 24 / 400 | Long-form copy |
| `body-md` | 14 / 20 / 400 | Default paragraph |
| `body-sm` | 12 / 16 / 400 | Captions, helper text |
| `label-lg` | 14 / 20 / 500 | Button text |
| `label-md` | 12 / 16 / 500 | Chip text, navigation |
| `label-sm` | 11 / 16 / 500 | Micro labels |

**Casing:** Sentence case in CJK; Sentence case in EN. No `UPPERCASE` except for overline labels (use sparingly).

---

## 4 · Spacing

Base unit: **4px**. The full scale is exposed as Tailwind `spacing.*` keys (`p-1` = 4 px, `p-4` = 16 px, …). Notable idioms:

| Layout slot | Token | Pixels |
| --- | --- | --- |
| Section vertical padding | `py-10` | 40 |
| Section vertical padding (lg) | `py-16` | 64 |
| Card inner padding | `p-6` | 24 |
| Stack gap (tight) | `gap-2` | 8 |
| Stack gap (default) | `gap-4` | 16 |
| Stack gap (loose) | `gap-6` | 24 |
| Inline padding (button) | `px-6` | 24 |
| App bar height | `h-16` | 64 |

Anything that needs a non-grid value is a **bug** — extend the scale in `tailwind.config.js` first.

---

## 5 · Shape (border-radius)

MD3 shape scale, exposed as `rounded-*`:

| Token | px | Usage |
| --- | --- | --- |
| `rounded-xs` | 4 | Text fields, inputs |
| `rounded-sm` | 8 | Chips, tags |
| `rounded-md` | 12 | Cards, dialogs |
| `rounded-lg` | 16 | Large cards, sheets |
| `rounded-xl` | 28 | FAB, hero containers |
| `rounded-full` | 9999 | Buttons, avatars |

Buttons are always `rounded-full`. Cards are `rounded-md` (or higher when they contain media).

---

## 6 · Elevation

MD3 elevation levels 1–5, exposed as `shadow-elev-*` plus `shadow-md3-1` (the spec's level-1 stack). Use sparingly; most surfaces rely on **tonal color** (e.g. `surface-container-high`) rather than shadow.

| Token | Use |
| --- | --- |
| `shadow-elev-0` | Flat (default) |
| `shadow-elev-1` | Resting cards |
| `shadow-elev-2` | Hover on cards |
| `shadow-elev-3` | Floating menus, popovers |
| `shadow-elev-4` | Dialogs |
| `shadow-elev-5` | Modals & sheets |

---

## 7 · Motion

| Token | Duration | Easing | Use |
| --- | --- | --- | --- |
| `duration-md3-short2` | 100 ms | `ease-md3-standard` | Hover, focus |
| `duration-md3-short4` | 200 ms | `ease-md3-standard` | Default transition |
| `duration-md3-medium2` | 300 ms | `ease-md3-emphasized` | Page enter, route change |
| `duration-md3-long2` | 500 ms | `ease-md3-emphasized-decel` | Hero reveal |

**Framer Motion** is the recommended primitive for orchestrated reveals (`<motion.div>`, `<AnimatePresence>`). Use `ease: [0.2, 0, 0, 1]` to match the MD3 standard curve.

Always respect `prefers-reduced-motion` — the global stylesheet neutralizes all transitions/animations for users who opt out.

---

## 8 · Component library

The starter component classes live in `src/index.css` under `@layer components`. They are **MD3 idiomatic**, not arbitrary Tailwind compositions.

| Class | MD3 equivalent |
| --- | --- |
| `.md3-btn-filled` | Filled button (primary) |
| `.md3-btn-tonal` | Tonal button (primary-container) |
| `.md3-btn-outlined` | Outlined button |
| `.md3-btn-text` | Text button |
| `.md3-card` / `.md3-card-elevated` / `.md3-card-filled` / `.md3-card-outlined` | Card variants |
| `.md3-text-field` | Outlined text field |
| `.md3-chip` / `.md3-chip-selected` | Assist / filter chips |

When a new pattern emerges, **add a class to the design system first** — never inline the styles in a page.

---

## 9 · Icons

We use **lucide-react** for all iconography (24 px default, 1.5 px stroke). **No emojis as icons.** The library is the only sanctioned source — adding custom SVGs requires a design review.

---

## 10 · Files & ownership

| File | Purpose |
| --- | --- |
| `tailwind.config.js` | Token definitions (single source of truth) |
| `src/index.css` | Tailwind layers + reusable component classes |
| `src/components/AppLayout.tsx` | Top app bar + `<Outlet />` |
| `DESIGN.md` | This document |

When the design system changes, update this file in the same PR as the token changes.
