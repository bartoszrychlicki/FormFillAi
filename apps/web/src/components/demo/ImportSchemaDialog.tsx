"use client";

import { useState } from "react";
import { parseConversationSchema, type ConversationSchema } from "@formfillai/shared";

interface ImportSchemaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseSchema: (schema: ConversationSchema, schemaJson: string) => void;
}

type Tab = "raw" | "preview";
type ValidationState = "valid" | "invalid" | "neutral";

export function ImportSchemaDialog({ isOpen, onClose, onUseSchema }: ImportSchemaDialogProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaJson, setSchemaJson] = useState<string | null>(null);
  const [parsedSchema, setParsedSchema] = useState<ConversationSchema | null>(null);
  const [validationState, setValidationState] = useState<ValidationState>("neutral");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("raw");

  const validateSchema = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = parseConversationSchema(parsed);
      setParsedSchema(validated);
      setValidationState("valid");
      setValidationError(null);
    } catch (err) {
      setParsedSchema(null);
      setValidationState("invalid");
      setValidationError(err instanceof Error ? err.message : "Invalid schema format");
    }
  };

  const handleImport = async () => {
    if (!url.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setLoading(true);
    setError(null);
    setSchemaJson(null);
    setParsedSchema(null);
    setValidationState("neutral");

    try {
      const response = await fetch("/api/import-form", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import form");
      }

      const data = await response.json();
      const formatted = JSON.stringify(data.schema, null, 2);
      setSchemaJson(formatted);
      validateSchema(formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSchemaChange = (value: string) => {
    setSchemaJson(value);
    setValidationState("neutral");
  };

  const handleSchemaBlur = () => {
    if (schemaJson) {
      validateSchema(schemaJson);
    }
  };

  const handleCopyToClipboard = async () => {
    if (schemaJson) {
      await navigator.clipboard.writeText(schemaJson);
    }
  };

  const handleUseSchema = () => {
    if (parsedSchema && schemaJson) {
      onUseSchema(parsedSchema, schemaJson);
      handleClose();
    }
  };

  const handleClose = () => {
    setUrl("");
    setError(null);
    setSchemaJson(null);
    setParsedSchema(null);
    setValidationState("neutral");
    setValidationError(null);
    setActiveTab("raw");
    onClose();
  };

  if (!isOpen) return null;

  const getBorderColor = () => {
    if (validationState === "valid") return "border-green-500";
    if (validationState === "invalid") return "border-orange-500";
    return "border-slate-300";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Import Form from URL</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="form-url" className="block text-sm font-medium text-slate-700">
              Google Forms URL
            </label>
            <input
              id="form-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/forms/d/..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!schemaJson && (
            <button
              onClick={handleImport}
              disabled={loading || !url.trim()}
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import Form"}
            </button>
          )}

          {schemaJson && parsedSchema && (
            <div className="space-y-3">
              <div className="rounded-md bg-slate-50 p-3">
                <div className="text-sm font-medium text-slate-900">{parsedSchema.id}</div>
                <div className="mt-1 text-xs text-slate-600">{parsedSchema.welcomeMessage}</div>
              </div>

              <div className="flex gap-2 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab("raw")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === "raw"
                      ? "border-b-2 border-sky-600 text-sky-600"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Raw
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`px-4 py-2 text-sm font-medium transition ${
                    activeTab === "preview"
                      ? "border-b-2 border-sky-600 text-sky-600"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Preview
                </button>
              </div>

              {activeTab === "raw" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="schema-output" className="block text-sm font-medium text-slate-700">
                      Schema JSON
                    </label>
                    <button
                      onClick={handleCopyToClipboard}
                      className="text-sm text-sky-600 hover:text-sky-700"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                  <textarea
                    id="schema-output"
                    value={schemaJson}
                    onChange={(e) => handleSchemaChange(e.target.value)}
                    onBlur={handleSchemaBlur}
                    rows={20}
                    className={`w-full rounded-md border ${getBorderColor()} bg-white px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-sky-200`}
                  />
                  {validationState === "invalid" && validationError && (
                    <div className="text-xs text-orange-600">
                      {validationError}
                    </div>
                  )}
                  {validationState === "valid" && (
                    <div className="text-xs text-green-600">
                      Schema is valid
                    </div>
                  )}
                </div>
              )}

              {activeTab === "preview" && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">
                    Fields ({parsedSchema.fields.length})
                  </div>
                  <div className="max-h-96 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
                    {parsedSchema.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900">{field.text}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {field.type}
                            </span>
                            {field.validation.required && (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                required
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleUseSchema}
                disabled={validationState !== "valid"}
                className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Use Schema
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
