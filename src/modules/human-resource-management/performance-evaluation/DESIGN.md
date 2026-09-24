# Performance Evaluation — UI design language

Binding for every screen in this module. Read it before touching a component.

## 1. Use the app's design system — do not invent one

`src/app/globals.css` already defines everything needed. **No hex literals, no arbitrary colour
values, no `bg-blue-500`-style one-offs.** All of these have light *and* dark values.

| Purpose | Token / helper |
|---|---|
| Page canvas | `bg-background` |
| Cards, panels | `bg-card text-card-foreground`, `border-border`, `rounded-[var(--radius)]` |
| Muted text / meta | `text-muted-foreground` |
| Brand / primary action | `bg-primary text-primary-foreground` |
| Hover surfaces | `bg-accent` |
| Success (on track, regular) | `--success` / `--success-bg` → `.badge-success` |
| Warning (due soon, PIP open) | `--warning` / `--warning-bg` → `.badge-warning` |
| Info (in progress, for regularization) | `--info` / `--info-bg` → `.badge-info` |
| Destructive (overdue, failed, separated) | `--destructive` → `.badge-destructive` |
| Tables | `.data-grid` (header `bg-muted/60`, `th` 12px semibold muted, `td` 14px, row `border-t`, hover `bg-accent/60`) |
| Numeric cells | `.td-num` (right-aligned, `tabular-nums`) |
| Density | `.density-compact` on long grids, `.density-comfortable` elsewhere |

**Status is always rendered with `StatusBadge`** (`@/components/ui/status-badge`) and a semantic
`tone` — never a raw `Badge` variant. This is the single biggest reason the module looked off-system.

## 2. Status → tone map (use exactly this)

| `probation_status` | tone | label |
|---|---|---|
| `probationary` | `info` | Probationary |
| `pip_open` | `warning` | PIP in progress |
| `recommendation_issued` | `info` | For regularization |
| `regular` | `success` | Regular |
| `terminated` | `destructive` | Separated |

Deadline colouring: **overdue → `destructive`**, **due within 30 days → `warning`**,
otherwise muted. Never colour a deadline that has already been satisfied.

## 3. Hierarchy and rhythm

- Page title 20–24px semibold; section headings 14–16px semibold; body 14px; meta 12px muted.
- One vertical rhythm: `gap-4` between blocks, `gap-6` between sections, `p-4`/`p-6` inside cards.
- Every list screen has: a **page header** (title, count, primary action) → a **filter bar** →
  the **data grid** → a **footer** with pagination and a live "showing X–Y of Z".
- Numbers always `tabular-nums`. Dates always the same human format.
- Prefer a clear empty state (icon + one sentence + the action that fixes it) over a blank panel.

## 4. The workspace is a DYNAMIC WORKFLOW, not a tab strip

**This replaces the old static 5-tab layout.** Do not render every stage at once. An employee is at
exactly one stage; show that stage, and only that stage, as editable.

Derive everything from `utils/workflow.ts` (`deriveStage`, `deriveNextAction`, `deriveProbationStatus`)
over the `WorkflowFacts` built from the workspace bundle. Never hand-roll the progression.

**Layout, top to bottom:**

1. **Hero band** — employee identity (name, department, position, date hired) on the left; the
   `StatusBadge` and the derived stage on the right. This is the anchor of the page.
2. **Stage rail** — a horizontal rail of the lifecycle nodes. The base pipeline is
   `1st Evaluation · 2nd Evaluation · Recommendation · Regularization`. A PIP node is
   **conditional**: `PIP #1` appears only once the 1st evaluation has failed (or a PIP exists for
   it), and `PIP #2` only once the 2nd evaluation has failed (or a PIP exists for it). A PIP is
   never advertised up front — it is the intermediary action a *failed* evaluation triggers, so the
   rail never shows a PIP the employee has not earned. Each node is `done` (muted, check), `active`
   (primary, emphasised), `upcoming` (dashed/muted), or `terminated` (destructive). The rail is
   **read-only state**, not navigation.
3. **Next-action card** — driven by `deriveNextAction`. Shows the label and who owns it
   (HR vs Department Head). When the action belongs to the other side, say so plainly instead of
   showing a disabled form.
4. **Active stage panel** — the form for the current stage only:
   - `first_evaluation` → `KpiSheetForm evalType="first"`
   - `second_evaluation` → `KpiSheetForm evalType="second"`
   - `pip_1` / `pip_2` → `PipForm`
   - `recommendation` / `regularization` → `RecommendationSection`
   - `closed` (regular or terminated) → no editable panel; a closing summary instead.
5. **History** — completed evaluations and PIPs as **collapsible, read-only** cards (score, band,
   result, dates, PIP outcome). Collapsed by default. This is how a past stage stays reviewable
   without cluttering the workflow.

Rules:
- Never let a user jump ahead to a future stage. The rail shows what is coming; it is not clickable.
- Early evaluation is allowed — the stage comes from data, never from the calendar.
- A `failed` PIP is absorbing: the panel becomes read-only and the rail shows `terminated`.
- `?selected=` from the roster must survive the back link.

## 5. Motion and polish

- Transitions are short (150–220ms) and only on colour, border, shadow, opacity.
- Respect `prefers-reduced-motion` — never animate anything essential.
- Elevation: `shadow-sm` at rest, `shadow-md` on hover for interactive cards. Do not stack shadows.
- Focus states must remain visible (the app's `--ring` is the focus colour).

## 6. Non-negotiables

- `src/components/ui/**` is **read/import only** — never write to it.
- All writes stay pessimistic: server call → refresh. Never optimistically flip state.
- Loading = skeletons shaped like the content. Error = inline alert with a Retry action.
- Mobile: stack gracefully below `md`; the acknowledgement screen is employee-facing and may be
  opened on a phone.
