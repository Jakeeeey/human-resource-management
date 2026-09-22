# Mailing Studio — Design Contract (Wave-0 Early Look)

**Module:** `src/modules/human-resource-management/mailing-studio`
**Route:** `/hrm/mailing-studio`
**Status:** Wave-0 scaffold — designed static chrome only. No canvas engine, no data, no interactions beyond visual state.

## 1. Direction

This is a **greenfield standalone module**. It is deliberately **not** derived from the old recruitment mailing module (Quill editor page + stacked cards). We are escaping that look entirely.

**Reference archetype:** a modern design-tool workspace (Figma / Framer / linear-style editors):

- Slim **left icon rail** (always visible) that expands into an **Elements panel**.
- **Floating 600 px stage** (the email artboard) centered on a subtle **dotted workspace**.
- **Contextual right property panel** (Position / Size / Style).
- **Command-style top bar**: inline template name, segmented device control, undo/redo, then `Preview` / `Send test` / `Save`.
- **Bottom status/zoom strip** (zoom, stage width, block count, early-look badge).

Tone: precise, quiet chrome; the artboard is the hero. Ornament budget is low — hierarchy comes from surface elevation (card on tinted canvas), 1 px borders, and one primary accent.

## 2. Token source of truth

Every color, radius, and font below traces to `src/app/globals.css`. **No hex literals anywhere in module code.**

| Use | Tailwind utility | CSS variable (globals.css) |
| --- | --- | --- |
| App canvas / workspace | `bg-background` | `--background` |
| Chrome surfaces (rail, panels, top bar, stage, status) | `bg-card` | `--card` |
| Default text | `text-foreground` | `--foreground` |
| Secondary / labels / status text | `text-muted-foreground` | `--muted-foreground` |
| Muted fills (segment track, badges) | `bg-muted` | `--muted` |
| Hover fill | `bg-accent` | `--accent` |
| Hairlines | `border-border` | `--border` |
| Primary accent (Save, CTA block, active rail, selection ring) | `bg-primary`, `text-primary`, `ring-primary` | `--primary` |
| Focus ring | `ring-ring`, `focus-visible:ring-ring/50` | `--ring` |
| Info badge (Early look) | `badge-info` | `--info`, `--info-bg` |
| Neutral badge (Draft) | `badge-neutral` | `bg-muted` + `border` |

**Theme:** light + dark via the existing `.dark` class — all utilities above already resolve per theme. No `dark:` overrides needed for token colors; `dark:` only for shadow weight.

**Dot grid:** workspace dots use `hsl(var(--border))` at 16 px pitch (inline `background-image`, documented here as token-traceable).

**Fonts:** `font-sans` (Geist) from `@theme inline`; numerals in status/fields use `tabular-nums`.

## 3. Geometry

| Region | Size | Notes |
| --- | --- | --- |
| Top command bar | `h-12` (48 px) | `border-b`, `bg-card` |
| Left icon rail | `w-14` (56 px) | `border-r`, `bg-card` |
| Elements panel | `w-60` (240 px) | `border-r`, `bg-card`; hidden < `md` |
| Stage (artboard) | `w-full max-w-[600px]` | `rounded-xl`, `border`, `bg-card`, elevated shadow |
| Property panel | `w-[280px]` | `border-l`, `bg-card`; hidden < `xl` |
| Status strip | `h-8` (32 px) | `border-t`, `bg-card` |
| Icon buttons | `size-8` / `size-7` | `rounded-md` |
| Chips / cards | `rounded-lg` | 8 px |
| Inputs / buttons | `rounded-md` | from `@/components/ui` primitives |
| Spacing rhythm | 4 px base | panel padding `p-3`/`p-4`, gaps `gap-2`/`gap-3` |

**Elevation:** exactly three levels — canvas (flat) → stage (`shadow-xl`, `dark:shadow-black/50`) → floating labels/badges (`shadow-sm`). Never more.

## 4. Layout anatomy

```
┌────────────────────────────────────────────────────────────────────┐
│ TOP BAR  h-12   [mark] name input · Draft │ device ▾ undo redo │ Prev Sendtest Save │
├──┬──────────────┬───────────────────────────────────┬──────────────┤
│  │ ELEMENTS     │   WORKSPACE (dotted bg-background)│  PROPERTIES  │
│R │ w-60         │      ┌─ 600px stage ─┐           │  w-280       │
│A │ chips grid   │      │  heading block │           │  Position    │
│I │ Text Image   │      │  body block    │           │  Size        │
│L │ Button …     │      │  button block  │           │  Style       │
│56│              │      └────────────────┘           │  (disabled)  │
├──┴──────────────┴───────────────────────────────────┴──────────────┤
│ STATUS  h-8     − 100% + │ 600 px │ Desktop │ 3 blocks │ Early look │
└────────────────────────────────────────────────────────────────────┘
```

Responsiveness (documented intent, enforced with responsive utilities):

| Viewport | Behavior |
| --- | --- |
| ≥ 1280 (`xl`) | Full three-column workspace |
| 1024–1279 (`lg`) | Property panel hidden; elements + stage + rail remain |
| 768–1023 (`md`) | Elements panel hidden; rail + stage only; stage stays 600 px capped by `max-w` |
| < 768 | Rail + compact top bar; device segments and secondary actions collapse (`hidden sm:flex`) |

## 5. Region specs

### 5.1 Top command bar
- Leading: 28 px primary mark tile (Lucide `Mail`) + **inline template name** (`Input`, ghost: transparent border until hover/focus) + `Draft` neutral badge.
- Center: **segmented device control** (`Desktop` / `Mobile`, `Monitor` / `Smartphone` icons) — track `bg-muted`, active segment `bg-card` + `shadow-sm`; `aria-pressed` conveys state. Followed by undo/redo icon buttons; **redo is disabled** (documents the disabled state).
- Trailing: `Preview` (outline), `Send test` (outline), `Save` (primary) — all `size="sm"` with Lucide icons.

### 5.2 Left rail
- Lucide icons only: `MousePointer2` (Select — **active**), `LayoutGrid` (Elements), `Layers`, `Settings2`; `HelpCircle` pinned bottom.
- Active item: `text-primary` + `bg-primary/10` + 2 px primary bar on the left edge.
- Inactive: `text-muted-foreground` hover → `text-foreground` + `bg-accent`.
- Every icon-only control carries `aria-label`.

### 5.3 Elements panel
- Header `Elements` (11 px uppercase, `tracking-[0.08em]`, muted).
- 2-column chip grid: **Text, Image, Button, Divider, Box, Social** — each chip: `rounded-lg border bg-card p-3`, Lucide icon (`Type`, `Image`, `MousePointerClick`, `Minus`, `Box`, `Share2`), 12 px label.
- Chip hover: `-translate-y-0.5`, border → `primary/40`, icon → `primary` (transform-only lift).
- Footer hint (honest early-look): muted 11 px “Drag onto the canvas — interaction lands with the builder engine.”

### 5.4 Stage (artboard)
- Floating card on the dotted workspace; a small `600 px` pill sits above it (`shadow-sm`, 10 px).
- Three tasteful placeholder blocks, pure static markup:
  1. **Heading** — `text-2xl font-semibold tracking-tight`.
  2. **Body** — `text-sm leading-relaxed text-muted-foreground`, two short lines.
  3. **Button** — solid `bg-primary` CTA pill (`Read the full update`).
- Each block: `group relative`; on hover a primary selection outline (`ring-1 ring-primary/50`) fades in with a floating **block label** (`opacity-0 → group-hover:opacity-100`). Clearly early-look affordance — no click handlers.

### 5.5 Property panel
- Header `Properties` + neutral badge naming the faux selection (`Heading`).
- Sections **Position** (X, Y), **Size** (W, H), **Style** (Fill, Radius, Opacity).
- Fields: `Label` (12 px muted) + `Input` — **`disabled` + `readOnly`**, decorative. Numeric values `tabular-nums`.

### 5.6 Status strip
- Left: zoom cluster (− / `100%` / +, ghost icon buttons), `600 px`, `Desktop`.
- Right: `3 blocks` + `badge-info` **“Early look”**.
- All text 11 px `text-muted-foreground` `tabular-nums`.

## 6. States

| State | Rule |
| --- | --- |
| Hover | fill → `bg-accent` (chrome) or lift `-translate-y-0.5` + `border-primary/40` (chips); 120–150 ms |
| Focus-visible | `ring-2 ring-ring/50 ring-offset-2 ring-offset-background` (ui primitives already do this) |
| Active / pressed | `active:scale-[0.98]` on primary buttons (transform only) |
| Selected | rail active style; segmented `aria-pressed=true`; block hover ring |
| Disabled | ui defaults — `disabled:opacity-50 disabled:pointer-events-none`; property inputs permanently disabled by design |
| Theme | all token-driven; verify in light **and** dark |

## 7. Motion

- **Movement = `transform` + `opacity` only.** Chip lifts, block label fades, press scale. Never animate width/height/top/left/margin/padding.
- Permitted transitions: `transform`, `opacity`, `background-color`, `border-color`, `color`, `box-shadow` — duration **120–150 ms**, default easing.
- Honor `prefers-reduced-motion`: lift/scale reduced to instant (no scripted animation exists yet anyway).

## 8. Icons & content rules

- **Lucide only** (`lucide-react`), stroke-consistent, `size-4` default in chrome, `size-3.5` in compact controls.
- **No emojis.** No icon fonts. No images.
- Copy is English, sentence case; section headers uppercase micro-labels only.

## 9. Explicit non-goals (Wave-0)

- No canvas engine (no moveable/selecto/zundo, no drag/resize/zoom logic — zoom buttons are decorative).
- No variables / merge-tag UI, no template data, no API calls, no persistence.
- No imports from `recruitment/*` or old mailing code. `@/components/ui` is import-only.
- Tokens above are the contract for Wave-1+ builder engineering; extend **here first**, then in code.
