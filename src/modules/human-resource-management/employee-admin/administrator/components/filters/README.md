# SCM Advanced Filtering System

## Overview

The `ScmAdvancedFilters` component is the centralized hub for all supply chain filtering. It is designed to be **modular**, **URL-persistent**, and **non-destructive**.

## 🏗 The 3-Layer Architecture

To add a new filter (e.g., "Category"), follow these three steps:

### 1. State Layer (`ScmFilterProvider.tsx`)

- Add the new state variable (e.g., `selectedCategory`).
- Update the `useQuerySync` effect to include the new parameter.
- This ensures the filter survives page refreshes and is shareable via URL.

### 2. UI Layer (`ScmAdvancedFilters.tsx`)

- Pull the new state from `useScmFilters()`.
- Add a new `Select` or `Input` within the flex container.
- **Strategy**: Always use `flex-wrap` and `gap-2` to ensure the UI doesn't break on small screens.

### 3. Logic Layer (`YourReportPage.tsx`)

- Update the `filteredData` memo to include the new filter.
- **Strategy**: Use the "Guarantor Pattern" (local filtering) to ensure the UI strictly matches the selected state even if the API lags.

---

## 🤖 Master Prompt for AI Extensions

Copy and paste this prompt when asking an AI to add a new filter:

> "I want to add a new [FILTER_NAME] filter to the SCM module.
>
> 1. Update `ScmFilterProvider.tsx` to handle the state and URL sync for '[query_param_name]'.
> 2. Add an optional prop to `ScmAdvancedFilters.tsx` called 'show[FilterName]' and implement the UI using Shadcn Select. Ensure the layout remains wrapped and responsive.
> 3. Update the [YourPageName].tsx to react to this new state in its `filteredData` memo.
>    **Constraint**: Do NOT modify existing filter logic for Date Range or Supplier. Use the existing `useScmFilters` hook."

---

## 🛡 Preservation Strategy (Anti-Breakage)

1. **Optional Logic**: When adding a new filter to `ScmAdvancedFilters`, wrap it in a conditional check (Prop-driven) so it doesn't appear on reports where it's not needed.
2. **Immutable Hooks**: Never change the core signature of `useScmFilters`. Only append new values.
3. **Local Filtering Guarantor**: Always maintain the client-side `.filter()` fallback. This prevents "broken" reports if a backend API update hasn't been deployed yet.
