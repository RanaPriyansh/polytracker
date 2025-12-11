# Project Context
**Polymarket Whale Tracker** is an intelligence platform designed to track high-performance traders ("whales") on Polymarket.
The goal is to provide actionable insights by monitoring wallet activities, analyzing performance metrics (win rates, PnL), and detecting consensus or conflicts among tracked traders.
Users can organize traders into tiers ("Following" vs. "Watchlist") to prioritize alerts and data visibility.

# Tech Stack & Constraints
- **Framework:** Next.js 16+ (App Router architecture)
- **UI Library:** React 19 (Functional components only)
- **Styling:** Tailwind CSS v4 + Legacy CSS Variables (see Styling Standards)
- **State Management:** React Query (@tanstack/react-query) for server state; React Hooks for local state.
- **Language:** TypeScript (Strict mode enabled)
- **Package Manager:** pnpm

# Architecture & File Structure
- **`src/app`**: App Router pages, layouts, and global styles.
- **`src/components`**: Reusable UI components. Domain-specific components (e.g., `WalletManager`, `PositionCard`) live here.
- **`src/hooks`**: Custom React hooks for logic encapsulation (e.g., `useWallets`, `usePortfolio`).
- **`src/lib`**: Utilities, type definitions (`types.ts`), and constants.
- **`public`**: Static assets.

**New Code Placement:**
- **Page Routes:** Add new pages in `src/app`.
- **Business Logic:** Encapsulate complex logic in custom hooks within `src/hooks`.
- **UI Components:** Create new components in `src/components`. Prefer smaller, focused components.

# Coding Standards (The "User Style")

## Naming Conventions
- **Components:** `PascalCase` (e.g., `WalletManager.tsx`, `PositionCard.tsx`).
- **Functions/Variables:** `camelCase` (e.g., `calculatePnL`, `isLoaded`).
- **Types/Interfaces:** `PascalCase` (e.g., `WatchedWallet`, `Trade`).
- **Files:** Match the primary export name.

## Patterns & Practices
- **Functional Components:** Use function declarations (`export function Component() { ... }`). Avoid class components.
- **TypeScript:** Use strict typing. **No `any` types.** Define interfaces in `src/lib/types.ts` if shared, or locally if private.
- **Data Fetching:** Use `React Query` hooks for all async data operations. Do not use `useEffect` for data fetching.
- **Performance:**
  - Instantiate `Intl.NumberFormat` and `Intl.DateTimeFormat` outside of render cycles.
  - Optimize list rendering (use `key` props correctly).
  - Calculate derived state (e.g., current time `now`) once per render and pass it down if needed.

## Styling Standards
- **New Components:** **Use Tailwind CSS utility classes** (e.g., `px-4 py-2 bg-blue-500`). This is the preferred method for all new UI.
- **Legacy Compatibility:** The project contains a `globals.css` with a BEM-like design system (`.dashboard`, `.sidebar`, `.three-zone`).
  - **Respect existing layout classes** when integrating with the main dashboard structure.
  - **Do NOT add new global CSS classes** to `globals.css` unless absolutely necessary for shared complex animations or layouts that Tailwind cannot handle cleanly.
  - **Do NOT mix** BEM classes and Tailwind utilities randomly on the same element unless you understand the specificity implications.
- **Icons:** Use SVG icons directly or an icon library. Ensure icon-only buttons have `aria-label`.

## Security & UX
- **Input Sanitization:** Use `encodeURIComponent` for dynamic URL parameters.
- **External Links:** Always use `rel="noopener noreferrer"` for `window.open` or `target="_blank"`.
- **Accessibility:** Ensure interactive elements are keyboard accessible and labeled.

# Workflow & Commands

## Development
- **Start Dev Server:** `pnpm dev`
- **Lint Code:** `pnpm lint`
- **Type Check:** `tsc --noEmit`

## Build
- **Build for Production:** `pnpm build`

## Verification Steps
Before declaring a task "Complete":
1.  **Run Lint:** Ensure `pnpm lint` passes with no errors.
2.  **Verify UI:** Check the changed components in the browser to ensure styling matches the design system (Dark Mode).
3.  **Check Console:** Ensure no React warnings (key props, hydration errors) or console errors appear.
4.  **Type Check:** Ensure no TypeScript errors.

# "Do Not" Rules (Critical)
- **NEVER** use class-based components.
- **NEVER** use `any` as a type. If you are stuck, define a proper generic or unknown.
- **NEVER** update `package-lock.json` manually. Use `pnpm install`.
- **NEVER** create new top-level directories (e.g., `src/services`) without explicit user approval. Stick to `app`, `components`, `hooks`, `lib`.
- **NEVER** leave `console.log` statements in production code.
- **NEVER** modify `globals.css` to add component-specific styles; use Tailwind utility classes instead.
