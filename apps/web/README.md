# FormFillAI Web App

This Next.js application renders the FormFillAI conversation sandbox and exposes the `/api/chat` endpoint that interacts with the conversation engine.

## Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev --filter web
```

The app boots on http://localhost:3000. The landing page lists every JSON schema discovered in `public/schemas` and embeds the `ChatPanel` client component so you can try each flow.

## Testing & Quality

- `pnpm test --filter web` – run Jest tests (API route + React component coverage with mocked fetch).
- `pnpm lint --filter web` – lint the application.

## Environment

Set `OPENAI_API_KEY` in `.env.local` to allow the Vercel AI SDK to call live models. `OPENAI_MODEL` can override the default (`gpt-4o-mini`) when needed. Tests mock the SDK, so credentials are optional for CI.

## Structure

- `src/app/api/chat/route.ts` – serverless entrypoint orchestrating the conversation engine + webhook delivery.
- `src/lib/conversation/schema-catalog.ts` – server helper that reads `public/schemas` and validates each definition.
- `src/lib/conversation/engine.ts` – wraps the shared conversation engine instance.
- `src/components/chat/ChatPanel.tsx` – Conversational UI that fetches a schema from a URL, handles optimistic updates, and exposes quick replies.

Refer to `../../../AGENTS.md` for contributor guidelines spanning the entire repository.
