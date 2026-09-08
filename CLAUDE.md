# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Read SPEC.md first

**[SPEC.md](SPEC.md) is the source of truth for this project.** Read it in full before writing code, and re-read the relevant section before starting each task in its Section 14 build order. Do not duplicate its content here.

Two things from it that are easy to get wrong and expensive to undo:

- **Hard rules are in SPEC.md Section 2.** In particular: no AI attribution anywhere in git, ever. No `Co-Authored-By` trailers, no "Generated with" lines, no AI names in commit messages, PR bodies, code comments or contributor files. This overrides any default commit-message behaviour.
- **`TODO(vedant)` marks an undecided value.** Build around it using the stated placeholder. Never invent a real value in its place, and never block waiting for one.

Current state of the build is tracked in SPEC.md Section 16.

## Commands

```bash
npm run dev        # next dev (Turbopack, http://localhost:3000)
npm run build      # production build
npm start          # serve the production build
npm run lint       # bare `eslint` — no path args, config drives the scope
npm run typecheck  # tsc --noEmit

npm run sandbox    # ampx sandbox --profile scd (blocked, see below)
npm run seed       # AWS_PROFILE=scd SCD_TABLE_NAME=<table> npm run seed
```

No test runner is set up. `scripts/seed.ts` self-checks its key and token logic before it touches AWS.

## Backend

Amplify Gen 2 in `amplify/`, one DynamoDB table with one GSI, talked to with AWS SDK v3 from server code only. No Amplify Data, no AppSync.

- **Do not delete `amplify/package.json`.** It is one line, `{"type": "module"}`, and it is load-bearing. `ampx` executes `amplify/backend.ts` through `tsImport` from tsx. Without that file Node walks up to the root `package.json`, finds no `"type"`, and takes the typeless CJS-then-reparse-as-ESM path, on which tsx's TS extension probing does not apply. Extensionless imports like `./auth/resource` then fail with `ERR_MODULE_NOT_FOUND` at synth time even though `tsc --noEmit` passes. `npm create amplify@latest` generates this file; it was missing here.
- The root `package.json` must **not** get `"type": "module"`. It would not fix the above, and it would break the Next config files.
- Deploying requires a one-time `cdk bootstrap` of `ap-south-1` by an admin principal. It has not happened. The local `scd` profile is IAM user `claude-code-scd`, which is not an admin, so `npm run sandbox` will fail until Vedant bootstraps.
- After a sandbox deploy, copy `custom.scdTableName` out of `amplify_outputs.json` into `SCD_TABLE_NAME`.

## Conventions that differ from older Next.js

- **Next 16 App Router.** The scaffold is Next.js 16.3.4 with React 19.2.8, not the Next 15 named in SPEC.md Section 3. Read the relevant guide under `node_modules/next/dist/docs/` (`01-app/`, `03-architecture/`) before writing routing/data-fetching code — see AGENTS.md.
- **Generated route types.** `layout.tsx` types props as `LayoutProps<"/">`, a global emitted into `.next/types` per route. Use `LayoutProps`/`PageProps` with the route literal instead of hand-written prop interfaces.
- **Tailwind v4, CSS-first.** No `tailwind.config.*`. Design tokens live in `src/app/globals.css` (SPEC.md Section 10); PostCSS loads `@tailwindcss/postcss` only.
- **Imports.** `@/*` maps to `src/*`. `scripts/` and `amplify/` sit outside that alias and use relative paths.
