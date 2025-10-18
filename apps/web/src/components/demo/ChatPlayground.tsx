"use client";

import { useMemo, useState } from "react";

import type { SchemaPreview } from "@/lib/conversation/schema-catalog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ImportSchemaDialog } from "@/components/demo/ImportSchemaDialog";

interface ChatPlaygroundProps {
  schemas: SchemaPreview[];
}

export function ChatPlayground({ schemas }: ChatPlaygroundProps) {
  const [selectedId, setSelectedId] = useState(() => schemas[0]?.id ?? "");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const selectedSchema = useMemo(
    () => schemas.find((schema) => schema.id === selectedId) ?? schemas[0] ?? null,
    [schemas, selectedId],
  );

  if (!selectedSchema) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        No conversation schemas available. Add a JSON definition under
        <span className="mx-1 font-mono">public/schemas</span> to get started.
      </div>
    );
  }

  const onSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(event.target.value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="text-sm font-medium text-slate-700" htmlFor="schema-selector">
            Choose a schema
          </label>
          <select
            id="schema-selector"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-auto"
            value={selectedSchema.id}
            onChange={onSelectChange}
          >
            {schemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsImportDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
          >
            Import from Google Forms
          </button>
          <a
            href={selectedSchema.schemaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            Open JSON file
          </a>
        </div>
      </div>

      <ChatPanel schemaUrl={selectedSchema.schemaUrl} title={`Loaded from ${selectedSchema.schemaUrl}`} />

      <ImportSchemaDialog isOpen={isImportDialogOpen} onClose={() => setIsImportDialogOpen(false)} />
    </div>
  );
}
