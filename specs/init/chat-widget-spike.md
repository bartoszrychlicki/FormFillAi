# Chat Widget Package Spike

## Context

Goal: extract the existing chat experience into a reusable npm package (`@formfillai/chat-widget`) that ships a complete React UI with customization hooks, headless runtime adapters, and integration helpers. The package must remain framework-agnostic on the backend and easy to adopt in client projects.

## Target Outcomes

1. Provide `<FormFillChat />` component with sensible default styling (neutral palette inspired by shadcn) and escape hatches for theming/slot overrides.
2. Deliver headless primitives (`FormFillProvider`, `useConversation`) so advanced consumers can build bespoke UIs.
3. Offer server utilities to simplify wiring conversation schemas, session storage, LLM responders, and webhook delivery across environments (Next.js API route example + generic handler).
4. Document setup flow, configuration surfaces, and integration checklist; ship an example app (Vite + React) to verify the package end-to-end.

## Design Decisions

- **UI Surface:** Default export of a fully featured chat panel that manages fetching, session state, field prompts, AI responses, and webhook delivery status.
- **Styling Strategy:** Package ships a prebuilt stylesheet (`@formfillai/chat-widget/styles.css`) composed of CSS variables and BEM-style classes. Consumers can override via CSS variables or replace sub-components through `components` prop.
- **Schema Loading Modes:** Support `schemaUrl` (remote, cached) and `schemaLoader` (async function returning schema). Package will not expose raw fetch logic, letting consumers provide fetch implementation if needed.
- **Networking:** UI depends on a configurable API client (default `fetch` wrapper) targeting `/api/formfill`. Consumers provide `apiBaseUrl` or override `transport` to match their backend.
- **Backend Integration:** Provide `createFormFillHandler(options)` to encapsulate engine/session logic. Wrapper accepts:
  - `schemaProvider` (lookup by schema id / URL),
  - `sessionStore` (default in-memory; optional Redis adapter),
  - `webhook` config (URL + HTTP client),
  - `responder` (LLM callback, default OpenAI via Vercel AI SDK).
- **LLM Keys:** Server-only configuration; handler receives `providers.openAI.apiKey` or a custom `responder`. No secrets leak to the browser.
- **Safety & Quality:** Type-safe exports, runtime validation for config, exhaustive error mapping, and alignment with existing `@formfillai/shared` schema utilities.

## Workstream Breakdown

1. **Package Skeleton**
   - Create `packages/chat-widget` with TS + tsup/rollup config, story playground, and entry points (`index.ts`, `index.css`).
   - Reuse shared lint/tsconfig setups.

2. **Shared Abstractions**
   - Move reusable chat-specific hooks/utilities from `apps/web` to package (without back references).
   - Ensure `@formfillai/shared` exports cover necessary types (schema, engine).

3. **Frontend Surface**
   - Adapt current `ChatPanel` into package form, parameterize schema/API props, and expose customization props.
   - Create theming API (CSS variables + optional `theme` prop).

4. **Server Utilities**
   - Extract conversation engine usage into `createFormFillHandler`.
   - Provide Next.js route example and generic Express-compatible handler.
   - Implement OpenAI responder with dependency-injection to accept API key.

5. **Tooling & Docs**
   - Add README with quick start, configuration matrix, theming instructions, and troubleshooting.
   - Update root docs referencing new package, including release checklist.
   - Log open questions/resolutions back to `brief.md`.

6. **Example Application**
   - Build `/examples/chat-widget-vite` demonstrating custom theming and self-hosted handler.
   - Use project for manual QA before publishing.

## Public API Sketch

```ts
export interface FormFillChatProps {
  schemaUrl?: string;
  schemaLoader?: () => Promise<ConversationSchema>;
  title?: string;
  api?: {
    baseUrl?: string;
    transport?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    startEndpoint?: string; // default "/api/formfill"
  };
  appearance?: {
    className?: string;
    theme?: Partial<FormFillThemeTokens>;
    components?: Partial<FormFillChatSlots>;
  };
  behavior?: {
    onEvent?: (event: FormFillChatEvent) => void;
    retryPolicy?: RetryPolicy;
  };
}

export declare function FormFillChat(props: FormFillChatProps): JSX.Element;

export declare function FormFillProvider(props: FormFillProviderProps): JSX.Element;
export declare function useConversation(): ConversationController;
```

```ts
export interface CreateFormFillHandlerOptions {
  engine?: ConversationEngine;
  schemaProvider: {
    load(schemaId: string): Promise<ConversationSchema | null>;
  } | {
    start(schema: ConversationSchema): Promise<LoadedSchema>;
  };
  sessionStore?: SessionStore;
  webhook: {
    url: string;
    headers?: Record<string, string>;
    client?: (payload: WebhookPayload) => Promise<void>;
  };
  responder: ConversationResponder; // default uses OpenAI
}

export interface OpenAIResponderOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
}

export declare function createOpenAIResponder(options: OpenAIResponderOptions): ConversationResponder;
export declare function createFormFillHandler(options: CreateFormFillHandlerOptions): FormFillRequestHandler;
export declare function createNextRoute(handler: FormFillRequestHandler): NextRouteHandler;
```

### Package Layout

```
packages/chat-widget/
  src/
    client/
      components/
      hooks/
      context/
      styles/
    server/
      handler.ts
      responders/
    index.ts
    index.css
  tsconfig.json
  package.json
  README.md
```

## Configuration & Security Considerations

- UI validates that either `schemaUrl` or `schemaLoader` is provided (never both missing). It never persists schema or user data after completion; only communicates through provided transport.
- All network calls surface structured errors; consumers can log via `onEvent`.
- Session tokens stored in memory/local storage? Proposal: keep in-memory per component instance; optional `storageStrategy` to persist if needed.
- Provide guardrails for SSR: components internally check `typeof window` and no direct references to `fetch` outside effect hooks.

## Risks & Mitigations

- **Backend Coupling:** Avoid Next.js-specific APIs by isolating request/response adapters; document Node runtimes supported.
- **Styling Conflicts:** Namespaced CSS classes, variables, and minimal global leakage. Provide tree-shakable CSS import.
- **Secret Leakage:** Enforce server-only config by design; UI only handles session tokens and redirect responses.
- **Bundle Size:** Use tree-shaking-friendly build (tsup) and mark peer dependencies.

## Next Steps

1. Finalize configuration interfaces and public API signatures.
2. Sketch file/module layout for the new package and supporting utilities.
3. Define acceptance criteria for the example app and testing strategy (unit + integration).

## Example Integration App Plan

- **Location:** `examples/chat-widget-vite`
- **Stack:** Vite + React + TypeScript, Tailwind optional (showcase neutral styling + overrides).
- **Features:**
  - Imports `@formfillai/chat-widget` from local workspace.
  - Demonstrates both `schemaUrl` (served from `public/schema.json`) and `schemaLoader`.
  - Customizes theme tokens (colors, radii) and overrides message bubble component.
  - Implements server using Express (`vite-express`) hooking into `createFormFillHandler`.
  - Stores sessions in memory; showcases how to swap for Redis.
  - Logs webhook payload to console (mock) and displays integration checklist in README.
- **Scripts:** `pnpm dev --filter chat-widget-example`, `pnpm build`, `pnpm preview`.
- **Validation:** End-to-end manual test flow + Playwright smoke spec verifying conversation start and completion.

### Example App Acceptance Criteria

1. User can start conversation, submit responses, and see completion state.
2. Validation errors from schema surface in UI with explanatory message.
3. Custom theme tokens visibly alter UI (colors/spacing).
4. Example demonstrates environment variable injection for OpenAI key (fallback to mock responder for offline dev).
5. README documents setup steps, environment variables, and troubleshooting.

## Status Update (2025-10-07)

- Created new package workspace `packages/chat-widget` with build/test tooling (tsup, ts-jest, ESLint).
- Added client-side stubs for `<FormFillChat />`, provider, hooks, and typed configuration surface.
- Added server handler scaffolding with option validation and Next.js adapter helper; OpenAI responder stub guards against missing API key.
