# Portal

A luxury stays platform with three fully separated workspaces: **Buyer**, **Traveler** and **Admin**.

This repository is a hackathon prototype. Screens are intentionally placeholders; the architecture, routing, design system and mock authentication are in place.

## Stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Framework  | Next.js 16 (App Router)             |
| UI         | React 19                            |
| Language   | TypeScript (strict)                 |
| Styling    | Tailwind CSS v4                     |
| Icons      | Lucide React                        |
| Auth       | Auth-agnostic mock (no provider yet)|

## Getting started

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run lint     # ESLint
npm run build    # production build
npm start        # serve the production build
```

## Workspace routes

Every workspace owns a URL prefix, an auth module and a cookie. Nothing is shared.

| Workspace | Sign in            | Register               | Dashboard              |
| --------- | ------------------ | ---------------------- | ---------------------- |
| Buyer     | `/buyer/login`     | `/buyer/register`      | `/buyer/dashboard`     |
| Traveler  | `/traveler/login`  | `/traveler/register`   | `/traveler/dashboard`  |
| Admin     | `/admin/login`     | — (invite only)        | `/admin/dashboard`     |

### Mock credentials

The mock account store seeds one demo account per workspace:

| Workspace | Email                   | Password      |
| --------- | ----------------------- | ------------- |
| Buyer     | `buyer@portal.demo`     | `portal-demo` |
| Traveler  | `traveler@portal.demo`  | `portal-demo` |
| Admin     | `admin@portal.demo`     | `portal-demo` |

> The mock store lives in module memory and resets on server restart. Sessions are base64url-encoded cookies — **not** signed or encrypted. Do not use any of this in production.

## Separation model

- **Routes** — literal `/buyer`, `/traveler`, `/admin` segments, each with its own `layout.tsx`.
- **Cookies** — `portal_buyer_session`, `portal_traveler_session`, `portal_admin_session`, each scoped to its own path (`/buyer`, `/traveler`, `/admin`).
- **Auth modules** — `src/lib/auth/buyer.ts`, `traveler.ts`, `admin.ts` expose workspace-specific `get*Session`, `signIn*`, `signUp*` (Buyer/Traveler only), `signOut*` and `require*Session` functions. There is deliberately no shared “current user” helper.
- **Guard** — `src/lib/auth/session.ts` rejects a session whose `user.workspace` does not match the requested workspace, so a Buyer cookie can never satisfy a Traveler or Admin request.

Swapping the mock for Supabase, Clerk or Auth.js only requires implementing the `AuthAdapter` contract in `src/lib/auth/types.ts`.

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx              root layout, fonts, metadata
│  ├─ page.tsx                landing / workspace chooser
│  ├─ globals.css             design tokens + base typography
│  ├─ not-found.tsx
│  ├─ buyer/                  /buyer/*
│  ├─ traveler/               /traveler/*
│  └─ admin/                  /admin/*
├─ components/
│  ├─ shared/                 brand mark, workspace badge, placeholder shell
│  └─ ui/                     design-system primitives (to come)
├─ hooks/                     client hooks (to come)
├─ lib/
│  ├─ auth/                   types, mock store, session transport, per-workspace APIs
│  ├─ utils.ts                cn() helper
│  └─ workspaces.ts           single source of truth for paths and cookies
└─ types/                     shared domain types (to come)
```

## Design direction

Luxury black, champagne gold and cream. Tokens are defined once in `src/app/globals.css`:

- `--obsidian` / `--obsidian-soft` — near-black surfaces
- `--gold` / `--gold-strong` / `--gold-soft` — champagne accents
- `--background`, `--surface`, `--surface-muted` — cream canvas
- Typography: Geist Sans for UI, a serif stack for display headings, uppercase gold eyebrows for section labels

Use the semantic utilities (`bg-surface`, `text-gold`, `border-border`, `font-serif`, `eyebrow`) instead of raw hex values.

## Not built yet

- Sign-in and registration forms (mock auth functions are ready to call)
- Buyer, Traveler and Admin dashboards
- Route protection enforcement (guards exist but redirects are not wired into requests)
- Per-workspace visual differentiation beyond the header label
