# AGENTS.md - PolyTracker AI Configuration

> **Source of Truth** for AI agents working on this codebase.
> Last Updated: 2024-12-10

---

## Project Context

**PolyTracker** is a **personal trading intelligence platform** for tracking crypto prediction market (Polymarket) traders. The app:

- Tracks wallet addresses and their trading activity
- Computes win rates, sector specialization, and badges
- Provides real-time notifications on new trades
- Simulates "Ghost Portfolio" copy-trading

**Why:** The user is building a tool to follow "whale" traders and copy their strategies on Polymarket prediction markets.

---

## Tech Stack & Constraints

### Core Stack
| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16.x | App Router, Turbopack |
| React | 19.x | Functional components ONLY |
| TypeScript | 5.x | Strict mode enabled |
| TanStack Query | 5.x | For API caching |

### Critical Libraries
| Library | Purpose | Constraint |
|---------|---------|------------|
| `decimal.js` | Financial precision | **REQUIRED** for all money math |
| `zod` | Runtime validation | **REQUIRED** for all API responses |
| `lodash-es` | Utilities | Use only for debounce/throttle |
| `uuid` | ID generation | v4 only |

### Hard Constraints
- ❌ **NO class-based components**
- ❌ **NO `any` types** (use `unknown` + validation)
- ❌ **NO raw CSS files** (globals.css is an exception)
- ❌ **NO Tailwind** (project uses vanilla CSS variables)
- ✅ **Prefer early returns** over nested conditionals
- ✅ **Use `'use client'`** directive for all interactive components

---

## Architecture & File Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (DO NOT MODIFY without asking)
│   ├── page.tsx            # Home page entry
│   └── globals.css         # Design system variables + component styles
│
├── components/             # React components (PascalCase)
│   ├── Dashboard.tsx       # Main application shell
│   ├── WalletManager.tsx   # Wallet CRUD sidebar
│   ├── AggregateFeed.tsx   # Live trade feed
│   └── [Feature].tsx       # One component per file
│
├── hooks/                  # Custom React hooks (camelCase)
│   └── usePolymarket.ts    # All data fetching hooks
│
├── lib/                    # Core logic (no React)
│   ├── types.ts            # All TypeScript interfaces
│   ├── storage.ts          # localStorage wrapper (singleton)
│   ├── polymarket.ts       # API client
│   ├── analytics.ts        # Win rate / stats calculations
│   ├── validation.ts       # Zod schemas
│   └── notifications.ts    # Toast/alert system
```

### Where New Code Should Live

| Type | Location | Naming |
|------|----------|--------|
| New React component | `src/components/` | `PascalCase.tsx` |
| New hook | `src/hooks/` | `use[Name].ts` |
| New utility function | `src/lib/` | `camelCase.ts` |
| New API endpoint | Not applicable | Client-side only |
| New type/interface | `src/lib/types.ts` | `PascalCase` |

---

## Coding Standards (User Style)

### Naming Conventions
```typescript
// Components: PascalCase
export function WalletManager() { ... }

// Hooks: camelCase with "use" prefix
export function useWallets() { ... }

// Utilities: camelCase
export function formatUSD(amount: number) { ... }

// Types: PascalCase
export interface WatchedWallet { ... }

// Constants: SCREAMING_SNAKE_CASE
const STORAGE_KEY = 'polytracker_wallets';
```

### Preferred Patterns
```typescript
// ✅ Early returns
function processData(data: unknown) {
    if (!data) return null;
    if (!isValid(data)) return null;
    return transform(data);
}

// ✅ Zod validation for API data
const result = TradeSchema.safeParse(apiResponse);
if (!result.success) {
    console.warn('Invalid data:', result.error);
    return;
}

// ✅ Decimal.js for money
const pnl = new Decimal(sellValue).minus(buyValue).toNumber();

// ❌ NEVER use floating point for money
const pnl = sellValue - buyValue; // BAD!
```

### CSS Patterns
```css
/* Use CSS variables from globals.css */
.component {
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    padding: var(--space-md);
}

/* Organize with section headers */
/* ═══════════════════════════════════════════
   COMPONENT NAME
   ═══════════════════════════════════════════ */
```

---

## Workflow & Commands

### Development
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

### Verification Checklist (Before "Complete")
1. [ ] `npm run dev` shows no errors
2. [ ] No TypeScript errors in IDE
3. [ ] UI renders correctly at `http://localhost:3000`
4. [ ] New features tested with real wallet addresses
5. [ ] No browser console errors

### Real Test Wallet Addresses
```
0x8d91D3a5a8f9A1A54d0a1C0c8f5e6b7c8d9e0f1a  # Example whale
```

---

## "Do Not" Rules (Critical)

> ⚠️ **STOP AND ASK** before violating any of these rules.

### Never Touch Without Permission
- `package-lock.json` - Never edit manually
- `src/app/layout.tsx` - Root layout is sensitive
- `next.config.ts` - Build config is stable
- `tsconfig.json` - Type config is tuned

### Never Do
1. **Never use `any` type** - Use `unknown` + Zod validation
2. **Never use raw floats for money** - Use `Decimal.js`
3. **Never create new directories** without asking
4. **Never add new dependencies** without explicit approval
5. **Never remove existing features** without confirmation
6. **Never auto-approve destructive commands** (rm, drop, delete)

### Always Do
1. **Always validate API responses** with Zod schemas
2. **Always handle loading/error states** in UI components
3. **Always use debounce** for rapid user actions (300ms)
4. **Always add null checks** before accessing nested properties
5. **Always run `npm run dev`** after making changes
6. **Always use `useCallback`** for async functions in components
7. **Always use `fetchAllWalletsSafe`** for batch wallet operations
8. **Always import utilities** from `lib/utils.ts` (formatUSD, formatRelativeTime)

---

## API & Data Patterns

### Polymarket API Endpoints
```typescript
const DATA_API = 'https://data-api.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
```

### Rate Limiting
- Max 3 concurrent requests
- 1.1 second delay between batches
- Use `fetchAllWalletsSafe()` for batch operations

### Caching Strategy
- TanStack Query: 60s stale time
- Trader stats: 6-hour localStorage cache
- Refresh interval: 60s for trade monitoring

---

## Conversation History Learnings

### User Preferences (Observed)
1. **Prefers detailed implementation blueprints** before coding
2. **Values rigorous QA** - expects stress testing and edge cases
3. **Likes ASCII diagrams** for explaining architecture
4. **Expects production-quality code** - not MVPs
5. **Appreciates structured reports** with tables and severity levels

### Corrections Made During Development
1. `outcome` type changed from `"YES" | "NO"` → `string` (API flexibility)
2. `timestamp` handling: Unix epoch → ISO string conversion
3. Floating-point precision issues → Decimal.js required
4. Race conditions on rapid clicks → Debouncing required

---

## Quick Reference

### File Sizes (Lines)
| File | Lines | Status |
|------|-------|--------|
| `globals.css` | 2200+ | Design system |
| `types.ts` | 230+ | All interfaces |
| `analytics.ts` | 350+ | Core math |
| `usePolymarket.ts` | 280+ | Data hooks |

### Component Hierarchy
```
Dashboard
├── WalletManager (sidebar)
│   └── AddWalletModal
├── AggregateFeed (center)
│   └── TradeCard (repeated)
└── ContextPanel (right)
```
