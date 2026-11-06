# Week 4 — TestDZ Design System

## Scope

This branch introduces reusable UI primitives without changing authentication, Supabase policies, database migrations, or production business flows. The dashboard integration remains intentionally deferred until Week 2 Auth verification is complete.

## Added modules

- `src/styles/tokens.css`: semantic color, spacing, radius, shadow, motion and stacking tokens; dark by default with a light theme override.
- `src/styles/design-system.css`: shared component and application-shell styles.
- `src/lib/cn.ts`: tiny class-name join helper; no additional runtime dependency.
- `src/components/ui`: Button, Input, Card family, Badge, Progress, Avatar, Modal, Toast provider/hook and Tooltip.
- `src/components/layout`: Sidebar, TopBar and AppShell.
- `src/components/layout/DesignSystemDemo.tsx`: isolated component showcase with no backend calls or seeded production data.

## Usage

```tsx
import { Button, Input, Card, Badge, Progress, Modal, ToastProvider, useToast } from "./components/ui";
import { AppShell } from "./components/layout";
```

Wrap a page that needs toast notifications in `ToastProvider`, then call `useToast().show({ title, kind: "success" })` from descendants.

The showcase is available at `/design-system` only in Vite development mode. It redirects to the home page in production builds.

## Guardrails

- No Supabase/Auth code was changed.
- No database migrations or RLS policies were changed.
- No demo records are inserted into production tables.
- Sidebar sign-out is callback-driven; it does not pretend to sign a user out when no handler is supplied.
- Roles are display/navigation props only, never authorization. Backend permissions remain authoritative.
- Modal supports Escape, backdrop dismissal, focus restoration and basic Tab trapping.
- Toasts are transient and capped at five visible items.
- Theme preference is stored under the app-specific `testdz-theme` localStorage key.

## Verification still required

Run from `frontend/`:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Then visit `/design-system` and verify at mobile, tablet and desktop widths, in both themes, and with keyboard-only navigation. This branch has not yet been built or browser-tested in the current environment; do not mark Week 4 complete until those checks pass and Auth is closed.
