# Brand System — heymoro Product Family

Every app heymoro ships shares the same structural design language.
Each product gets one distinctive accent color. Everything else is inherited.

---

## 1. Typography

Three families, same as the parent brand.

| Role | Family | Weights | Usage |
|------|--------|---------|-------|
| Display | Instrument Serif | Regular, Italic | H1, H2 — page titles, section heads |
| Body / UI | Plus Jakarta Sans | 400, 500, 600 | Body text, buttons, inputs, labels |
| Meta | JetBrains Mono | 400 | Eyebrows, status pills, table headers, uppercase labels |

### Type scale

```
Page title     text-3xl  (30px)   Instrument Serif Regular
Section head   text-lg   (18px)   Plus Jakarta Sans 500
Body           text-sm   (14px)   Plus Jakarta Sans 400
Meta / label   text-xs   (12px)   JetBrains Mono 400, uppercase, tracking-wide
Small          text-xs   (12px)   Plus Jakarta Sans 400
```

Rules:
- Never use Plus Jakarta Sans 700+. Use 500 (medium) or 600 (semibold) for emphasis.
- Instrument Serif italic is for accent words inside headlines only.
- JetBrains Mono is always uppercase with wide tracking.

---

## 2. Shared Color Tokens

These are constant across all heymoro products.

```css
/* Backgrounds */
--bg-page:       #FAF8F3;   /* page background — warm cream */
--bg-card:       #FFFFFF;   /* card surfaces */
--bg-elevated:   #F2EEE5;   /* subtle elevation, hover states */
--bg-divider:    #E5E0D6;   /* borders, hairlines */

/* Ink */
--ink-primary:   #2A2A28;   /* headlines, primary text — warm charcoal */
--ink-secondary: #6B6862;   /* body text, descriptions */
--ink-tertiary:  #9A9690;   /* meta, captions, disabled */

/* Semantic (same across all products) */
--success:       #047857;   /* emerald-700 — confirm, positive */
--success-soft:  #ECFDF5;   /* emerald-50 — success backgrounds */
--danger:        #DC2626;   /* red-600 — errors, destructive */
--danger-soft:   #FEF2F2;   /* red-50 — danger backgrounds */
```

**Rules:**
- Never use pure black (`#000`). Primary text is `#2A2A28`.
- Never use pure white for page backgrounds. Cards may be `#FFFFFF`.
- Borders are always `--bg-divider` at `1px`. No heavy borders.
- No color-blocked sections. The page lives in light tones.

---

## 3. Product Accent Colors

Each product gets one accent hue. From that hue, derive four tokens:

```
--accent:        the primary action color (buttons, active nav)
--accent-hover:  slightly darker for hover states
--accent-soft:   very light tint for tag backgrounds, active nav bg
--accent-muted:  the accent at low opacity for focus rings
```

### Current products

| Product | Accent | Hover | Soft | Muted |
|---------|--------|-------|------|-------|
| **heymoro.com** | `#B8975C` ochre | `#A6854A` | `#F5F0E6` | `rgba(184,151,92,0.15)` |
| **POS** | `#92400E` amber | `#78350F` | `#FFF7ED` | `rgba(146,64,14,0.15)` |
| *(future) Booking* | `#115E59` teal | `#0D4F4A` | `#F0FDFA` | `rgba(17,94,89,0.15)` |
| *(future) Invoice* | `#334155` slate | `#1E293B` | `#F1F5F9` | `rgba(51,65,85,0.15)` |

### How to pick a new product color
1. Choose a single hue that feels right for the domain.
2. Pick a dark-ish value (works as white-text button background).
3. Derive hover (10-15% darker), soft (very pale tint), muted (15% opacity).
4. That's it. Four values. Everything else is inherited.

---

## 4. Gradients

Gradients are structural, not decorative. Same rules everywhere.

- **Direction:** always top-to-bottom (`to bottom` / `to-b`).
- **Strength:** subtle — the start and end colors should be close neighbors.
- **Usage:** primary action buttons only. Never on backgrounds, cards, or text.
- **Button gradient:** `--accent` at top → 15% darker at bottom.

```css
/* POS example */
background: linear-gradient(to bottom, #92400E, #78350F);
```

---

## 5. Borders & Radius

- **Border color:** `--bg-divider` (`#E5E0D6`) — all borders.
- **Border width:** always `1px`. Never 2px+.
- **Border radius:** `16px` (`rounded-2xl`) for cards/modals, `8px` (`rounded-lg`) for inputs/buttons.
- **Dividers inside cards:** `--bg-divider` at `1px`, or `rgba(42,42,40,0.08)`.

---

## 6. Shadows

Three tiers of elevation:
- `shadow-sm` — passive cards, tables, default surfaces.
- `shadow-md` — active/focused elements (e.g. cart panel, hovered interactive cards).
- `shadow-lg` — shell-level containers (sidebar, main panel).
- `shadow-xl` — modals only.
- Never use colored shadows or glows.

---

## 7. Spacing

4-based scale: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

- Page padding: `24px` (`p-6`).
- Card padding: `24px` (`p-6`).
- Gap between cards: `24–32px` (`gap-6` or `gap-8`).
- Section spacing: `24–32px` (`space-y-6` or `space-y-8`).
- Inside-card spacing: `16px` (`space-y-4`).

---

## 8. Animations

Same micro-interactions across all products.

- **Button press:** `scale(0.96)` on `:active`, 120ms ease-out.
- **Fade in:** opacity 0→1 + translateY(-4px→0), 200ms ease-out.
- **Pop:** scale 1→1.18→1, 220ms ease-out (for quantity counters, badges).
- **Page transition:** opacity 0→1 + translateY(10px→0), 220ms ease-out.
- All animations respect `prefers-reduced-motion: reduce`.

---

## 9. Component Patterns

These patterns are consistent across products.

### Buttons
- **Primary:** `--accent` gradient, white text, `rounded-lg`, `text-sm font-medium`.
- **Secondary:** `--bg-divider` border, `--ink-secondary` text, transparent bg.
- **Danger:** `--danger` solid, white text. Used only for destructive confirms.
- **Disabled:** `--bg-divider` background, `--ink-tertiary` text. No gradient.

### Inputs
- Border: `--bg-divider`, `1px`, `rounded-lg`.
- Focus: `2px` ring in `--accent-muted`, border shifts to `--accent`.
- Text: `--ink-primary`, placeholder: `--ink-tertiary`.
- Size: `text-sm`, padding `px-3 py-2`.

### Tables
- Header: `text-xs uppercase tracking-wide` in JetBrains Mono, `--ink-tertiary`.
- Rows: `--ink-primary` for data, `--ink-secondary` for secondary columns.
- Row divider: `--bg-divider` at `1px`.

### Modals
- Backdrop: `rgba(0,0,0,0.3)`.
- Container: `rounded-2xl`, `shadow-xl`, max-width `lg` (512px).
- Header: title + close button, divided by `--bg-divider` border.

### Empty states
- Muted icon (stroke-only, `--ink-tertiary`), centered.
- Short message + helpful action link.

---

## 10. Implementation (Tailwind)

Map brand tokens to CSS custom properties in `index.css`, then reference
via Tailwind's arbitrary value syntax or extend the config.

```css
:root {
  --bg-page: #FAF8F3;
  --bg-card: #FFFFFF;
  --bg-elevated: #F2EEE5;
  --bg-divider: #E5E0D6;
  --ink-primary: #2A2A28;
  --ink-secondary: #6B6862;
  --ink-tertiary: #9A9690;

  /* Product: POS */
  --accent: #92400E;
  --accent-hover: #78350F;
  --accent-soft: #FFF7ED;
  --accent-muted: rgba(146,64,14,0.15);
}
```
