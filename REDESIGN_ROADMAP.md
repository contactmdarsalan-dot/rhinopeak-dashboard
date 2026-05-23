# Complete UI/UX Redesign Roadmap (Google Principles & Thumb Zone)

This roadmap outlines the multi-step strategy to completely overhaul the Information Architecture (IA) and User Experience (UX) of both the RhinoPeak Web and Mobile applications, adhering strictly to modern Google Design (Material 3) principles and emphasizing thumb-zone accessibility for mobile.

## Sub-task 1: Mobile Core Navigation & Thumb-Zone Enforcement (CURRENTLY IN PROGRESS)
*   **Goal:** Re-architect the core mobile shell to ensure primary actions are always within reach of the user's thumb.
*   **Actions:**
    *   Refactor `AppShell` and Bottom Navigation for strict Material 3 compliance.
    *   Refactor `DashboardScreen` and `PartiesScreen`: Move all primary actions (e.g., "Add New") from the top `AppBar` to a bottom-anchored `FloatingActionButton` (FAB) or bottom sheet.
    *   Increase touch target sizes to a minimum of 48x48dp.

## Sub-task 2: Mobile Data Entry & Forms (Next Phase)
*   **Goal:** Smooth out the UX for complex data entry on mobile devices.
*   **Actions:**
    *   Refactor `SalesScreen`, `InventoryScreen`, and `QuickAddScreen`.
    *   Break down long vertical scrolling forms into step-by-step wizards (Pager or Stepper).
    *   Implement bottom-sheet pickers for dates, dropdowns, and search lookups instead of full-screen modals or standard dropdowns, keeping interactions in the thumb zone.

## Sub-task 3: Web App Information Architecture (IA) Overhaul
*   **Goal:** Improve discoverability and cognitive load on the Next.js web application.
*   **Actions:**
    *   Restructure the `Sidebar.tsx`. Group related features into collapsible categories (e.g., "Sales & Customers", "Inventory & Purchasing", "Finance").
    *   Redesign the Dashboard layout to prioritize critical KPI cards at the top left, with secondary analytics pushed to lower quadrants.
    *   Introduce "Breadcrumbs" in the `Topbar.tsx` or page headers to improve navigational context.

## Sub-task 4: Web App Action Prominence & Modals
*   **Goal:** Align web actions with Material Design principles.
*   **Actions:**
    *   Standardize all primary actions (e.g., "New Sale", "Add Product") to sit consistently at the top-right of page headers (`PanelHeader`).
    *   Refactor complex table rows: Replace inline action icons with a clean "More" (3-dot) menu that opens a dropdown, reducing visual clutter.
    *   Convert large multi-step forms into distinct route-driven wizard pages rather than massive scrollable modals.

## Sub-task 5: Micro-interactions & Final Polish (Both Platforms)
*   **Goal:** Ensure UX is "smooth" as requested.
*   **Actions:**
    *   **Mobile:** Add Hero animations for transitions between list items and detail screens. Ensure all state changes (loading, success, error) use animated snackbars or inline shimmer loaders.
    *   **Web:** Add Framer Motion transitions for route changes, expanding/collapsing sidebars, and filtering lists. Add optimistic UI updates for all CRUD operations.
