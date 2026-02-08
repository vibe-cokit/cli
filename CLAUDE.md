# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A CLI tool built with Bun and TypeScript. Entry point: `index.ts`.

## Development

```bash
bun install          # Install dependencies
bun run index.ts     # Run the CLI
bun --hot index.ts   # Run with hot reload (for server mode)
bun test             # Run tests
bun test <file>      # Run a single test file
```

## Bun Runtime

Default to Bun instead of Node.js for all operations:

- `bun <file>` not `node`/`ts-node`
- `bun test` not `jest`/`vitest`
- `bun install` not `npm`/`yarn`/`pnpm install`
- `bunx <pkg>` not `npx`
- Bun auto-loads `.env` — don't use dotenv

### Preferred Bun APIs

- `Bun.serve()` for HTTP/WebSocket servers (not express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.redis` for Redis (not ioredis)
- `Bun.sql` for Postgres (not pg/postgres.js)
- `Bun.file()` for file I/O (not node:fs readFile/writeFile)
- `Bun.$\`cmd\`` for shell commands (not execa)
- Built-in `WebSocket` (not ws)

### Frontend with Bun.serve()

Use HTML imports — Bun bundles `.tsx`/`.jsx`/`.css` automatically. Don't use vite.

```ts
import index from "./index.html"
Bun.serve({ routes: { "/": index } })
```

## Testing

- Test files go in `tests/` directory, NOT alongside source files
- Naming: `tests/<module>.test.ts` mirroring the source structure
- Run all: `bun test` | Run one: `bun test tests/<file>.test.ts`

## TypeScript Config

- Strict mode enabled with `noUncheckedIndexedAccess` and `noImplicitOverride`
- JSX: `react-jsx` transform
- Module: ESNext with bundler resolution
- No emit (`noEmit: true`)
