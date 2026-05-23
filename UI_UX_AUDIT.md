# RhinoPeak Dashboard - UI/UX Audit & Action Plan (2026 Standards)

## Overview

This document provides a comprehensive UI/UX audit of the RhinoPeak Dashboard web and mobile applications, evaluating them against modern (2026) design standards. The audit focuses on identifying areas for improvement in layout, typography, color palette, interactive elements, and overall user experience. It also serves as a step-by-step task list for implementing these improvements.

## 1. Web Application (Next.js) Audit

### 1.1 Color Palette & Variables (`globals.css`)

**Findings:**
* The current color scheme uses a mix of hex codes and `oklch` values but lacks a cohesive, modern feel.
* The contrast in dark mode could be improved for better readability.
* The accent colors (`var(--accent)`, `var(--accent-strong)`) are vibrant but lack subtle secondary variants for softer interactive states.
* "Glassmorphism" or subtle translucency (a hallmark of 2026 design) is underutilized in components like popovers and modals.

**Recommendations:**
* **Refine `oklch` palette:** Shift towards a more unified `oklch` color system for consistent lightness and chroma across both light and dark modes.
* **Introduce Translucency:** Add variables for blurred backgrounds (e.g., `var(--bg-glass)`) to use in topbars, sidebars, and modals to create depth.
* **Soften Borders:** Reduce the opacity of borders (`var(--border)`) slightly to make the UI feel less rigid.

### 1.2 Typography & Spacing

**Findings:**
* Typography relies heavily on standard system fonts or standard sans-serif. In 2026, slightly more character in the font (like Inter, Plus Jakarta Sans, or Geist) paired with tighter tracking for headings and looser leading for body text is preferred.
* Spacing (padding/margin) is generally good but can feel a bit cramped in dense data areas (like tables or grid layouts).

**Recommendations:**
* **Modern Font Stack:** Update the font stack to utilize a geometric or neo-grotesque sans-serif font if possible, or tweak existing font-weights.
* **Whitespace:** Increase padding within `Panel` components and list items to let the content "breathe".

### 1.3 Layout & Navigation (`Sidebar.tsx`, `Topbar.tsx`)

**Findings:**
* The sidebar and topbar are functional but visually flat.
* The topbar search input border transition is a good start, but focus rings across the app could be more pronounced and animated.
* Popovers (profile, notifications) lack a distinct drop shadow or backdrop blur that separates them from the content beneath.

**Recommendations:**
* **Sidebar:** Add a subtle right border or a very faint right-side shadow. Highlight active states with a softer background fill and a more prominent indicator line.
* **Topbar:** Apply a backdrop blur (`backdrop-filter: blur(12px)`) to the topbar to give it a modern "floating" feel.
* **Popovers:** Increase the blur and shadow of popover menus.

### 1.4 Base Components (`Primitives.tsx`)

**Findings:**
* Buttons are solid and functional but lack micro-interactions (e.g., subtle scaling on click, gradient hover effects).
* Badges are basic.
* Input fields and controls feel slightly boxed in.

**Recommendations:**
* **Buttons:** Add subtle hover scale effects (`transform: scale(1.02)`) and refined focus rings.
* **Inputs:** Modernize inputs with softer borders and internal padding.
* **Modals:** Enhance the modal overlay with a stronger blur effect and smooth enter/exit animations.

---

## 2. Mobile Application (Flutter) Audit

### 2.1 Theme & Styling (`app_theme.dart`)

**Findings:**
* The current theme defines solid primary and accent colors but relies heavily on standard Material 3 defaults.
* While Material 3 is modern, customizing it to align perfectly with the web app's specific `oklch` or customized palette creates a stronger brand identity.
* Button shapes and input decorations are rounded (`BorderRadius.circular(18)`), which is good, but the overall contrast might need tweaking to match the refined web app.

**Recommendations:**
* **Sync Colors:** Ensure the Flutter `ColorScheme` strictly matches the updated web CSS variables (converting hex/oklch concepts where necessary).
* **Card Elevation/Borders:** Refine card borders to be thinner and use a more subtle color, mimicking the web's `var(--border)`.

### 2.2 Navigation & Interactions

**Findings:**
* Bottom navigation is standard.
* Transitions between screens should feel seamless.

**Recommendations:**
* Ensure consistency in the "More" menu and bottom navigation icons with the web app's `MobileBottomNav.tsx`.

---

## 3. Implementation Task List (Step-by-Step)

### Phase 1: Foundation (CSS & Theme)

- [ ] **Task 1.1:** Edit `src/app/globals.css`.
  - Update root and dark mode color variables (`--bg-primary`, `--bg-card`, `--border`, `--accent`) to use refined `oklch` values for better contrast and a modern feel.
  - Add specific variables for glass/translucent backgrounds (e.g., `--bg-glass`).
  - Refine shadow variables.
- [ ] **Task 1.2:** Edit `mobile/lib/app/theme/app_theme.dart`.
  - Update the `AppTheme` colors to perfectly match the new web palette.
  - Refine `InputDecorationTheme` and `CardTheme` for thinner borders and softer backgrounds.

### Phase 2: Web Layouts & Navigation

- [ ] **Task 2.1:** Edit `src/components/layout/Sidebar.tsx`.
  - Add subtle background transitions to active items.
  - Refine spacing and icon alignment.
- [ ] **Task 2.2:** Edit `src/components/layout/Topbar.tsx`.
  - Apply backdrop blur to the topbar.
  - Improve the visual pop of the search bar and notification badges.
  - Enhance popover shadow and border radius.

### Phase 3: Web Primitives & UI Components

- [ ] **Task 3.1:** Edit `src/components/ui/Primitives.tsx`.
  - **Button:** Add micro-interactions (hover scale, better focus ring).
  - **Panel:** Soften borders and improve padding.
  - **Modal:** Ensure the backdrop blur is prominent and the card shadow is deep.
  - **Badge:** Soften background colors and refine text contrast.

### Phase 4: Final Review & Submission

- [ ] **Task 4.1:** Verify changes by building the web app and checking for CSS errors.
- [ ] **Task 4.2:** Run `pre_commit_instructions` and ensure all tests/linting pass.
- [ ] **Task 4.3:** Commit and submit the code.
