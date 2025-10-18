"use client";

import { useMemo, useState, useRef } from "react";

import type { SchemaPreview } from "@/lib/conversation/schema-catalog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { FormDisplay } from "@/components/chat/FormDisplay";
import { ImportSchemaDialog } from "@/components/demo/ImportSchemaDialog";
import type { ConversationSchema } from "@formfillai/shared";

interface ChatPlaygroundProps {
  schemas: SchemaPreview[];
}

export function ChatPlayground({ schemas }: ChatPlaygroundProps) {
  const [selectedId, setSelectedId] = useState(() => schemas[0]?.id ?? "");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importedSchema, setImportedSchema] = useState<SchemaPreview | null>(null);
  const [loadedSchema, setLoadedSchema] = useState<ConversationSchema | null>(null);
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({});
  const [isPending, setIsPending] = useState(false);

  const editHandlerRef = useRef<((fieldId: string, newValue: string) => Promise<void>) | null>(
    null,
  );

  const allSchemas = useMemo(() => {
    if (importedSchema) {
      return [importedSchema, ...schemas];
    }
    return schemas;
  }, [schemas, importedSchema]);

  const selectedSchema = useMemo(
    () => allSchemas.find((schema) => schema.id === selectedId) ?? allSchemas[0] ?? null,
    [allSchemas, selectedId],
  );

  const handleUseSchema = (schema: ConversationSchema, schemaJson: string) => {
    const dataUrl = `data:application/json;base64,${btoa(schemaJson)}`;
    const preview: SchemaPreview = {
      id: schema.id,
      schemaUrl: dataUrl,
      welcomeMessage: schema.welcomeMessage,
      completionMessage: schema.completionMessage,
      webhookUrl: schema.webhookUrl.toString(),
      fieldCount: schema.fields.length,
      fields: schema.fields.map((field) => ({
        id: field.id,
        text: field.text,
        type: field.type,
        required: field.validation.required,
        options: field.options,
      })),
    };

    setImportedSchema(preview);
    setSelectedId(schema.id);
  };

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
    setLoadedSchema(null);
    setCollectedData({});
  };

  const handleSchemaLoad = (schema: ConversationSchema) => {
    setLoadedSchema(schema);
    setCollectedData({});
  };

  const handleDataUpdate = (data: Record<string, unknown>) => {
    setCollectedData(data);
  };

  const handlePendingChange = (pending: boolean) => {
    setIsPending(pending);
  };

  const handleExposeEditHandler = (
    handler: (fieldId: string, newValue: string) => Promise<void>,
  ) => {
    editHandlerRef.current = handler;
  };

  const handleFieldEditFromForm = (fieldId: string, newValue: string) => {
    if (editHandlerRef.current) {
      void editHandlerRef.current(fieldId, newValue);
    }
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
            {allSchemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.id}
                {schema === importedSchema ? " (imported)" : ""}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[60%_40%]">
        <ChatPanel
          schemaUrl={selectedSchema.schemaUrl}
          onSchemaLoad={handleSchemaLoad}
          onDataUpdate={handleDataUpdate}
          onPendingChange={handlePendingChange}
          onExposeEditHandler={handleExposeEditHandler}
        />
        <FormDisplay
          schema={loadedSchema}
          collectedData={collectedData}
          onFieldEdit={handleFieldEditFromForm}
          isPending={isPending}
        />
      </div>

      <ImportSchemaDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onUseSchema={handleUseSchema}
      />
    </div>
  );
}
