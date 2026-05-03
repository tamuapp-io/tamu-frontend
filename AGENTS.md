<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Tamu — Frontend (Next.js)

This workspace is the **Next.js 15 frontend** for **Tamu**, a multi-tenant restaurant booking engine SaaS.

## Source of Truth

The full product specification lives at **`docs/prd.md`** — always consult it before any non-trivial work. It covers:

- Guest booking flow (date → slot → details → deposit → confirmation)
- Public widget & iframe embed
- Staff live service view (timeline + floor plan, ≤2-tap actions)
- Owner dashboard, reports, settings
- Reservation state machine and realtime updates (Laravel Reverb WebSocket)
- Full REST API surface under `/api/v1/...` (consumed from here)

## Stack (frontend)

- Next.js 15 (App Router), TypeScript, Tailwind CSS
- shadcn/ui
- TanStack Query, Zustand
- React Konva (floor plan editor)
- Recharts (analytics)

## Backend companion

The Laravel API lives in the sibling workspace `../tamu-backend`. Auth is Sanctum bearer tokens; tenant context is resolved from the token.

## Current status

Fresh Next.js scaffold. No feature code written yet. Implementation follows the roadmap in `docs/prd.md` §17, starting with Phase 1 (MVP).
