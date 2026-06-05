# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Non-standard Next.js version

This project uses a Next.js version with breaking API changes. Before writing any Next.js-specific code (routing, middleware, data fetching, config), read the relevant guide in `node_modules/next/dist/docs/`. Do not rely on training-data knowledge of Next.js APIs — heed deprecation notices in those docs.

## Commands

```bash
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run start     # serve production build
npm run lint      # ESLint via next lint
```

No test runner is configured yet.

## Stack

- **Framework**: Next.js with App Router (`app/` directory)
- **Language**: TypeScript (strict mode, `@/*` path alias maps to project root)
- **Styling**: Tailwind CSS **v4** — uses `@import "tailwindcss"` and `@theme inline {}` blocks, not the v3 `@tailwind` directives
- **Backend**: Supabase (URL + anon key in `.env.local` as `NEXT_PUBLIC_SUPABASE_*`)

## Architecture intent

This app is being built as a congress/event management system with the following user flow:

1. Attendee registration (name, email, institution)
2. Agenda view — time blocks with simultaneous session options
3. Attendee selects one session per time block
4. Confirmation → saved in Supabase with a unique booking ID
5. "My Schedule" view listing all booked blocks
6. Clicking a block shows time, location, and a QR code for the booking
7. Staff QR scanner to mark attendance at the event

All persistent state lives in Supabase. Server-side Supabase calls should use the service-role key (never exposed to the client); client-side calls use the anon key with RLS enforced on every table.

## Tailwind v4 notes

- Theme tokens are defined in `app/globals.css` under `@theme inline { ... }` — not in a `tailwind.config.*` file
- PostCSS plugin is `@tailwindcss/postcss` (not `tailwindcss` directly)
- CSS custom properties (`--background`, `--foreground`) drive dark mode via `@media (prefers-color-scheme: dark)`
