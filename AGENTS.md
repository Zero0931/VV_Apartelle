<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VV Apartelle Panabo: booking/POS demo

## What this is
- A clickable **sales demo** for a prospective client, VV Apartelle Panabo.
- The client is a 3-room transient (short-stay) facility in Panabo City, PH. Guests pay **per night** and no deposit is needed, but they can book several nights ahead.
- Goal: win the client, then build production on Supabase.
- Polish and a believable flow matter more than hardening right now.
- Repo: `github.com/Zero0931/VV_Apartelle`. Vercel (Pro team) auto-deploys from `main`, and other branches get preview URLs. Pushing to `main` = going live.
- See `README.md` for demo accounts, the full flow and the "Going live" plan.

## User preferences
- **UI copy must be short.** The user explicitly said "stop with the over explanation". Use headlines of a few words and one-line helper text, and don't add paragraphs that explain the UI.
- Keep replies to the user concise too.

## Stack
- **Next.js 16.4.6** (App Router, Turbopack), React 19.3 and TypeScript.
- `next.config.ts` has `cacheComponents` and `partialPrefetching` turned on.
- Pages read `useSearchParams` and dynamic params, so the root layout wraps children in `<Suspense>`. Keep that.
- Middleware is called `proxy.ts` in Next 16. It's unused so far.
- **Tailwind v4** through `@tailwindcss/turbopack`. There's no postcss config. Theme tokens live in the `@theme` block in `src/app/globals.css`:
  - colors: `ink`, `paper`, `surface`, `line`, `muted`, `subtle`, `accent` (#a86b1c), `ok`/`warn`/`bad`/`info` (+ `-soft`)
  - `font-display` (Fraunces). Geist is the body font.
- Libraries: lucide-react, recharts, qrcode, zod, date-fns, nanoid.
- Currency is ₱ through `formatPeso`. Design mobile-first, because guests book on phones.

## Commands
- `npm run dev`. Locally we've used `npx next dev -p 3123`.
- Before finishing, run `npx tsc --noEmit`, `npm run lint` and `npm run build`. All three currently pass.

## Architecture
- **Data seam:** pages only talk to the async `DataStore` interface (`src/lib/data/store.ts`).
  - The demo implementation is `LocalStore` (`local-store.ts`). It keeps all data in localStorage under the key `vv-apartelle-demo-db`.
  - For production, write `supabase-store.ts` against the same interface and swap it in `getStore()` in `provider.tsx`. No page should need changes. Keep this seam intact.
- **Hooks** (`provider.tsx`):
  - `useStore()`
  - `useAuth()`: user, isOwner, isStaff, signIn/signUp/signOut
  - `useQuery(fn, deps)`: re-runs whenever the store's version changes, which keeps the UI live.
- **Cross-tab sync:** the `storage` event. A guest tab and an admin tab in the same browser update each other live. Each device has its own data.
- **Login:** per-tab sessionStorage (`vv-apartelle-session`), with a fallback to localStorage (`vv-apartelle-last-session`) and a logout flag.
- **Sweep, every 5s:** expires holds, and marks checked-in bookings completed after check-out time on the day after the last night.
- **Errors:** `StoreError` with codes `conflict`, `not_found`, `forbidden`, `invalid`, `auth`. Role checks live inside the store.

### Booking rules
- States: `hold → pending_verification → confirmed → checked_in → completed`. Exits: `expired`, `rejected`, `cancelled`.
- Statuses that block availability: non-expired `hold`, `pending_verification`, `confirmed`, `checked_in`.
- One hold per guest. A new hold expires the old one.
- Hold length comes from settings (15 min by default).
- `createHold` re-checks for conflicts before it writes.
- The rate is frozen per night when the hold is created.
- Payment: the guest picks GCash, Maya or bank, then submits a reference number and a screenshot. Front desk or the owner confirms or rejects, with a reason.
- Confirming sends a receipt "email" (booking code + QR) to the simulated inbox. Email kinds: welcome, received, confirmed, rejected, cancelled.
- Pricing: each room has a base rate, and per-date overrides can replace it (`src/lib/pricing.ts`).
- Removing a room hard-deletes it if it has no history. Otherwise the room is archived so reports stay correct.

### Roles
- `customer`: books, pays, sees their own bookings and inbox.
- `admin` (front desk): bookings, verification, check-in/out only.
- `owner`: everything, including the dashboard, rooms, rates, payment QRs, staff, customers and settings.
- An admin who visits `/admin` is redirected to `/admin/bookings`.

### Seed data (`src/lib/data/seed.ts`, `DB_VERSION = 1`)
- Demo accounts: `owner@vvapartelle.demo`/`owner123`, `frontdesk@vvapartelle.demo`/`admin123`, `juan@guest.demo`/`guest123`, plus 24 customers.
- Rooms: Queen ₱1,200, Twin ₱1,300, Family ₱1,800.
- About 2 years of history from a deterministic PRNG (mulberry32), with an uptick in the last 120 days.
- Holiday overrides of +₱300.
- 2 bookings waiting for verification.
- If you change the seed shape, bump `DB_VERSION`. Settings → "Reset demo data" reseeds.

### Analytics (`src/lib/analytics.ts`)
- Revenue = PAID statuses (confirmed, checked_in, completed), counted by **night of stay**.
- Periods are period-to-date (the week starts Monday) and are compared with the same point in the previous period.
- Occupancy = room-nights sold ÷ room-nights available.
- Charts:
  - one accent color
  - `isAnimationActive={false}` (bars didn't render without it)
  - meter lists instead of multi-color category charts

## Routes
- Guest, under `src/app/(site)`: `/`, `/book` (rooms × nights grid plus a quick-select card with `DateRangePicker` and room chips; the selection is saved in sessionStorage as `vv-pending-selection`), `/checkout/[id]`, `/bookings`, `/bookings/[id]`, `/inbox`, `/login`, `/register`.
- Admin, under `src/app/admin`: dashboard, bookings (+`[id]`), check-in, rooms, rates, payments, staff, customers, settings.
- Components live in `src/components` and UI primitives in `src/components/ui`.

## Gotchas
- Don't export anything except the page component and Next's allowed exports from `page.tsx`/`layout.tsx`. Shared helpers go in `src/lib` (for example `routes.ts` and `format.ts`).
- Never call `router.replace` during render. Do it in an effect.
- Keep source files on LF line endings. CRLF once broke exact-match edits.
- Don't use `<input type="date">` for guest dates. The iOS picker ignores `min`/`max`, and the input overflows narrow grids. Use `src/components/date-range-picker.tsx`, which disables past days and days beyond the booking window.
- Mobile layout must fit 320–430px wide (Android and iPhone) with no horizontal page scroll. The availability grid compacts below `sm` (64px room column, 52px day columns, no tagline or "Open" label), which shows 5 days at 360–393px.
- Images are compressed in the browser into JPEG data URLs (`src/lib/images.ts`), because localStorage has limited space. In production they move to Supabase Storage.
- `remote-control.cmd` is a local-only launcher for Claude Code Remote Control. It's excluded from git.

## Next phase (not started)
1. Supabase: `supabase/schema.sql` is a draft with RLS, `create_hold()`, `expire_holds()` (pg_cron) and a partial unique index on `booking_nights(room_id, night) where active` that guards against double booking.
2. Supabase Auth plus route protection in `proxy.ts`.
3. Real email through Resend or Postmark when a booking is confirmed.
4. Storage for QR codes, photos and screenshots.

Pricing pitched to the client: for about ₱22.5k/mo gross (3 rooms × ₱500 × 15 nights), three options were drafted:
- one-time ₱25–35k + ₱1–1.5k/mo
- **subscription ₱3–5k setup + ₱1.5–2k/mo (recommended)**
- 5–8% commission per online booking

Plan: keep the code and resell the system to other transients.
