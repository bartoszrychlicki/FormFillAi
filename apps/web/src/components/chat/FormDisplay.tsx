"use client";

import { type ConversationSchema } from "@formfillai/shared";
import { useEffect, useRef, useState } from "react";

interface FormDisplayProps {
  schema: ConversationSchema | null;
  collectedData: Record<string, unknown>;
  onFieldEdit: (fieldId: string, newValue: string) => void;
  isPending: boolean;
}

export function FormDisplay({ schema, collectedData, onFieldEdit, isPending }: FormDisplayProps) {
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const fieldsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to show newest completed field if it's not visible
  useEffect(() => {
    if (!fieldsContainerRef.current || !schema) return;

    // Find the last field that has a value
    const lastCompletedFieldIndex = schema.fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field.id in collectedData)
      .pop()?.index;

    if (lastCompletedFieldIndex === undefined) return;

    // Check if the last completed field is visible
    const container = fieldsContainerRef.current;
    const fieldElements = container.querySelectorAll("[data-field-id]");
    const lastCompletedFieldElement = fieldElements[lastCompletedFieldIndex] as HTMLElement;

    if (!lastCompletedFieldElement) return;

    const containerRect = container.getBoundingClientRect();
    const fieldRect = lastCompletedFieldElement.getBoundingClientRect();

    // Check if the field is fully visible in the container
    const isFieldVisible =
      fieldRect.top >= containerRect.top && fieldRect.bottom <= containerRect.bottom;

    // If not visible, scroll to show the newest completed field
    if (!isFieldVisible) {
      lastCompletedFieldElement.scrollIntoView({
        behavior: "smooth",
        block: "end",
        inline: "nearest",
      });
    }
  }, [collectedData, schema]);

  if (!schema) {
    return (
      <section className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <header>
          <h2 className="text-lg font-semibold">Form Fields</h2>
          <p className="text-sm text-slate-500">Loading schema...</p>
        </header>
      </section>
    );
  }

  const handleEditClick = (fieldId: string) => {
    const currentValue = collectedData[fieldId];
    setEditValue(typeof currentValue === "string" ? currentValue : "");
    setEditingFieldId(fieldId);
  };

  const handleSaveEdit = (fieldId: string) => {
    if (editValue.trim()) {
      onFieldEdit(fieldId, editValue.trim());
    }
    setEditingFieldId(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingFieldId(null);
    setEditValue("");
  };

  const renderField = (field: ConversationSchema["fields"][number]) => {
    const hasValue = field.id in collectedData;
    const value = collectedData[field.id];
    const isEditing = editingFieldId === field.id;
    const isRequired = field.validation.required;

    return (
      <div
        key={field.id}
        data-field-id={field.id}
        className={`rounded-md border p-4 transition-all ${
          hasValue ? "border-green-200 bg-green-50" : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700">
              {field.text}
              {isRequired ? (
                <span className="ml-1 text-red-500" title="Required">
                  *
                </span>
              ) : (
                <span className="ml-1 text-slate-400 text-xs">(optional)</span>
              )}
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Type: {field.type}
              {field.validation.minWords ? ` • Min ${field.validation.minWords} words` : ""}
            </p>
          </div>
          {hasValue && (
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-3 space-y-2">
            {field.type === "select" && field.options ? (
              <select
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              >
                <option value="">Select an option...</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "number" ? (
              <input
                type="number"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
              />
            ) : (
              <textarea
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveEdit(field.id)}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
                disabled={!editValue.trim()}
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {hasValue ? (
              <div className="space-y-2">
                <div className="rounded-md bg-white p-3 text-sm text-slate-700 shadow-sm">
                  {String(value)}
                </div>
                <button
                  type="button"
                  onClick={() => handleEditClick(field.id)}
                  className="text-sm font-medium text-sky-600 transition hover:text-sky-700"
                  disabled={isPending}
                >
                  Edit
                </button>
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">Not answered yet</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm overflow-y-auto max-h-[calc(100vh-100px)]">
      <header>
        <h2 className="text-lg font-semibold">Form Fields</h2>
        <p className="text-sm text-slate-500">
          {Object.keys(collectedData).length} of {schema.fields.length} completed
        </p>
      </header>

      <div ref={fieldsContainerRef} className="flex-1 overflow-y-auto space-y-3">
        {schema.fields.map(renderField)}
      </div>
    </section>
  );
}
