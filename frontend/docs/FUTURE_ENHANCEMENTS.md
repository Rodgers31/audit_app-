# Future Enhancements

Identified during the pre-production UI audit (March 2026). These are structural improvements to tackle in a follow-up sprint.

---

## Performance

### P-1 · Dynamic imports for chart libraries (Critical)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`, `app/counties/page.tsx`

Recharts (~200 kB gzip), framer-motion, and Lucide icons are statically imported in `'use client'` pages, shipping the full bundle on first load.

**Fix:** Use `next/dynamic` with `{ ssr: false }` to code-split chart sections:

```tsx
import dynamic from 'next/dynamic';

const DebtCompositionChart = dynamic(() => import('./DebtCompositionChart'), {
  ssr: false,
  loading: () => <div className='h-72 animate-pulse bg-gray-100 rounded-xl' />,
});
```

---

### P-2 · Lazy-load InteractiveKenyaMap on homepage (High)

**File:** `app/HomeDashboardClient.tsx`

`InteractiveKenyaMap` imports `react-simple-maps` + GeoJSON eagerly on every homepage visit.

**Fix:** `dynamic(() => import('./InteractiveKenyaMap'), { ssr: false })` with a skeleton placeholder.

---

### P-3 · Break monolith page components into smaller files (Medium)

**Files:** `app/budget/page.tsx` (1566 lines), `app/debt/page.tsx` (1308 lines), `app/counties/page.tsx` (1695 lines)

Inline sub-components (`StatCard`, `DataSourcesModal`, `ChartTooltip`, etc.) prevent code splitting and make maintenance harder.

**Fix:** Extract to separate files under each route folder. Chart sections can then be dynamically imported.

---

### P-4 · Add `<Suspense>` boundaries for progressive rendering (Medium)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`, `app/counties/page.tsx`

Pages render all sections at once or show a full-page spinner. No progressive rendering of independent sections.

**Fix:** Wrap independent chart/data sections in `<Suspense fallback={<Skeleton />}>`.

---

### P-5 · SSR prefetch for Budget & Debt pages (Medium)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`

Unlike the homepage (which uses server component + `HydrationBoundary`), budget and debt pages are entirely `'use client'` — users see a loading spinner on first visit.

**Fix:** Mirror the homepage pattern:

1. Create a server component wrapper that calls `queryClient.prefetchQuery()`
2. Dehydrate and wrap the client component in `<HydrationBoundary>`

---

## Accessibility

### A-1 · Charts need accessible descriptions (High)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`

All Recharts instances (`PieChart`, `AreaChart`, `BarChart`) lack `role="img"`, `aria-label`, or alternative text. Screen readers cannot perceive any charted data.

**Fix:** Wrap each chart in a `<figure>` with `role="img"` and `aria-label` describing the data, plus a visually hidden summary table.

---

### A-2 · Kenya map needs keyboard navigation (High)

**File:** `app/HomeDashboardClient.tsx`

The interactive map relies on mouse hover/click only. Keyboard-only users cannot explore counties.

**Fix:**

- Add `tabIndex`, `onKeyDown`, and `role="button"` to map regions
- Provide a county-selector `<select>` dropdown as a keyboard-accessible alternative

---

### A-3 · DataSourcesModal needs focus trap (Medium)

**File:** `app/budget/page.tsx`

The modal handles Escape and prevents body scroll, but Tab key navigation escapes into background content.

**Fix:** Use the native `<dialog>` element or a library like Radix Dialog that handles focus trapping automatically.

---

### A-6 · Comprehensive `aria-label` pass (Medium)

**Files:** All page files

Nearly zero `aria-label` attributes on interactive elements across the entire app. Missing on:

- Sort buttons in debt loan register
- Filter buttons in counties explorer
- Year selector buttons in budget page
- Chart expand/collapse toggles

**Fix:** Systematic audit adding descriptive `aria-label` to all icon-only and ambiguous buttons.

---

## UX

### UX-1 · Empty states for zero-data responses (Medium)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`

If the API returns successfully but with empty arrays, sections render as blank whitespace instead of informative messages.

**Fix:** Show contextual empty states like: _"No loan data is currently available. Data is refreshed weekly from the National Treasury."_

---

## Code Quality

### CQ-2 · Extract duplicated helpers to shared modules (Medium)

**Files:** `app/budget/page.tsx`, `app/debt/page.tsx`, `app/counties/page.tsx`

`fmtKES()`, `fmtB()`, `pct()`, and `StatCard` are copy-pasted across three pages with slight variations.

**Fix:**

- Extract formatters to `@/lib/formatters.ts`
- Extract `StatCard` to `@/components/ui/StatCard.tsx`
- Import everywhere
