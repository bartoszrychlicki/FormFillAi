# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FormFillAI is a Turborepo monorepo that enables conversational form filling powered by AI. The system uses a schema-driven approach where JSON schema definitions describe multi-field conversations, and an AI agent guides users through collecting data field-by-field.

## Architecture

### Core Components

1. **ConversationEngine** (`packages/shared/src/conversation/conversationEngine.ts`)
   - Stateful engine managing conversation sessions
   - Tracks current field, collected data, and session status
   - Supports pluggable `SessionStore` implementations (default: `InMemorySessionStore`)
   - Schemas are registered in-memory and cached per session
   - Progressive data collection: moves from field to field sequentially

2. **Schema System** (`packages/shared/src/schema/conversationSchema.ts`)
   - Defines conversation structure via JSON schemas
   - Schema properties: `id`, `welcomeMessage`, `completionMessage`, `webhookUrl`, `fields[]`, `saveOnTheGo`
   - Field types: `text`, `number`, `email`, `select`
   - Field validation: `required`, `failureMessage`, `minWords`
   - Validated with Zod at runtime via `parseConversationSchema()`

3. **API Route** (`apps/web/src/app/api/chat/route.ts`)
   - POST endpoint handling two flows:
     - **New conversation**: Requires `schema` payload → calls `engine.startConversation()`
     - **Continue conversation**: Requires `sessionId` + `reply` → calls `engine.submitReply()`
   - Uses Vercel AI SDK (`generateText` from `ai` package) with OpenAI to generate contextual follow-up prompts
   - Posts completed data to schema's `webhookUrl` on conversation completion
   - Engine singleton managed by `apps/web/src/lib/conversation/engine.ts`

4. **Chat Widget Package** (`packages/chat-widget/`)
   - Reusable React widget for embedding conversations
   - Exports both client components (`FormFillChat`, `FormFillProvider`) and server utilities (`createFormFillHandler`, `createNextRoute`)
   - Built with `tsup` for dual CJS/ESM output
   - Provides API client abstraction and conversation state management hooks

### Monorepo Structure

```
apps/
  web/                    # Next.js 15 demo app (App Router)
    src/app/api/chat/     # Conversation API endpoint
    src/components/       # Chat UI components (ChatPanel, ChatPlayground)
    src/lib/              # Engine singleton, schema catalog
    public/schemas/       # JSON schema definitions loaded at runtime
packages/
  shared/               # Core conversation engine + schema validation (TypeScript library)
  chat-widget/          # Reusable React widget + server utilities
  eslint-config/        # Shared flat ESLint config
  tsconfig/             # Shared TypeScript configurations
specs/init/             # Architectural and product documentation
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Run Next.js web app in development mode
pnpm dev --filter web

# Run all workspaces in parallel
pnpm dev

# Build all packages and apps
pnpm build

# Lint all workspaces
pnpm lint

# Run all test suites
pnpm test

# Type-check all workspaces
pnpm typecheck
```

### Web App Specific

```bash
# From repository root
cd apps/web

# Run tests for web app only
pnpm test

# Run single test file
pnpm test -- ChatPanel.test.tsx

# Type-check web app
pnpm typecheck
```

### Shared Package

```bash
cd packages/shared

# Run shared package tests
pnpm test

# Type-check
pnpm typecheck
```

### Chat Widget Package

```bash
cd packages/chat-widget

# Build widget (tsup)
pnpm build

# Watch mode for development
pnpm dev
```

## Environment Setup

Required for web app (`apps/web/.env.local`):

```bash
OPENAI_API_KEY=sk-...          # Required for AI-powered responses
OPENAI_MODEL=gpt-4o-mini       # Optional: defaults to gpt-4o-mini
```

Copy from example:
```bash
cp apps/web/.env.example apps/web/.env.local
```

## Key Development Patterns

### Adding New Conversation Schemas

1. Create JSON file in `apps/web/public/schemas/` matching the conversation schema contract
2. Schema must include: `id`, `welcomeMessage`, `completionMessage`, `webhookUrl`, `fields[]`
3. The schema selector in the playground auto-discovers files from that directory
4. No code changes needed—schemas are loaded dynamically at runtime

### Testing

- Tests use Jest with `@testing-library/react` for component tests
- API routes are tested by mocking `generateText` from Vercel AI SDK
- Webhook calls are mocked in tests—no real HTTP requests
- Engine tests mock `SessionStore` and time/ID generators for determinism
- Run tests with `--runInBand` to avoid concurrency issues

### Type Safety

- Strict TypeScript configuration across all packages
- Zod schemas validate runtime JSON payloads (conversation schemas, API requests)
- Never use `any` type—use `unknown` and validate at runtime when dealing with external data
- Shared types exported from `packages/shared/src/index.ts`

### Session Management

- Engine maintains in-memory session cache (`sessionCache` Map)
- Optional persistence via `SessionStore` interface (default: `InMemorySessionStore`)
- Sessions are cloned on read/write to prevent mutation bugs
- Test utility `resetConversationEngine()` clears singleton for test isolation

### AI Integration

- Vercel AI SDK handles OpenAI communication via `generateText()`
- AI prompts constructed from field metadata + conversation context
- Field-specific `aiPrompt` property allows customizing AI instructions per field
- Response parsing extracts follow-up question from AI output
- Graceful degradation: API returns 503 if `OPENAI_API_KEY` not configured

### Chat Widget Integration

The chat-widget package provides:
- **Client-side**: `<FormFillChat />` component with customizable appearance/behavior via props
- **Server-side**: `createFormFillHandler()` to build compatible API endpoints
- **Next.js adapter**: `createNextRoute()` wraps handler for Next.js App Router compatibility
- Import styles separately: `import '@formfillai/chat-widget/styles.css'`

## Important Notes

- Next.js 15 uses React 19—ensure compatibility when adding dependencies
- Turbo caches build outputs—use `turbo run build --force` to ignore cache
- The web app runs with `--turbopack` flag (experimental Next.js bundler)
- Tests run in band (`--runInBand`) to prevent race conditions with shared engine state
- Webhook URLs in schemas must be valid URLs (validated by Zod)
- Field IDs must be unique within a schema
- Engine expects replies for fields in sequential order—out-of-order replies throw errors
