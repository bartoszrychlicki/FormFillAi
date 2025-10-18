# FormFillAI Workspace

This repository hosts the FormFillAI monorepo scaffolded with Turborepo. It pairs a Next.js web preview (`apps/web`) with shared TypeScript utilities under `packages/shared`.

## Getting Started

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev --filter web
```

Visit http://localhost:3000 to interact with the conversation demo. Schemas are discovered from JSON files in `apps/web/public/schemas` and fetched on demand by the chat UI, so you can add new scenarios without touching the code.

## Key Commands

- `pnpm dev --filter web` – run the Next.js application with hot reload.
- `pnpm lint` – lint all packages using the shared ESLint config.
- `pnpm test` – run Jest test suites for shared utilities and the web app.
- `pnpm build` – execute the production build pipelines (Next.js + shared packages).

## Environment

The chat endpoint relies on OpenAI-compatible credentials via the Vercel AI SDK. Set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) in `apps/web/.env.local` before hitting live models. Tests mock the AI SDK and webhook calls, so no secrets are required locally.

## Repository Layout

```
apps/
  web/                 # Next.js app + API routes
packages/
  shared/              # Conversation types, schema validator, engine
  eslint-config/       # Flat ESLint config consumed by packages
  tsconfig/            # Shared TypeScript project references
specs/                 # Architectural and product docs
```

## Conversation Workflow

1. The `ChatPanel` component receives a `schemaUrl` (e.g. `/schemas/loan-intake.json`).
2. It fetches the JSON definition, validates it with `parseConversationSchema`, and sends the original payload to `/api/chat` to start a session.
3. The API route boots the conversation engine with the supplied schema, requests follow-up copy from the Vercel AI SDK, and posts completed data to the schema's `webhookUrl`.
4. Subsequent replies only include the `sessionId` and the user's answer—the engine already caches the schema.

## Adding Your Own Schemas

1. Drop a JSON file that matches the conversation schema contract into `apps/web/public/schemas`.
2. Reload the playground: the selector will list the new id automatically.
3. If you are embedding the chat elsewhere, render `<ChatPanel schemaUrl="/schemas/<your-schema>.json" />` (or host the JSON remotely and pass the absolute URL).
4. Optional: extend the catalog card by adjusting `loadSchemaCatalog` if you want to surface extra metadata (e.g. descriptions) alongside each schema.
