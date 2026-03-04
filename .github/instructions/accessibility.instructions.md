---
description: 'WCAG 2.2 Level AA accessibility guidance'
applyTo: 'frontend/**/*.tsx, frontend/**/*.css'
---

# Accessibility Instructions

Conform to WCAG 2.2 Level AA. Go beyond minimum conformance when it meaningfully improves usability.

## Structure

- Use landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`.
- Use headings to introduce sections; do not skip heading levels.
- One `<h1>` per page, typically the first heading in `<main>`.
- Set descriptive `<title>` — prefer "Page - Section - Wardrobe Tracker".

## Keyboard and Focus

- All interactive elements must be keyboard operable.
- Tab order follows reading order and is predictable.
- Focus is always visible — never hide focus indicators.
- Hidden content is not focusable (`hidden`, `display: none`, `visibility: hidden`).
- Static content must not be tabbable (exception: `tabindex="-1"` for programmatic focus).

## Labels and Controls

- Every interactive element has a visible label.
- Labels must not disappear while entering text.
- Accessible names must contain the visible label text.
- If multiple controls share the same label (e.g., multiple "Remove" buttons), use `aria-label` that includes visible text + context.

## Forms

- Every form control has a programmatic label (`<label for="...">`).
- Required fields: indicate visually (`*`) and programmatically (`aria-required="true"`).
- Errors: `aria-invalid="true"` + `aria-describedby` pointing to error message.
- On submit with invalid input, focus the first invalid control.

## Contrast and Color

- Text contrast: at least 4.5:1 (large text 24px+: 3:1).
- Focus indicators and control boundaries: at least 3:1.
- Do not rely on color alone to convey information — always include text or icons.
- Use project CSS variables for colors — avoid scattered inline hex values.

## Images and Graphics

- Informative images: meaningful `alt` text.
- Decorative images: `alt=""` or `aria-hidden="true"`.
- SVG icons: `role="img"` with `aria-label`, or `aria-hidden="true"` if decorative.

## Responsive / Reflow

- Content must reflow at 320px without horizontal scrolling for multi-line text.
- Use `flex`/`grid` with fluid sizing; avoid fixed widths.
- Ensure all controls remain visible and operable at narrow widths.
