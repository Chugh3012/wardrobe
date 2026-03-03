# Wardrobe Tracker — UI/UX Mockups & Design Improvements

> **Version:** 1.0  
> **Last updated:** 2026-03-03  
> **Status:** Proposed  

This document presents mockups and design recommendations for improving the Wardrobe Tracker app's user interface and experience. Each section covers one screen, showing the current state analysis, the proposed wireframe, and the rationale behind each change.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Dashboard (Home)](#2-dashboard-home)
3. [Catalog](#3-catalog)
4. [Add Garment](#4-add-garment)
5. [Daily Upload ("Today")](#5-daily-upload-today)
6. [Bottom Navigation](#6-bottom-navigation)
7. [User Flow Improvements](#7-user-flow-improvements)
8. [Accessibility Enhancements](#8-accessibility-enhancements)
9. [Summary of Changes](#9-summary-of-changes)

---

## 1. Design System

### 1.1 Current State

The app uses a clean minimal palette built on CSS custom properties:

| Token                   | Current Value | Usage                    |
|-------------------------|---------------|--------------------------|
| `--color-primary`       | `#7c3aed`     | Buttons, accents         |
| `--color-primary-light` | `#ede9fe`     | Soft backgrounds         |
| `--color-surface`       | `#ffffff`     | Cards                    |
| `--color-bg`            | `#f5f3ff`     | Page background          |
| `--color-text`          | `#1e1b4b`     | Headings, body text      |
| `--color-text-secondary`| `#6b7280`     | Meta text, hints         |
| `--color-border`        | `#e5e7eb`     | Dividers, input borders  |

### 1.2 Proposed Additions

Add semantic tokens for success, warning, and error states to replace hard-coded hex values (e.g., `#fef2f2` / `#b91c1c` in `AddGarment.module.css`). This improves consistency and supports future theming (e.g., dark mode).

```
Proposed new CSS custom properties
──────────────────────────────────────────────
--color-success:          #16a34a
--color-success-light:    #f0fdf4
--color-warning:          #d97706
--color-warning-light:    #fffbeb
--color-error:            #dc2626
--color-error-light:      #fef2f2
--color-overlay:          rgba(0, 0, 0, 0.4)
```

### 1.3 Typography Scale

Standardize font sizes across all pages to a consistent scale:

```
Heading 1 (Page title):   28px / 700 weight  ← keep
Heading 2 (Section):      17px / 600 weight  ← keep
Body:                     15px / 400 weight   (align to 15px, currently mixed 14–16)
Caption / Meta:           13px / 400 weight   ← keep
Small / Label:            12px / 500 weight   ← keep
```

### 1.4 Spacing System

Adopt an 8px spacing grid to create visual rhythm:

```
4px   — tight  (inline gaps, icon–label)
8px   — compact (list item gaps)
12px  — default (card gaps, grid gaps)
16px  — medium  (page horizontal padding)
24px  — large   (section spacing)
32px  — extra   (empty state padding)
48px  — hero    (featured upload area padding)
```

---

## 2. Dashboard (Home)

### 2.1 Current State Analysis

- ✅ Clean header with title and subtitle
- ✅ Two stat cards (Total Items, Total Wears)
- ⚠️ Most/Least Worn are text-only lists — no garment thumbnails
- ⚠️ No visual hierarchy between sections
- ⚠️ Empty state uses emoji only — no actionable guidance
- ⚠️ No greeting or personalization

### 2.2 Proposed Wireframe

```
┌──────────────────────────────────┐
│  Good morning! 👋                │
│  My Wardrobe                     │
│  Your outfit wear stats          │
├──────────────────────────────────┤
│                                  │
│  ┌──────────┐  ┌──────────┐     │
│  │    12    │  │    47    │     │
│  │Total Items│  │Total Wears│    │
│  └──────────┘  └──────────┘     │
│                                  │
│  ┌──────────────────────────┐   │
│  │  📅  7-Day Activity      │   │
│  │  ▓▓░░▓▓▓░▓  5 of 7 days │   │
│  └──────────────────────────┘   │
│                                  │
│  Most Worn ──────────────────   │
│  ┌──────────────────────────┐   │
│  │ [img] Red Floral Dress   │   │
│  │        23 wears      →   │   │
│  ├──────────────────────────┤   │
│  │ [img] Blue Denim Jacket  │   │
│  │        18 wears      →   │   │
│  ├──────────────────────────┤   │
│  │ [img] Black Skirt        │   │
│  │        15 wears      →   │   │
│  └──────────────────────────┘   │
│                                  │
│  Least Worn ─────────────────   │
│  ┌──────────────────────────┐   │
│  │ [img] Green Cardigan     │   │
│  │        1 wear        →   │   │
│  ├──────────────────────────┤   │
│  │ [img] White Blouse       │   │
│  │        2 wears       →   │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │  💡 Suggestion           │   │
│  │  You haven't worn your   │   │
│  │  Green Cardigan in 30    │   │
│  │  days — try it today!    │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
┌──────────────────────────────────┐
│  📊 Home    👗 Catalog   📷 Today│
└──────────────────────────────────┘
```

### 2.3 Key Changes & Rationale

| Change | Rationale |
|--------|-----------|
| **Add time-of-day greeting** | Creates a personal, welcoming feel on first load |
| **Add 7-day activity streak bar** | Visual motivation — users see their tracking consistency at a glance |
| **Add garment thumbnails to Most/Least Worn** | Visual recognition is faster than reading text names; photos are the core data |
| **Add wear-count progress bar per item** | Gives relative context (how worn vs. least worn) |
| **Add "Suggestion" card** | Encourages engagement with underused garments; drives daily return |
| **Add chevron arrow (→) on list items** | Signals tappability — future drill-down to garment detail |

---

## 3. Catalog

### 3.1 Current State Analysis

- ✅ 2-column grid of garment cards with thumbnail, name, category, and wear count
- ✅ Floating "+" add button in the header
- ✅ Pagination with "Load More" button
- ⚠️ No search or filter capability
- ⚠️ No sorting options (e.g., by wear count, by name, by recently added)
- ⚠️ Category label is plain text — no visual differentiation
- ⚠️ No garment detail view (tapping a card does nothing)

### 3.2 Proposed Wireframe

```
┌──────────────────────────────────┐
│  My Catalog               [＋]  │
├──────────────────────────────────┤
│  ┌──────────────────────────┐   │
│  │ 🔍  Search garments...   │   │
│  └──────────────────────────┘   │
│                                  │
│  [All] [Dress] [Top] [Bottom]   │
│  [Outerwear] [Shoes] [Other] →  │
│                                  │
│  Sort: Recently Added  ▾        │
│                                  │
│  ┌────────┐  ┌────────┐        │
│  │        │  │        │        │
│  │ [photo]│  │ [photo]│        │
│  │        │  │        │        │
│  ├────────┤  ├────────┤        │
│  │Red      │  │Blue    │        │
│  │Floral   │  │Denim   │        │
│  │Dress    │  │Jacket  │        │
│  │┌─────┐ │  │┌─────┐ │        │
│  ││Dress│ │  ││Outer│ │        │
│  │└─────┘ │  │└─────┘ │        │
│  │23 wears│  │18 wears│        │
│  └────────┘  └────────┘        │
│                                  │
│  ┌────────┐  ┌────────┐        │
│  │        │  │        │        │
│  │ [photo]│  │ [photo]│        │
│  │        │  │        │        │
│  ├────────┤  ├────────┤        │
│  │Black   │  │White   │        │
│  │Skirt   │  │Blouse  │        │
│  │┌──────┐│  │┌───┐  │        │
│  ││Bottom││  ││Top│  │        │
│  │└──────┘│  │└───┘  │        │
│  │15 wears│  │2 wears │        │
│  └────────┘  └────────┘        │
│                                  │
│       [ Load More ]             │
│                                  │
└──────────────────────────────────┘
```

### 3.3 Garment Detail Sheet (New)

When a user taps a garment card, a bottom sheet slides up:

```
┌──────────────────────────────────┐
│  ┌──────────────────────────┐   │
│  │                          │   │
│  │      [Full photo]        │   │
│  │                          │   │
│  │    ← swipe for more →    │   │
│  │                          │   │
│  └──────────────────────────┘   │
│                                  │
│  Red Floral Dress               │
│  Category: Dress                │
│  Added: Jan 15, 2026            │
│                                  │
│  ── Wear History ──────────     │
│  Total: 23 wears                │
│  Last worn: Feb 28, 2026        │
│  Avg: 3.2 wears/month           │
│                                  │
│  ┌──────────────────────────┐   │
│  │   [ 🗑️ Delete Garment ]  │   │
│  └──────────────────────────┘   │
│                                  │
│        [ ✕ Close ]              │
└──────────────────────────────────┘
```

### 3.4 Key Changes & Rationale

| Change | Rationale |
|--------|-----------|
| **Add search bar** | Essential when catalog grows past 10+ items; text search by name |
| **Add horizontal category filter chips** | One-tap filtering by category; scrollable so it doesn't occupy vertical space |
| **Add sort dropdown** | Let users sort by name, wear count, date added |
| **Add colored category badge on card** | Quick visual grouping — scannable at a glance |
| **Add garment detail bottom sheet** | Enables viewing all photos, wear stats, and future delete action without leaving context |

---

## 4. Add Garment

### 4.1 Current State Analysis

- ✅ Sticky header with back button and centered title
- ✅ Photo upload area with dashed border and camera icon
- ✅ 4-column preview grid with remove button per photo
- ✅ Name input and category select
- ⚠️ Photo guidance is a small text hint — easy to miss
- ⚠️ No visual progress indicator for upload
- ⚠️ No camera vs. gallery distinction on upload
- ⚠️ Success state is basic — no animation or next-action guidance
- ⚠️ Form validation is error-driven (red banner on submit), not inline

### 4.2 Proposed Wireframe

```
┌──────────────────────────────────┐
│  ‹  Add Garment      Step 1 of 2│
├──────────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━░░░░░░░░░░░░  │ ← progress bar
│                                  │
│  📸 Photos                       │
│  ┌──────────────────────────┐   │
│  │  Tip: Use a plain back-  │   │
│  │  ground, good lighting,  │   │
│  │  and show the full item. │   │
│  │                          │   │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐│   │
│  │  │ 📷│ │ 📷│ │ 📷│ │   ││   │
│  │  │img│ │img│ │img│ │ + ││   │
│  │  │ ✕ │ │ ✕ │ │ ✕ │ │   ││   │
│  │  └───┘ └───┘ └───┘ └───┘│   │
│  │        3/8 photos        │   │
│  └──────────────────────────┘   │
│                                  │
│  Name                           │
│  ┌──────────────────────────┐   │
│  │ Red Floral Dress         │   │
│  └──────────────────────────┘   │
│                                  │
│  Category                       │
│  ┌──────────────────────────┐   │
│  │ Dress                  ▾ │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │      [ Next →  ]         │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

### 4.3 Success State (Improved)

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│           ┌─────────┐            │
│           │         │            │
│           │  [img]  │            │
│           │         │            │
│           └─────────┘            │
│                                  │
│          ✅ Saved!               │
│     Red Floral Dress             │
│     added to your catalog.       │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ Add Another ]        │   │
│  └──────────────────────────┘   │
│  ┌──────────────────────────┐   │
│  │    [ Back to Catalog ]    │   │
│  └──────────────────────────┘   │
│                                  │
│                                  │
└──────────────────────────────────┘
```

### 4.4 Key Changes & Rationale

| Change | Rationale |
|--------|-----------|
| **Add step indicator / progress bar** | Users know where they are in the process; reduces form abandonment |
| **Embed photo tip inside the photo section** | Guidance is contextual — shown exactly when needed, not as a separate banner |
| **Show "+" placeholder as last grid item** | Clear affordance to add more photos; visible count (3/8) shows remaining capacity |
| **Inline field validation** | Highlight individual fields with error border instead of top banner; faster correction |
| **Richer success state** | Show the garment thumbnail + name, plus offer "Add Another" as a primary action |
| **Upload progress indicator** | During multi-photo upload, show progress per file (especially important on slow mobile connections) |

---

## 5. Daily Upload ("Today")

### 5.1 Current State Analysis

- ✅ Large upload area with camera icon
- ✅ Confidence-based result display (high → single match, medium/low → top 3)
- ✅ Confirm button with loading state
- ✅ Tips section
- ⚠️ Photo preview is capped at 260px — may crop important details
- ⚠️ No option to retake photo before prediction completes
- ⚠️ Tips are always visible even after upload — takes space from results
- ⚠️ No visual confidence indicator (just text percentage)
- ⚠️ No "Not in my catalog" option when none of the predictions match

### 5.2 Proposed Wireframe — Upload State

```
┌──────────────────────────────────┐
│  Today's Outfit                  │
│  Upload a photo to identify      │
├──────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐   │
│  │                          │   │
│  │                          │   │
│  │     📷                    │   │
│  │                          │   │
│  │    Tap to snap a photo   │   │
│  │    or choose from gallery│   │
│  │                          │   │
│  │                          │   │
│  └──────────────────────────┘   │
│                                  │
│  ── Tips ───────────────────    │
│  📍 Good lighting               │
│  🖼️ Full outfit in frame         │
│  🔲 Plain background            │
│                                  │
│  ┌──────────────────────────┐   │
│  │  After uploading, we'll  │   │
│  │  identify your outfit    │   │
│  │  and ask you to confirm. │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

### 5.3 Proposed Wireframe — Prediction Results (High Confidence)

```
┌──────────────────────────────────┐
│  Today's Outfit                  │
│  Upload a photo to identify      │
├──────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐   │
│  │                          │   │
│  │    [Outfit Photo]        │   │
│  │                          │   │
│  │              [ 🔄 Retake]│   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │  ✨ Match Found!          │   │
│  │                          │   │
│  │  ┌────┐                  │   │
│  │  │cat │  Red Floral Dress│   │
│  │  │img │                  │   │
│  │  └────┘                  │   │
│  │                          │   │
│  │  ██████████████████░░ 92%│   │
│  │  confidence              │   │
│  │                          │   │
│  │  ┌──────────────────┐    │   │
│  │  │   ✓ Confirm      │    │   │
│  │  └──────────────────┘    │   │
│  │                          │   │
│  │  Choose different item   │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

### 5.4 Proposed Wireframe — Prediction Results (Medium/Low Confidence)

```
┌──────────────────────────────────┐
│  Today's Outfit                  │
│  Upload a photo to identify      │
├──────────────────────────────────┤
│                                  │
│  ┌──────────────────────────┐   │
│  │    [Outfit Photo]        │   │
│  │              [ 🔄 Retake]│   │
│  └──────────────────────────┘   │
│                                  │
│  Which garment are you wearing?  │
│                                  │
│  ┌──────────────────────────┐   │
│  │ ┌──┐ Red Floral Dress    │   │
│  │ │  │ ██████████░░░ 65%   │   │
│  │ └──┘                     │   │
│  ├──────────────────────────┤   │
│  │ ┌──┐ Pink Sundress       │   │
│  │ │  │ ████████░░░░░ 52%   │   │
│  │ └──┘                     │   │
│  ├──────────────────────────┤   │
│  │ ┌──┐ Maroon Wrap Dress   │   │
│  │ │  │ ████░░░░░░░░░ 28%   │   │
│  │ └──┘                     │   │
│  └──────────────────────────┘   │
│                                  │
│  ┌──────────────────────────┐   │
│  │  🚫 None of these        │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘
```

### 5.5 Proposed Wireframe — Confirmed State

```
┌──────────────────────────────────┐
│  Today's Outfit                  │
├──────────────────────────────────┤
│                                  │
│           ┌─────────┐            │
│           │         │            │
│           │ [photo] │            │
│           │         │            │
│           └─────────┘            │
│                                  │
│        ✅ Wear Recorded!         │
│                                  │
│     Red Floral Dress             │
│     Wear #24 · Mar 3, 2026      │
│                                  │
│  ┌──────────────────────────┐   │
│  │    [ Upload Another ]     │   │
│  └──────────────────────────┘   │
│                                  │
│                                  │
└──────────────────────────────────┘
```

### 5.6 Key Changes & Rationale

| Change | Rationale |
|--------|-----------|
| **Add retake button on photo preview** | Users can immediately re-photograph without resetting the entire flow |
| **Add visual confidence bar** | Progress bars are instantly readable; percentages alone require cognitive effort |
| **Show garment catalog thumbnail alongside prediction** | Visual confirmation — user compares their photo to the catalog image |
| **Add "None of these" option** | Critical escape hatch — prevents forced wrong matches, captures negative feedback for model improvement |
| **Hide tips after upload** | Reduces clutter; tips are irrelevant once the photo is taken |
| **Richer confirmed state** | Show the wear count and date; reinforces the tracking behavior |

---

## 6. Bottom Navigation

### 6.1 Current State

- 3 items: 📊 Dashboard, 👗 Catalog, 📷 Today
- Emoji-based icons
- Active state: purple text color

### 6.2 Proposed Wireframe

```
Current:
┌────────────┬────────────┬────────────┐
│    📊      │    👗      │    📷      │
│ Dashboard  │  Catalog   │   Today    │
└────────────┴────────────┴────────────┘

Proposed:
┌────────────┬────────────┬────────────┐
│   [icon]   │   [icon]   │   [icon]   │
│   Home     │  Catalog   │   Today    │
│            │            │    (●)     │
└────────────┴────────────┴────────────┘
         ↑ active = filled icon + bold label + accent dot
```

### 6.3 Key Changes & Rationale

| Change | Rationale |
|--------|-----------|
| **Replace emoji with SVG icons** | Emojis render differently across OS/browsers; SVG icons ensure visual consistency |
| **Add active indicator dot** | Clearer active state beyond just color change; better for color-blind users |
| **Rename "Dashboard" → "Home"** | Shorter, friendlier label; "Dashboard" feels corporate |
| **Add subtle badge on "Today"** | If no outfit has been recorded today, show a small dot/badge prompting action |

---

## 7. User Flow Improvements

### 7.1 First-Time User Onboarding

Currently, new users land on an empty dashboard with no guidance. Proposed onboarding flow:

```
Step 1: Welcome Screen
┌──────────────────────────────────┐
│                                  │
│        👗 Welcome to             │
│        Wardrobe Tracker!         │
│                                  │
│  Track what you wear, discover   │
│  outfit patterns, and make the   │
│  most of your closet.            │
│                                  │
│  ┌──────────────────────────┐   │
│  │     [ Get Started ]       │   │
│  └──────────────────────────┘   │
│                                  │
└──────────────────────────────────┘

Step 2: Add First Garment
┌──────────────────────────────────┐
│                                  │
│   Start by adding a garment      │
│   to your catalog.               │
│                                  │
│   ┌──────────────────────────┐  │
│   │  📷 Take photos of one   │  │
│   │  clothing item from      │  │
│   │  different angles.       │  │
│   └──────────────────────────┘  │
│                                  │
│  ┌──────────────────────────┐   │
│  │   [ Add My First Item ]   │   │
│  └──────────────────────────┘   │
│                                  │
│         Skip for now →           │
│                                  │
└──────────────────────────────────┘

Step 3: Upload First Outfit
┌──────────────────────────────────┐
│                                  │
│   Great! Now upload today's      │
│   outfit and we'll identify it.  │
│                                  │
│  ┌──────────────────────────┐   │
│  │  [ Upload Today's Outfit ]│   │
│  └──────────────────────────┘   │
│                                  │
│         Skip for now →           │
│                                  │
└──────────────────────────────────┘
```

### 7.2 Improved Empty States

Replace generic empty states with contextual, actionable guidance:

```
Dashboard Empty State (no garments yet):
┌──────────────────────────────────┐
│                                  │
│          🧺                      │
│                                  │
│    Your wardrobe is empty        │
│                                  │
│    Add your first clothing item  │
│    to start tracking what you    │
│    wear every day.               │
│                                  │
│  ┌──────────────────────────┐   │
│  │  [ + Add First Garment ]  │   │
│  └──────────────────────────┘   │
│                                  │
│  ── How it works ────────────   │
│  1. 📸 Add garment photos       │
│  2. 📷 Upload daily outfit      │
│  3. ✅ Confirm the match        │
│  4. 📊 See your stats grow      │
│                                  │
└──────────────────────────────────┘
```

### 7.3 Navigation Shortcuts

Add contextual quick-action buttons:

- **Dashboard → "Upload Today's Outfit"** floating action button (if no wear recorded today)
- **Catalog → Recently added garment** highlighted with "New" badge for 24 hours
- **After confirming a wear → Dashboard** auto-refreshes stats when user navigates back

---

## 8. Accessibility Enhancements

### 8.1 Current Strengths
- ✅ WCAG-compliant 44×44px touch targets
- ✅ Semantic HTML elements (`<header>`, `<section>`, `<main>`)
- ✅ `aria-label` on interactive elements
- ✅ System font stack for optimal readability

### 8.2 Proposed Improvements

| Area | Current | Proposed |
|------|---------|----------|
| **Color contrast** | Primary purple on light purple bg may fail WCAG AA | Ensure all text meets 4.5:1 ratio; test `#7c3aed` on `#ede9fe` |
| **Loading indicators** | Text-only "Loading…" | Add animated spinner with `aria-live="polite"` announcements |
| **Focus management** | No visible focus rings on mobile | Add `:focus-visible` outlines for keyboard/switch users |
| **Screen reader** | Emoji icons lack text alternatives | Add `aria-hidden="true"` on decorative emoji; use `sr-only` text for icon-only buttons |
| **Error messages** | Banner at top of form | Connect errors to fields via `aria-describedby` for screen reader association |
| **Reduced motion** | Animations always play | Add `@media (prefers-reduced-motion: reduce)` to disable transitions |
| **Dark mode** | Not supported | Define dark-mode CSS custom property values using `@media (prefers-color-scheme: dark)` |

### 8.3 Proposed Dark Mode Palette

```
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary:        #a78bfa;
    --color-primary-light:  #2e1065;
    --color-surface:        #1e1b4b;
    --color-bg:             #0f0e1a;
    --color-text:           #f5f3ff;
    --color-text-secondary: #9ca3af;
    --color-border:         #374151;
    --color-nav-bg:         #1e1b4b;
  }
}
```

---

## 9. Summary of Changes

### Priority Matrix

| # | Improvement | Impact | Effort | Priority |
|---|-------------|--------|--------|----------|
| 1 | Search & filter in Catalog | High | Medium | **P1** |
| 2 | Garment thumbnails in Dashboard lists | High | Low | **P1** |
| 3 | "None of these" option in Daily Upload | High | Low | **P1** |
| 4 | Visual confidence bars | Medium | Low | **P1** |
| 5 | Retake photo button | Medium | Low | **P1** |
| 6 | Semantic color tokens in design system | Medium | Low | **P2** |
| 7 | SVG icons in bottom nav | Medium | Low | **P2** |
| 8 | Category filter chips | Medium | Medium | **P2** |
| 9 | Garment detail bottom sheet | High | Medium | **P2** |
| 10 | First-time onboarding flow | High | Medium | **P2** |
| 11 | Inline form validation | Medium | Low | **P2** |
| 12 | 7-day activity streak | Medium | Medium | **P3** |
| 13 | Suggestion card on Dashboard | Low | Medium | **P3** |
| 14 | Dark mode support | Medium | Medium | **P3** |
| 15 | Upload progress indicator | Low | Low | **P3** |
| 16 | Reduced motion media query | Low | Low | **P3** |

### Implementation Phases

**Phase A (Quick Wins — P1):**
Garment thumbnails in dashboard, visual confidence bars, retake button, "None of these" escape hatch. These are low-effort changes that immediately improve core usability.

**Phase B (Catalog & Navigation — P2):**
Search bar, category filter chips, garment detail sheet, SVG navigation icons, semantic color tokens, onboarding flow. These require new components but use existing API data.

**Phase C (Polish — P3):**
Activity streak, suggestion engine, dark mode, upload progress, reduced-motion support. These are enhancements that improve delight and accessibility.
