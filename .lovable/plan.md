

## Make Product Cards Larger on Mobile

Both Quick Bill and Quick Purchase currently show product cards in a 2-column grid on mobile with small padding and text. The plan is to make them larger and more touch-friendly.

### Changes

**1. `src/pages/QuickBill.tsx`** — Product grid and card content:
- Change grid from `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` on mobile so each card takes full width
- Increase card padding from `p-3` to `p-4`
- Increase product name text from `text-sm` to `text-base`
- Increase price text from `text-base` to `text-lg`
- Increase stock/badge text from `text-[10px]` to `text-xs`
- Increase gap from `gap-2` to `gap-3`

**2. `src/pages/QuickPurchase.tsx`** — Same card enlargement:
- Same grid, padding, and text size changes as Quick Bill

This will make cards easier to tap and read on mobile (390px viewport), showing one card per row with larger text and more generous spacing.

