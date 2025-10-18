# Repository Guidelines

## Project Structure & Module Organization
FormFillAI is a Turborepo monorepo. The Next.js runtime (UI + API routes) lives in `apps/web`. Shared TypeScript schemas, hooks, and fixtures sit in `packages/shared`; workspace configs stay in `packages/tsconfig` and `packages/eslint-config`. Planning references live under `specs/init/` (`architecture.md`, `brief.md`, `prd.md`). Store static assets in `apps/web/public` and Playwright suites in `apps/web/e2e`.

## Build, Test, and Development Commands
- `pnpm install` — install workspace dependencies.
- `pnpm dev --filter web` — launch the Next.js dev server (HMR).
- `pnpm lint` — run ESLint and TypeScript checks.
- `pnpm test --filter web` — run Jest + RTL suites.
- `pnpm build` — execute production Turborepo pipelines.

## Product Goals & Constraints
Goals: showcase Pirxey AI expertise, lift client form completion 20%, cut data errors 30%. MVP timeline: 1–2 devs, 2–3 weeks, budget under $300/month, while keeping a headless, AI-assisted experience.

## MVP Scope & Requirements
Implement a JSON-driven conversation engine: schemas define prompt order, field types (`text`, `number`, `email`, `select`), validation flags like `required`, and optional `ai_prompt` hints. The system must maintain session state, guide the user sequentially, and POST the final payload to a configured webhook. Non-functional guardrails: <2 s average response, HTTPS-only traffic, bring-your-own LLM key, no durable storage after webhook delivery, and a documented getting-started flow.

## Coding Style & Naming Conventions
Write everything in TypeScript. Use Prettier defaults (2-space indent, trailing commas, double quotes in JSX). Components/providers use PascalCase; files and directories use kebab-case. Hooks start with `use`, server actions end with `Action`, and API resources live in `app/api/<resource>/route.ts`. Fix ESLint warnings rather than muting them.

## Testing Guidelines
Place unit and component specs alongside sources as `*.test.ts[x]`. Keep Playwright E2E specs in `apps/web/e2e`, named `<feature>.spec.ts`. Target ≥80% statement coverage and add regression tests for every bug fix. Mock Vercel AI SDK calls with helpers from `packages/shared/test`. Before any PR, run `pnpm lint` and `pnpm test --filter web`.

## Commit & Pull Request Guidelines
Use Conventional Commits (`type(scope?): summary`) as seen in `git log` (`docs: architecture md file`). Keep PRs narrow (<~400 LOC) with summaries, linked issues, and evidence for UI/API work (screenshots or command output). Flag infra/config changes, request review early, and delete merged branches unless a release tag needs them.

## Agent Notes
Log outstanding questions in `brief.md` and refresh this guide when specs or workflows change.
