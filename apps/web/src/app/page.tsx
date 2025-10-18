import Link from "next/link";

import { ChatPlayground } from "@/components/demo/ChatPlayground";
import { loadSchemaCatalog } from "@/lib/conversation/schema-catalog";

export default async function Home() {
  const schemas = await loadSchemaCatalog();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12 lg:flex-row lg:gap-16 lg:px-12">
        <section className="flex-1 space-y-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">FormFillAI</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Build conversational intake flows without re-writing forms.
          </h1>
          <p className="text-base leading-7 text-slate-600">
            Drop a JSON schema into <span className="font-mono">public/schemas</span>, point the chat
            component at its URL, and start collecting rich, validated responses. This playground lets
            you toggle between multiple definitions to see how prompts and validation change.
          </p>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">How it works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Place a JSON schema file in <span className="font-mono">public/schemas</span>.</li>
              <li>Pass its URL (e.g. <span className="font-mono">/schemas/loan-intake.json</span>) to the chat component.</li>
              <li>The UI fetches, validates, and hydrates the conversation engine automatically.</li>
            </ol>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <Link
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              href="/specs/init/architecture"
            >
              View architecture notes →
            </Link>
            <a
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              href="https://github.com/vercel/ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              Vercel AI SDK docs
            </a>
          </div>
        </section>

        <div className="flex-1">
          <ChatPlayground schemas={schemas} />
        </div>
      </div>
    </main>
  );
}
